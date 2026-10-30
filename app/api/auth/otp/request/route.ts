import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db/pool";
import { sendSms } from "@/lib/notifications/sms";
import { customerEmail, customerPhone, customerOtpHash } from "@/lib/customer-login";
import { lockCustomer } from "@/lib/customer-account";

export const runtime = "nodejs";
export async function POST(request: Request) {
  let email: string, phone: string, fullName: string;
  try {
    const body = await request.json();
    email = customerEmail(body.email); phone = customerPhone(body.phone);
    fullName = String(body.fullName || "").trim().slice(0,100);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Check your email and phone number." }, { status: 400 }); }
  try {
    const developmentMode = process.env.AUTH_OTP_MODE !== "production" && process.env.NODE_ENV !== "production";
    const code = developmentMode ? (process.env.DEV_OTP_CODE || "123456") : String(randomInt(100000,1000000));
    const codeHash = customerOtpHash(email, phone, code);
    const result = await withTransaction(async client => {
      await lockCustomer(client,email,phone);
      const recent = await client.query<{ count: string }>("SELECT count(*)::text AS count FROM auth_otps WHERE phone=$1 AND created_at>now()-interval '15 minutes'", [phone]);
      if (Number(recent.rows[0]?.count || 0)>=5) return null;
      return (await client.query<{ id: string }>("INSERT INTO auth_otps(email,phone,code_hash,full_name,expires_at) VALUES($1,$2,$3,$4,now()+interval '10 minutes') RETURNING id", [email,phone,codeHash,fullName])).rows[0];
    });
    if (!result) return NextResponse.json({ error: "Too many codes requested. Try again in 15 minutes." }, { status: 429 });
    if (!developmentMode) {
      const sent = await sendSms(phone, `23 Hotel & Residence verification code: ${code}. Expires in 10 minutes.`);
      if (!sent.sent) {
        await withTransaction(client => client.query("UPDATE auth_otps SET used_at=now() WHERE id=$1", [result.id]));
        return NextResponse.json({ error: "Could not send SMS. Please try again or contact reception." }, { status: 503 });
      }
    }
    return NextResponse.json({ sent: true, message: "Enter the code sent to your phone.", ...(developmentMode ? { developmentCode: code } : {}) });
  } catch (error) {
    if (error instanceof Error && error.message === "ACCOUNT_MISMATCH") return NextResponse.json({ error: "These details cannot be used for customer login. Use your registered email and phone number. Staff must use Staff login." }, { status: 409 });
    console.error("Customer OTP request failed",error);
    return NextResponse.json({ error: "Could not request a code. Please contact reception if the problem continues." }, { status: 503 });
  }
}
