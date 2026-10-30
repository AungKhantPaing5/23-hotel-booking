import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { ROOM_AVAILABILITY_SQL } from '../lib/room-availability.ts';
import { roomNumbersSchema,splitRoomNumbers,roomFields,roomNumberSchema } from '../lib/room-inventory.ts';

test('room numbers normalize and validate; partial edits do not reset room details',()=>{
  assert.deepEqual(roomNumbersSchema.parse(splitRoomNumbers('a100, A101\nA103')),['A100','A101','A103']);
  assert.equal(roomNumbersSchema.safeParse(['a100','A100']).success,false);
  assert.equal(roomNumbersSchema.safeParse([]).success,false);
  assert.equal(roomNumbersSchema.safeParse(['A/100']).success,false);
  assert.deepEqual(roomFields.partial().parse({is_active:false}),{is_active:false});
});

test('PostgreSQL room inventory migration, availability and booking constraints',async t=>{
  const db=new PGlite({extensions:{btree_gist,pgcrypto}});
  try {
    await db.exec(readFileSync(new URL('../docker/postgres/init/001_schema.sql',import.meta.url),'utf8'));
    const user=(await db.query("INSERT INTO users(email,full_name) VALUES('inventory-test@example.com','Inventory Test') RETURNING id")).rows[0].id;
    await db.query('INSERT INTO profiles(user_id,full_name) VALUES($1,$2)',[user,'Inventory Test']);
    const rooms=(await db.query('SELECT id,slug FROM rooms ORDER BY display_order')).rows;
    const deluxe=rooms[0].id, suite=rooms[2].id;
    const insert=async(room,number,start='2099-01-10',end='2099-01-12',status='pending')=>db.query(
      'INSERT INTO bookings(customer_id,room_id,assigned_room_number,check_in,check_out,guests,total_amount,status) VALUES($1,$2,$3,$4,$5,1,100,$6) RETURNING id',
      [user,room,number,start,end,status]);
    const legacy=(await insert(suite,null)).rows[0].id;
    await insert(deluxe,'A099','2098-01-01','2098-01-02','checked_out');
    const migration=readFileSync(new URL('../docker/postgres/migrations/007_room_number_inventory.sql',import.meta.url),'utf8');
    await db.exec(migration);
    await db.exec(migration);
    await db.query("INSERT INTO room_units(room_number,room_id) VALUES('A100',$1),('A101',$1),('A103',$1),('S100',$2),('S101',$2)",[deluxe,suite]);
    await t.test('historical assigned rooms and legacy requests survive migration',async()=>{
      assert.equal((await db.query("SELECT count(*)::int AS count FROM room_units WHERE room_number='A099'")).rows[0].count,1);
      assert.equal((await db.query('SELECT assigned_room_number FROM bookings WHERE id=$1',[legacy])).rows[0].assigned_room_number,null);
    });
    const first=(await insert(deluxe,'A100')).rows[0].id;
    await t.test('same type can book different numbers on the same dates',async()=>{
      await insert(deluxe,'A101');
      const available=await db.query(ROOM_AVAILABILITY_SQL,[deluxe,'2099-01-10','2099-01-12']);
      assert.deepEqual(available.rows.map(row=>row.room_number),['A099','A103']);
    });
    await t.test('same number rejects overlaps but allows adjacent checkout/checkin',async()=>{
      await assert.rejects(insert(deluxe,'A100','2099-01-11','2099-01-13'),error=>error.code==='23P01');
      await insert(deluxe,'A100','2099-01-12','2099-01-13');
    });
    await t.test('wrong type, missing numbers and duplicate physical numbers are rejected',async()=>{
      await assert.rejects(insert(suite,'A100'),error=>error.code==='23514');
      await assert.rejects(insert(deluxe,null,'2099-04-01','2099-04-02'),error=>error.code==='23514');
      await assert.rejects(db.query("INSERT INTO room_units(room_number,room_id) VALUES('A100',$1)",[suite]),error=>error.code==='23505');
    });
    await t.test('active reservation prevents number removal; cancellation releases inventory',async()=>{
      await assert.rejects(db.query("UPDATE room_units SET is_active=false WHERE room_number='A101'"),error=>error.message.includes('ROOM_HAS_ACTIVE_BOOKINGS'));
      await db.query("UPDATE bookings SET status='cancelled' WHERE id=$1",[first]);
      await insert(deluxe,'A100');
    });
    await t.test('legacy unassigned stay holds its type until its number is assigned',async()=>{
      assert.deepEqual((await db.query(ROOM_AVAILABILITY_SQL,[suite,'2099-01-10','2099-01-12'])).rows,[]);
      await assert.rejects(insert(suite,'S100'),error=>error.code==='23P01');
      await db.query("UPDATE bookings SET assigned_room_number='S100' WHERE id=$1",[legacy]);
      assert.deepEqual((await db.query(ROOM_AVAILABILITY_SQL,[suite,'2099-01-10','2099-01-12'])).rows.map(row=>row.room_number),['S101']);
    });
    await t.test('actual booking service prices and reserves the selected number atomically',async()=>{
      const require=createRequire(import.meta.url);
      const query=async(sql,params)=>{const result=await db.query(sql,params);return {...result,rowCount:result.rows.length || result.affectedRows || 0};};
      const pool={query,withTransaction:async callback=>{await db.exec('BEGIN');try{const result=await callback({query});await db.exec('COMMIT');return result;}catch(error){await db.exec('ROLLBACK');throw error;}}};
      const source=readFileSync(new URL('../lib/db/client.ts',import.meta.url),'utf8');
      const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
      const exports={};
      new Function('require','exports',compiled)(name=>{
        if(name==='@/lib/db/pool')return pool;
        if(name==='@/lib/db/session')return {getCurrentUser:async()=>({id:user})};
        if(name==='@/lib/room-inventory')return {roomNumberSchema};
        if(name==='next/headers')return {cookies:async()=>({})};
        return require(name);
      },exports);
      const client=await exports.createClient();
      const details={p_room_id:deluxe,p_room_number:'a103',p_check_in:'2099-03-10',p_check_out:'2099-03-12',p_guests:1,p_note:'Selected number test'};
      const first=await client.rpc('create_booking_request',details);
      assert.equal(first.error,null);
      assert.equal(first.data.assigned_room_number,'A103');
      assert.equal(Number(first.data.total_amount),170000);
      assert.match((await client.rpc('create_booking_request',details)).error.message,/SOLD_OUT/);
      assert.equal((await client.rpc('create_booking_request',{...details,p_room_number:'A101'})).error,null);
      assert.match((await client.rpc('create_booking_request',{...details,p_room_number:'S100'})).error.message,/ROOM_NUMBER_NOT_AVAILABLE/);
    });
    await t.test('actual admin room saves keep inventory and type edits atomic',async()=>{
      const require=createRequire(import.meta.url);
      const query=async(sql,params)=>{const result=await db.query(sql,params);return {...result,rowCount:result.rows.length || result.affectedRows || 0};};
      const pool={withTransaction:async callback=>{await db.exec('BEGIN');try{const result=await callback({query});await db.exec('COMMIT');return result;}catch(error){await db.exec('ROLLBACK');throw error;}}};
      const compiled=ts.transpileModule(readFileSync(new URL('../lib/room-management.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
      const exports={};
      new Function('require','exports',compiled)(name=>{
        if(name==='@/lib/db/pool')return pool;
        if(name==='@/lib/auth')return {requireStaffApi:async()=>({})};
        if(name==='@/lib/room-inventory')return {roomFields};
        return require(name);
      },exports);
      const request=body=>new Request('http://localhost/api/admin/rooms',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      const response=await exports.saveRoom(request({name:'Test Family',slug:'test-family',description:'Keep this description',nightly_rate:200000,capacity:3,features:[],image_url:'',display_order:0,is_active:true,room_numbers:['f100','F101']}));
      assert.equal(response.status,201);
      const family=(await response.json()).room;
      assert.deepEqual(family.room_numbers,['F100','F101']);
      assert.equal((await exports.saveRoom(request({is_active:false}),family.id)).status,200);
      assert.equal((await query('SELECT description FROM rooms WHERE id=$1',[family.id])).rows[0].description,'Keep this description');
      const conflict=await exports.saveRoom(request({nightly_rate:1,room_numbers:['A100']}),family.id);
      assert.equal(conflict.status,409);
      assert.equal(Number((await query('SELECT nightly_rate FROM rooms WHERE id=$1',[family.id])).rows[0].nightly_rate),200000);
      await exports.saveRoom(request({is_active:true}),family.id);
      await insert(family.id,'F100','2099-05-01','2099-05-03');
      assert.equal((await exports.saveRoom(request({name:'Should Roll Back',room_numbers:['F101']}),family.id)).status,409);
      assert.equal((await query('SELECT name FROM rooms WHERE id=$1',[family.id])).rows[0].name,'Test Family');
    });
    await t.test('soft removal retains historical FK and excludes number from availability',async()=>{
      await db.query("UPDATE room_units SET is_active=false WHERE room_number='A099'");
      assert.ok((await db.query("SELECT id FROM bookings WHERE assigned_room_number='A099'")).rows.length);
      assert.deepEqual((await db.query(ROOM_AVAILABILITY_SQL,[deluxe,'2099-02-01','2099-02-02'])).rows.map(row=>row.room_number),['A100','A101','A103']);
    });
  } finally {await db.close();}
});
