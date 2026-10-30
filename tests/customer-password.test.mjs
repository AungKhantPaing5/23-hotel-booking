import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import * as identity from '../lib/customer-login.ts';
import * as passwords from '../lib/db/password.ts';

test('customer password signup, returning login, reset and staff separation',async t=>{
  const db=new PGlite({extensions:{btree_gist,pgcrypto}});
  const require=createRequire(import.meta.url);
  try{
    await db.exec(readFileSync(new URL('../docker/postgres/init/001_schema.sql',import.meta.url),'utf8'));
    const migration=readFileSync(new URL('../docker/postgres/migrations/008_customer_password_login.sql',import.meta.url),'utf8');
    await db.exec(migration);await db.exec(migration);
    const query=async(sql,params)=>{const result=await db.query(sql,params);return {...result,rowCount:result.rows.length || result.affectedRows || 0};};
    const pool={query,withTransaction:async callback=>{await db.exec('BEGIN');try{const result=await callback({query});await db.exec('COMMIT');return result;}catch(error){await db.exec('ROLLBACK');throw error;}}};
    const modules={'@/lib/db/pool':pool,'@/lib/customer-login':identity,'@/lib/db/password':passwords,'next/headers':{cookies:async()=>({get:()=>null}),headers:async()=>new Headers()}};
    function load(file){const exports={};const code=ts.transpileModule(readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports',code)(name=>modules[name] || require(name),exports);return exports;}
    const session=modules['@/lib/db/session']=load('lib/db/session.ts');
    modules['@/lib/customer-account']=load('lib/customer-account.ts');
    modules['@/lib/customer-password']=load('lib/customer-password.ts');
    const otp=load('app/api/auth/otp/verify/route.ts');
    const login=load('app/api/auth/customer-login/route.ts');
    const staffLogin=load('app/api/auth/staff-login/route.ts');
    const request=body=>new Request('http://localhost/api/auth',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    const email='legacy@example.com',phone='+959123456789',oldPassword='FirstPassword!123',newPassword='SecondPassword!456';
    const id=(await query('INSERT INTO users(email,phone,full_name) VALUES($1,$2,$3) RETURNING id',[email,phone,'Original Guest'])).rows[0].id;
    await query('INSERT INTO profiles(user_id,phone,full_name) VALUES($1,$2,$3)',[id,phone,'Original Guest']);
    const oldToken=session.createSessionToken(id);
    async function issue(email,phone,code='123456') {await query("INSERT INTO auth_otps(email,phone,code_hash,expires_at) VALUES($1,$2,$3,now()+interval '10 minutes')",[email,phone,identity.customerOtpHash(email,phone,code)]);}
    await t.test('OTP-only legacy account safely sets a password and retains its identity',async()=>{
      await issue(email,phone);
      assert.equal((await otp.POST(request({email,phone:'09123456789',code:'123456'}))).status,400);
      assert.equal((await otp.POST(request({email,phone:'09123456789',code:'000000',password:oldPassword}))).status,400);
      const response=await otp.POST(request({email,phone:'09123456789',code:'123456',password:oldPassword}));
      assert.equal(response.status,200);
      assert.match(response.headers.get('set-cookie'),/23hotel_session=/);
      const body=await response.json();assert.equal(body.user.id,id);assert.equal(body.user.full_name,'Original Guest');
      assert.equal((await session.getCurrentUserByToken(body.token)).id,id);
      assert.equal(await session.getCurrentUserByToken(oldToken),null);
      assert.equal((await query('SELECT count(*)::int AS count FROM users WHERE email=$1',[email])).rows[0].count,1);
    });
    let loggedInToken;
    await t.test('returning email/password login does not request a phone or create an OTP',async()=>{
      const before=(await query('SELECT count(*)::int AS count FROM auth_otps')).rows[0].count;
      const response=await login.POST(request({email:'LEGACY@example.com',password:oldPassword}));
      assert.equal(response.status,200);loggedInToken=(await response.json()).token;
      assert.equal((await session.getCurrentUserByToken(loggedInToken)).id,id);
      assert.equal((await query('SELECT count(*)::int AS count FROM auth_otps')).rows[0].count,before);
      assert.equal((await login.POST(request({email,password:'wrong'}))).status,401);
      assert.equal((await login.POST(request({email:'unknown@example.com',password:oldPassword}))).status,401);
    });
    await t.test('password reset requires fresh phone OTP and invalidates old sessions/passwords',async()=>{
      assert.equal((await otp.POST(request({email,phone,code:'123456',password:newPassword}))).status,400,'used OTP must not reset password');
      await issue(email,phone,'654321');
      assert.equal((await otp.POST(request({email,phone,code:'654321',password:newPassword}))).status,200);
      assert.equal(await session.getCurrentUserByToken(loggedInToken),null);
      assert.equal((await login.POST(request({email,password:oldPassword}))).status,401);
      assert.equal((await login.POST(request({email,password:newPassword}))).status,200);
    });
    await t.test('new customer gets a hashed password only after valid OTP',async()=>{
      await issue('new@example.com','+959123456788');
      const response=await otp.POST(request({email:'new@example.com',phone:'09123456788',code:'123456',password:newPassword}));
      assert.equal(response.status,200);
      const row=(await query("SELECT password_hash FROM users WHERE email='new@example.com'")).rows[0];
      assert.ok(row.password_hash.startsWith('scrypt$'));assert.notEqual(row.password_hash,newPassword);
      assert.equal((await login.POST(request({email:'new@example.com',password:newPassword}))).status,200);
    });
    await t.test('staff use email/password without phone; customer endpoints reject staff',async()=>{
      const hash=await passwords.hashPassword(oldPassword);
      const staffId=(await query("INSERT INTO users(email,password_hash,full_name) VALUES('staff@example.com',$1,'Staff') RETURNING id",[hash])).rows[0].id;
      await query("INSERT INTO staff_profiles(user_id,display_name,role) VALUES($1,'Staff','receptionist')",[staffId]);
      assert.equal((await login.POST(request({email:'staff@example.com',password:oldPassword}))).status,401);
      const response=await staffLogin.POST(request({email:'staff@example.com',password:oldPassword}));
      assert.equal(response.status,200);assert.equal((await session.getCurrentUserByToken((await response.json()).token)).id,staffId);
    });
    await t.test('disabled accounts and repeated password guessing are blocked',async()=>{
      await query('UPDATE users SET is_enabled=false WHERE id=$1',[id]);
      assert.equal((await login.POST(request({email,password:newPassword}))).status,401);
      await query('UPDATE users SET is_enabled=true WHERE id=$1',[id]);
      for(let i=0;i<9;i++)assert.equal((await login.POST(request({email,password:'incorrect'}))).status,401);
      assert.equal((await login.POST(request({email,password:newPassword}))).status,429);
      await issue(email,phone,'111111');
      assert.equal((await otp.POST(request({email,phone,code:'111111',password:newPassword}))).status,200);
      assert.equal((await login.POST(request({email,password:newPassword}))).status,200);
    });
  }finally{await db.close();}
});
