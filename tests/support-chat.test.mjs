import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';

test('private customer support chat with staff permissions and persistent history',async t=>{
  const db=new PGlite({extensions:{btree_gist,pgcrypto}});const require=createRequire(import.meta.url);let currentUser=null;
  try{
    await db.exec(readFileSync(new URL('../docker/postgres/init/001_schema.sql',import.meta.url),'utf8'));
    const migration=readFileSync(new URL('../docker/postgres/migrations/009_support_chat.sql',import.meta.url),'utf8');await db.exec(migration);await db.exec(migration);
    const query=async(sql,params)=>{const result=await db.query(sql,params);return {...result,rowCount:result.rows.length || result.affectedRows || 0};};
    const pool={query,withTransaction:async callback=>{await db.exec('BEGIN');try{const result=await callback({query});await db.exec('COMMIT');return result;}catch(error){await db.exec('ROLLBACK');throw error;}}};
    const modules={'@/lib/db/pool':pool,'@/lib/db/session':{getCurrentUser:async()=>currentUser}};
    function load(file){const exports={};const code=ts.transpileModule(readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports',code)(name=>modules[name] || require(name),exports);return exports;}
    const service=modules['@/lib/support-chat']=load('lib/support-chat.ts');const {chatApi}=load('lib/support-chat-api.ts');
    async function user(email,role){const row=(await query('INSERT INTO users(email,full_name) VALUES($1,$2) RETURNING id',[email,email.split('@')[0]])).rows[0];if(role)await query('INSERT INTO staff_profiles(user_id,display_name,role) VALUES($1,$2,$3)',[row.id,role,role]);return row;}
    const alice=await user('alice@example.com'),bob=await user('bob@example.com'),support=await user('support@example.com','support_staff'),kitchen=await user('kitchen@example.com','kitchen_staff');
    const customer={id:alice.id,isStaff:false},agent={id:support.id,isStaff:true};
    const request=(method='GET',body,url='http://localhost/api/support/chat')=>new Request(url,{method,...(body!==undefined?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
    let thread,first,reply;
    await t.test('anonymous users cannot read/send; staff role is checked on server',async()=>{
      assert.equal((await chatApi(request())).status,401);
      currentUser=kitchen;assert.equal((await chatApi(request(),true,undefined,true)).status,403);
      currentUser=support;assert.equal((await chatApi(request())).status,403);
      await query('UPDATE staff_profiles SET is_active=false WHERE user_id=$1',[support.id]);assert.equal((await chatApi(request(),true,undefined,true)).status,403);await query('UPDATE staff_profiles SET is_active=true WHERE user_id=$1',[support.id]);
      currentUser=alice;assert.equal((await chatApi(request(),true,undefined,true)).status,403);
    });
    await t.test('summary does not create empty threads; customer message ownership cannot be spoofed',async()=>{
      const empty=await service.getChat(customer,undefined,undefined,true);assert.equal(empty.conversation,null);
      assert.equal((await query('SELECT count(*)::int AS count FROM support_conversations')).rows[0].count,0);
      const forged=await chatApi(request('POST',{body:'hello',clientMessageId:randomUUID(),sender_id:support.id,sender_is_staff:true}));assert.equal(forged.status,400);
      const clientId=randomUUID();first=await service.sendChat(customer,'Hello, I need help with my booking.',clientId);thread=first.conversationId;
      assert.equal((await service.sendChat(customer,'Hello, I need help with my booking.',clientId)).duplicate,true);
      await assert.rejects(service.sendChat(customer,'Different message',clientId),error=>error.status===409);
      assert.equal((await query('SELECT count(*)::int AS count FROM support_messages')).rows[0].count,1);
    });
    await t.test('customers cannot access another conversation or change its status',async()=>{
      const other={id:bob.id,isStaff:false};assert.equal((await service.getChat(other,thread)).conversation,null);
      await assert.rejects(service.updateChat(other,thread,{readThrough:first.id}),error=>error.status===404);
      await assert.rejects(service.updateChat(customer,thread,{status:'resolved'}),error=>error.status===403);
      currentUser=bob;assert.equal((await chatApi(request('PATCH',{readThrough:first.id}))).status,404);
    });
    await t.test('support inbox, reply, and separate unread markers work',async()=>{
      currentUser=support;
      const inbox=await service.supportInbox(agent,'alice@example.com');assert.equal(inbox.length,1);assert.equal(inbox[0].unread_count,1);
      const response=await chatApi(request(),true,thread);assert.equal(response.status,200);assert.equal((await response.json()).messages[0].body,'Hello, I need help with my booking.');
      await service.updateChat(agent,thread,{readThrough:first.id});assert.equal((await service.supportInbox(agent,'alice'))[0].unread_count,0);
      reply=await service.sendChat(agent,'Welcome! How can we help?',randomUUID(),thread);
      assert.equal((await service.getChat(customer,undefined,undefined,true)).unreadCount,1);
      await service.updateChat(customer,thread,{readThrough:reply.id});assert.equal((await service.getChat(customer,undefined,undefined,true)).unreadCount,0);
      assert.equal((await service.getChat(customer)).messages.at(-1).sender_name,'support_staff');
      assert.equal((await service.getChat(customer)).messages.at(-1).is_own,false);
      assert.equal((await service.getChat(agent,thread)).messages.at(-1).is_own,true);
    });
    await t.test('resolved conversation reopens on a new customer message',async()=>{
      await service.updateChat(agent,thread,{status:'resolved'});assert.equal((await service.getChat(customer)).conversation.status,'resolved');
      await service.sendChat(customer,'Thank you, one more question.',randomUUID());assert.equal((await service.getChat(customer)).conversation.status,'open');
    });
    await t.test('long history paginates in chronological order and validates cursors',async()=>{
      for(let i=0;i<60;i++)await query('INSERT INTO support_messages(conversation_id,sender_id,sender_is_staff,client_message_id,body) VALUES($1,$2,true,$3,$4)',[thread,support.id,randomUUID(),`Historic reply ${i}`]);
      const latest=await service.getChat(customer);assert.equal(latest.messages.length,50);assert.equal(latest.hasMore,true);
      const older=await service.getChat(customer,undefined,latest.messages[0].id);assert.ok(older.messages.length>0);assert.ok(BigInt(older.messages.at(-1).id)<BigInt(latest.messages[0].id));
      currentUser=alice;const invalid=await chatApi(request('GET',undefined,'http://localhost/api/support/chat?before=99999999999999999999'));assert.equal(invalid.status,400);
    });
    await t.test('message validation and persistent per-sender rate limit',async()=>{
      currentUser=alice;
      assert.equal((await chatApi(request('POST',{body:' ',clientMessageId:randomUUID()}))).status,400);
      assert.equal((await chatApi(request('POST',{body:'x'.repeat(2001),clientMessageId:randomUUID()}))).status,400);
      const spamUser=await user('rate@example.com');const actor={id:spamUser.id,isStaff:false};
      for(let i=0;i<20;i++)await service.sendChat(actor,`Message ${i}`,randomUUID());
      await assert.rejects(service.sendChat(actor,'Too many',randomUUID()),error=>error.status===429);
    });
  }finally{await db.close();}
});
