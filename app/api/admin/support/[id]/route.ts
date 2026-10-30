import { chatApi } from "@/lib/support-chat-api";
export const runtime="nodejs";
type Context={params:Promise<{id:string}>};
export const GET=async(request:Request,{params}:Context)=>chatApi(request,true,(await params).id);
export const POST=GET;
export const PATCH=GET;
