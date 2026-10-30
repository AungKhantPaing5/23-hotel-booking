import { NextResponse } from "next/server";
import { customerPasswordLogin } from "@/lib/customer-password";
import { createSessionToken,setSessionCookie } from "@/lib/db/session";
export const runtime="nodejs";
export async function POST(request:Request) {
  let body;
  try {body=await request.json();if(typeof body.password!=="string")throw new Error();}
  catch{return NextResponse.json({error:"Enter your email and password."},{status:400});}
  try {
    const result=await customerPasswordLogin(body.email,body.password);
    if(result.status!==200 || !result.user)return NextResponse.json({error:result.error},{status:result.status});
    const {session_version,...user}=result.user;
    const token=createSessionToken(user.id,undefined,session_version);
    const response=NextResponse.json({user,token},{headers:{"Cache-Control":"no-store"}});setSessionCookie(response,token);return response;
  }catch(error){
    if(error instanceof Error && error.message==="Enter a valid email address.")return NextResponse.json({error:error.message},{status:400});
    console.error("Customer password login failed",error);return NextResponse.json({error:"Sign in is unavailable. Confirm database migration 008 is applied."},{status:503});
  }
}
