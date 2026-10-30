import { chatApi } from "@/lib/support-chat-api";
export const runtime="nodejs";
export const GET=(request:Request)=>chatApi(request);
export const POST=(request:Request)=>chatApi(request);
export const PATCH=(request:Request)=>chatApi(request);
