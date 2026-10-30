import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db/pool";
import { createSessionToken, setSessionCookie } from "@/lib/db/session";

export const runtime = "nodejs";
const codeHash = (phone: string, code: string) => createHash("sha256").update(`${process.env.OTP_SECRET || process.env.SESSION_SECRET || "local-otp-salt"}:${phone}:${code}`).digest("hex");

export async function POST(request: Request) {
  try {
    const body = await request.json() as { phone?: unknown; code?: unknown };
    const phone = String(body.phone || "").replace(/[\s()-]/g, "");
    const code = String(body.code || "").trim();
    if (!/^\+[1-9]\d{7,14}$/.test(phone) || !/^\d{4,8}$/.test(code)) return NextResponse.json({ error: "Enter your phone number and verification code." }, { status: 400 });

    const user = await withTransaction(async client => {
      const otpResult = await client.query<{ id: string; code_hash: string; full_name: string; attempts: number; used_at: string | null; valid: boolean }>(
        "SELECT id,code_hash,full_name,attempts,used_at,(expires_at>now()) AS valid FROM auth_otps WHERE phone=$1 ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE", [phone]
      );
      const otp = otpResult.rows[0];
      if (!otp || otp.used_at || !otp.valid || otp.attempts >= 5 || otp.code_hash !== codeHash(phone, code)) {
        if (otp && !otp.used_at && otp.valid) await client.query("UPDATE auth_otps SET attempts=attempts+1 WHERE id=$1", [otp.id]);
        return null;
      }
      await client.query("UPDATE auth_otps SET used_at=now() WHERE id=$1", [otp.id]);
      const created = await client.query<{ id: string; email: string | null; phone: string; full_name: string }>(
        `INSERT INTO users(phone,full_name) VALUES($1,$2)
         ON CONFLICT(phone) DO UPDATE SET full_name=CASE WHEN EXCLUDED.full_name<>'' THEN EXCLUDED.full_name ELSE users.full_name END
         RETURNING id,email,phone,full_name`, [phone, otp.full_name]
      );
      const row = created.rows[0];
      await client.query(
        `INSERT INTO profiles(user_id,phone,full_name) VALUES($1,$2,$3)
         ON CONFLICT(user_id) DO UPDATE SET phone=EXCLUDED.phone,full_name=CASE WHEN EXCLUDED.full_name<>'' THEN EXCLUDED.full_name ELSE profiles.full_name END`,
        [row.id, phone, row.full_name]
      );
      return row;
    });
    if (!user) return NextResponse.json({ error: "The verification code is invalid or expired. Request a new code and try again." }, { status: 400 });
    const token = createSessionToken(user.id);
    const response = NextResponse.json({ user: { id: user.id, email: user.email, phone: user.phone, full_name: user.full_name }, token });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error("OTP verification failed", error);
    return NextResponse.json({ error: "Could not verify the code. Confirm the Docker database is running." }, { status: 500 });
  }
}
