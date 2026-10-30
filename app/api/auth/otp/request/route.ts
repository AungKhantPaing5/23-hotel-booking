import { randomInt, createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { query } from "@/lib/db/pool";
import { sendSms } from "@/lib/notifications/sms";

export const runtime = "nodejs";
const codeHash = (phone: string, code: string) => createHash("sha256").update(`${process.env.OTP_SECRET || process.env.SESSION_SECRET || "local-otp-salt"}:${phone}:${code}`).digest("hex");

export async function POST(request: Request) {
  try {
    const body = await request.json() as { phone?: unknown; fullName?: unknown };
    const phone = String(body.phone || "").replace(/[\s()-]/g, "");
    const fullName = String(body.fullName || "").trim().slice(0, 100);
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) return NextResponse.json({ error: "Enter a phone number in international format, for example +959xxxxxxxxx." }, { status: 400 });
    const recent = await query<{ count: string }>("SELECT count(*)::text AS count FROM auth_otps WHERE phone=$1 AND created_at > now() - interval '15 minutes'", [phone]);
    if (Number(recent.rows[0]?.count || 0) >= 5) return NextResponse.json({ error: "Too many codes requested. Please try again in 15 minutes." }, { status: 429 });

    const developmentMode = process.env.AUTH_OTP_MODE !== "production" && process.env.NODE_ENV !== "production";
    const code = developmentMode ? (process.env.DEV_OTP_CODE || "123456") : String(randomInt(100000, 1000000));
    await query("INSERT INTO auth_otps(phone,code_hash,full_name,expires_at) VALUES($1,$2,$3,now()+interval '10 minutes')", [phone, codeHash(phone, code), fullName]);

    if (!developmentMode) {
      const sent = await sendSms(phone, `23 Hotel & Residence verification code: ${code}. This code expires in 10 minutes.`);
      if (!sent.sent) return NextResponse.json({ error: "Could not send a verification SMS. Configure SMS_API_URL and SMS_API_KEY before using phone login." }, { status: 503 });
    } else {
      console.info(`[LOCAL OTP] ${phone}: ${code} (development only)`);
    }
    return NextResponse.json({ sent: true, message: developmentMode ? "Local development mode: use the verification code shown below." : "A verification code has been sent.", ...(developmentMode ? { developmentCode: code } : {}) });
  } catch (error) {
    console.error("OTP request failed", error);
    return NextResponse.json({ error: "Could not request a verification code. Confirm the Docker database is running." }, { status: 500 });
  }
}
