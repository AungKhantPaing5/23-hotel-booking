import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {roomNumberSchema} from '../lib/room-inventory.ts';
test('booking confirmation and check-in through the actual staff transition service',async t=>{
 const db=new PGlite({extensions:{btree_gist,pgcrypto}});const require=createRequire(import.meta.url);
 try{
  await db.exec(readFileSync(new URL('../docker/postgres/init/001_schema.sql',import.meta.url),'utf8'));
  const customer=(await db.query("INSERT INTO users(email,full_name) VALUES('guest@test.example','Guest') RETURNING id")).rows[0].id;
  await db.query('INSERT INTO profiles(user_id) VALUES($1)',[customer]);
  const admin=(await db.query("INSERT INTO users(email) VALUES('admin@test.example') RETURNING id")).rows[0].id;
  await db.query("INSERT INTO staff_profiles(user_id,display_name,role) VALUES($1,'Admin','super_admin')",[admin]);
  const room=(await db.query('SELECT id FROM rooms ORDER BY display_order LIMIT 1')).rows[0].id;
  const legacy=(await db.query("INSERT INTO bookings(customer_id,room_id,check_in,check_out,guests,total_amount) VALUES($1,$2,'2099-06-01','2099-06-02',1,85000) RETURNING id",[customer,room])).rows[0].id;
  await db.exec(readFileSync(new URL('../docker/postgres/migrations/007_room_number_inventory.sql',import.meta.url),'utf8'));
  await db.query("INSERT INTO room_units(room_number,room_id) VALUES('A100',$1),('A101',$1)",[room]);
  const numbered=(await db.query("INSERT INTO bookings(customer_id,room_id,assigned_room_number,check_in,check_out,guests,total_amount) VALUES($1,$2,'A100','2099-07-01','2099-07-02',1,85000) RETURNING id",[customer,room])).rows[0].id;
  const query=async(sql,params)=>{const result=await db.query(sql,params);return {...result,rowCount:result.rows.length || result.affectedRows || 0};};
  const pool={query,withTransaction:async callback=>{await db.exec('BEGIN');try{const result=await callback({query});await db.exec('COMMIT');return result;}catch(error){await db.exec('ROLLBACK');throw error;}}};
  const exports={};const code=ts.transpileModule(readFileSync(new URL('../lib/db/client.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','exports',code)(name=>name==='@/lib/db/pool'?pool:name==='@/lib/db/session'?{getCurrentUser:async()=>({id:admin})}:name==='@/lib/room-inventory'?{roomNumberSchema}:name==='next/headers'?{cookies:async()=>({})}:require(name),exports);
  const client=await exports.createClient();
  await t.test('legacy pending reservation confirms without requiring a room number',async()=>{
   const result=await client.rpc('transition_booking_status',{p_booking_id:legacy,p_expected_status:'pending',p_new_status:'confirmed'});
   assert.equal(result.error,null,JSON.stringify(result.error));assert.equal(result.data.status,'confirmed');assert.equal(result.data.assigned_room_number,null);
  });
  await t.test('numbered booking confirms and retains customer selection',async()=>{
   const result=await client.rpc('transition_booking_status',{p_booking_id:numbered,p_expected_status:'pending',p_new_status:'confirmed'});
   assert.equal(result.error,null,JSON.stringify(result.error));assert.equal(result.data.assigned_room_number,'A100');
  });
  await t.test('check-in uses selected number; stale updates do not overwrite status',async()=>{
   const result=await client.rpc('transition_booking_status',{p_booking_id:numbered,p_expected_status:'confirmed',p_new_status:'checked_in'});
   assert.equal(result.error,null,JSON.stringify(result.error));assert.equal(result.data.status,'checked_in');
   assert.match((await client.rpc('transition_booking_status',{p_booking_id:numbered,p_expected_status:'pending',p_new_status:'confirmed'})).error.message,/STATUS_CONFLICT/);
  });
 }finally{await db.close();}
});
