import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db/pool";
import { createSessionToken, setSessionCookie } from "@/lib/db/session";
import { customerEmail, customerPhone, customerOtpHash } from "@/lib/customer-login";
import { hashPassword } from "@/lib/db/password";
import { lockCustomer } from "@/lib/customer-account";

export const runtime = "nodejs";
export async function POST(request: Request) {
  let email: string, phone: string, code: string, password: string;
  try {
    const body = await request.json(); email = customerEmail(body.email); phone = customerPhone(body.phone); code = String(body.code || "").trim();
    password=typeof body.password==="string"?body.password:"";
    if(password.length<10 || password.length>256)throw new Error("Set a password with 10 to 256 characters.");
    if (!/^\d{6}$/.test(code)) throw new Error("Enter the six-digit SMS verification code.");
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Check your verification details." }, { status: 400 }); }
  try {
    const hash = customerOtpHash(email,phone,code);
    const user = await withTransaction(async client => {
      const account = await lockCustomer(client,email,phone);
      const otpResult = await client.query<{ id: string; email: string; code_hash: string; full_name: string; attempts: number; used_at: string | null; valid: boolean }>(
        "SELECT id,email,code_hash,full_name,attempts,used_at,(expires_at>now()) AS valid FROM auth_otps WHERE phone=$1 ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE", [phone]);
      const otp = otpResult.rows[0];
      if (!otp || otp.used_at || !otp.valid || otp.attempts>=5 || otp.email!==email || otp.code_hash!==hash) {
        if (otp && !otp.used_at && otp.valid) await client.query("UPDATE auth_otps SET attempts=attempts+1 WHERE id=$1", [otp.id]);
        return null;
      }
      await client.query("UPDATE auth_otps SET used_at=now() WHERE id=$1", [otp.id]);
      const passwordHash=await hashPassword(password);
      let row;
      if (account) {
        row = (await client.query<{ id: string; email: string; phone: string; full_name: string;session_version:number }>(
          "UPDATE users SET email=$2,full_name=CASE WHEN $3<>'' THEN $3 ELSE full_name END,password_hash=$4 WHERE id=$1 RETURNING id,email,phone,full_name,session_version", [account.id,email,otp.full_name,passwordHash])).rows[0];
      } else {
        row = (await client.query<{ id: string; email: string; phone: string; full_name: string;session_version:number }>(
          "INSERT INTO users(email,phone,full_name,password_hash) VALUES($1,$2,$3,$4) RETURNING id,email,phone,full_name,session_version", [email,phone,otp.full_name,passwordHash])).rows[0];
      }
      await client.query("DELETE FROM auth_password_attempts WHERE email=$1",[email]);
      await client.query(`INSERT INTO profiles(user_id,phone,full_name) VALUES($1,$2,$3)
        ON CONFLICT(user_id) DO UPDATE SET phone=EXCLUDED.phone,full_name=EXCLUDED.full_name`, [row.id,row.phone,row.full_name]);
      return row;
    });
    if (!user) return NextResponse.json({ error: "Invalid or expired code. Request a new code and try again." }, { status: 400 });
    const token = createSessionToken(user.id,undefined,user.session_version); const publicUser={id:user.id,email:user.email,phone:user.phone,full_name:user.full_name}; const response = NextResponse.json({ user:publicUser,token }); setSessionCookie(response,token); return response;
  } catch (error) {
    if (error instanceof Error && error.message === "ACCOUNT_MISMATCH") return NextResponse.json({ error: "Use your registered email and phone number. Staff must use Staff login." }, { status: 409 });
    console.error("Customer OTP verification failed",error);
    return NextResponse.json({ error: "Could not verify the code. Please try again." }, { status: 503 });
  }
}
