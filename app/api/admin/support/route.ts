import { chatApi } from "@/lib/support-chat-api";
export const runtime="nodejs";
export const GET=(request:Request)=>chatApi(request,true,undefined,true);
