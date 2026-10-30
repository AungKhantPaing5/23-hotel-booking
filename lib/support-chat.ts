import { getCurrentUser } from "@/lib/db/session";
import { query,withTransaction } from "@/lib/db/pool";

export const SUPPORT_ROLES=["super_admin","manager","receptionist","support_staff"] as const;
export type ChatActor={id:string;isStaff:boolean};
export class ChatError extends Error {constructor(message:string,public status:number){super(message);}}
export async function supportActor(staff:boolean):Promise<ChatActor>{
  const user=await getCurrentUser();if(!user)throw new ChatError("Sign in to contact hotel support.",401);
  const profile=(await query<{role:string;is_active:boolean}>("SELECT role,is_active FROM staff_profiles WHERE user_id=$1",[user.id])).rows[0];
  if(staff){if(!profile?.is_active || !SUPPORT_ROLES.some(role=>role===profile.role))throw new ChatError("Your role cannot access customer support messages.",403);}
  else if(profile)throw new ChatError("Staff must use the support inbox.",403);
  return {id:user.id,isStaff:staff};
}
async function authorizedConversation(actor:ChatActor,id:string){
  const result=await query<{id:string;customer_id:string;status:string}>("SELECT id,customer_id,status FROM support_conversations WHERE id=$1 AND ($2::boolean OR customer_id=$3)",[id,actor.isStaff,actor.id]);
  if(!result.rows[0])throw new ChatError("Conversation not found.",404);return result.rows[0];
}
export async function getChat(actor:ChatActor,id?:string,before?:string,summary=false){
  const conversation=actor.isStaff
    ? await authorizedConversation(actor,id!)
    : (await query<{id:string;customer_id:string;status:string}>("SELECT id,customer_id,status FROM support_conversations WHERE customer_id=$1",[actor.id])).rows[0] || null;
  if(!conversation)return {conversation:null,messages:[],unreadCount:0,hasMore:false};
  const unread=(await query<{count:number}>(`SELECT count(*)::int AS count FROM support_messages m JOIN support_conversations c ON c.id=m.conversation_id
    WHERE c.id=$1 AND m.sender_is_staff<>$2 AND m.id>CASE WHEN $2 THEN c.staff_read_id ELSE c.customer_read_id END`,[conversation.id,actor.isStaff])).rows[0].count;
  if(summary)return {conversation,messages:[],unreadCount:unread,hasMore:false};
  const rows=(await query(`SELECT m.id::text,m.body,m.sender_is_staff,m.created_at,(m.sender_id=$3::uuid) AS is_own,
    CASE WHEN m.sender_is_staff THEN coalesce(sp.display_name,'Hotel support') ELSE 'Guest' END AS sender_name
    FROM support_messages m LEFT JOIN staff_profiles sp ON sp.user_id=m.sender_id
    WHERE m.conversation_id=$1 AND ($2::bigint IS NULL OR m.id<$2::bigint) ORDER BY m.id DESC LIMIT 51`,[conversation.id,before || null,actor.id])).rows;
  return {conversation,messages:rows.slice(0,50).reverse(),unreadCount:unread,hasMore:rows.length>50};
}
export async function sendChat(actor:ChatActor,body:string,clientMessageId:string,id?:string){
  if(actor.isStaff)await authorizedConversation(actor,id!);
  return withTransaction(async client=>{
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`chat-sender:${actor.id}`]);
    let conversationId=id;
    if(!actor.isStaff)conversationId=(await client.query<{id:string}>("INSERT INTO support_conversations(customer_id) VALUES($1) ON CONFLICT(customer_id) DO UPDATE SET customer_id=EXCLUDED.customer_id RETURNING id",[actor.id])).rows[0].id;
    const existing=(await client.query<{id:string;body:string;conversation_id:string}>("SELECT id::text,body,conversation_id FROM support_messages WHERE sender_id=$1 AND client_message_id=$2",[actor.id,clientMessageId])).rows[0];
    if(existing){if(existing.conversation_id!==conversationId || existing.body!==body)throw new ChatError("Message retry does not match the original message.",409);return {id:existing.id,conversationId,duplicate:true};}
    const recent=(await client.query<{count:number}>("SELECT count(*)::int AS count FROM support_messages WHERE sender_id=$1 AND created_at>now()-interval '1 minute'",[actor.id])).rows[0].count;
    if(recent>=20)throw new ChatError("Please wait a minute before sending more messages.",429);
    const result=await client.query<{id:string}>("INSERT INTO support_messages(conversation_id,sender_id,sender_is_staff,client_message_id,body) VALUES($1,$2,$3,$4,$5) RETURNING id::text",[conversationId,actor.id,actor.isStaff,clientMessageId,body]);
    await client.query("UPDATE support_conversations SET updated_at=now(),status='open' WHERE id=$1",[conversationId]);
    return {id:result.rows[0].id,conversationId,duplicate:false};
  });
}
export async function updateChat(actor:ChatActor,id:string,action:{readThrough?:string;status?:"open"|"resolved"}){
  await authorizedConversation(actor,id);
  if(action.status){if(!actor.isStaff)throw new ChatError("Only support staff can change conversation status.",403);await query("UPDATE support_conversations SET status=$2 WHERE id=$1",[id,action.status]);}
  if(action.readThrough)await query(`UPDATE support_conversations SET ${actor.isStaff?"staff_read_id":"customer_read_id"}=greatest(${actor.isStaff?"staff_read_id":"customer_read_id"},coalesce((SELECT max(id) FROM support_messages WHERE conversation_id=$1 AND id<=$2::bigint),0)) WHERE id=$1`,[id,action.readThrough]);
  return {updated:true};
}
export async function supportInbox(actor:ChatActor,search:string){
  if(!actor.isStaff)throw new ChatError("Staff access required.",403);
  return (await query(`SELECT c.id,c.status,c.updated_at,u.full_name,u.email,u.phone,
    (SELECT body FROM support_messages WHERE conversation_id=c.id ORDER BY id DESC LIMIT 1) AS last_message,
    (SELECT count(*)::int FROM support_messages WHERE conversation_id=c.id AND NOT sender_is_staff AND id>c.staff_read_id) AS unread_count
    FROM support_conversations c JOIN users u ON u.id=c.customer_id
    WHERE ($1='' OR u.full_name ILIKE '%'||$1||'%' OR u.email ILIKE '%'||$1||'%' OR u.phone ILIKE '%'||$1||'%')
    ORDER BY (SELECT count(*) FROM support_messages WHERE conversation_id=c.id AND NOT sender_is_staff AND id>c.staff_read_id)>0 DESC,c.updated_at DESC,c.id LIMIT 100`,[search])).rows;
}
