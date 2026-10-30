import { NextResponse } from "next/server";
import { z } from "zod";
import { ChatError,supportActor,getChat,sendChat,updateChat,supportInbox } from "@/lib/support-chat";
const message=z.object({body:z.string().trim().min(1).max(2000),clientMessageId:z.string().uuid()}).strict();
const cursor=z.string().regex(/^[1-9]\d{0,18}$/).refine(value=>BigInt(value)<=BigInt("9223372036854775807"));
const update=z.object({readThrough:cursor.optional(),status:z.enum(["open","resolved"]).optional()}).strict().refine(value=>Boolean(value.readThrough || value.status));
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
export async function chatApi(request:Request,staff=false,id?:string,inbox=false){
  try{
    const actor=await supportActor(staff);
    if(id && !z.string().uuid().safeParse(id).success)return json({error:"Invalid conversation."},400);
    const url=new URL(request.url);
    if(inbox)return json({conversations:await supportInbox(actor,(url.searchParams.get('q') || '').trim().slice(0,100))});
    if(request.method==='GET'){
      const before=url.searchParams.get('before') || undefined;
      if(before && !cursor.safeParse(before).success)return json({error:"Invalid message cursor."},400);
      return json(await getChat(actor,id,before,url.searchParams.get('summary')==='1'));
    }
    const raw=await request.json();
    if(request.method==='POST'){
      const parsed=message.safeParse(raw);if(!parsed.success)return json({error:"Enter a message of 1 to 2000 characters."},400);
      return json(await sendChat(actor,parsed.data.body,parsed.data.clientMessageId,id),201);
    }
    const parsed=update.safeParse(raw);if(!parsed.success)return json({error:"Invalid chat update."},400);
    if(!id){const chat=await getChat(actor,undefined,undefined,true);id=chat.conversation?.id;}
    if(!id)throw new ChatError("Conversation not found.",404);
    return json(await updateChat(actor,id,parsed.data));
  }catch(error){
    if(error instanceof ChatError)return json({error:error.message},error.status);
    if(error instanceof SyntaxError)return json({error:"Invalid request."},400);
    console.error("Support chat failed",error);return json({error:"Support chat is unavailable. Please retry or contact reception."},503);
  }
}
