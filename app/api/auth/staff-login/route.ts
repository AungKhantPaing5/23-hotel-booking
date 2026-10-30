import { NextResponse } from "next/server";
import { query } from "@/lib/db/pool";
import { verifyPassword } from "@/lib/db/password";
import { createSessionToken, setSessionCookie } from "@/lib/db/session";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: unknown; password?: unknown };
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) return NextResponse.json({ error: "Enter your work email and password." }, { status: 400 });
    const result = await query<{ id: string; email: string; phone: string | null; full_name: string; password_hash: string | null; role: string; is_active: boolean; is_enabled: boolean; session_version: number }>(
      `SELECT u.id,u.email,u.phone,u.full_name,u.password_hash,u.is_enabled,u.session_version,sp.role,sp.is_active
       FROM users u JOIN staff_profiles sp ON sp.user_id=u.id
       WHERE lower(u.email)=lower($1) LIMIT 1`, [email]
    );
    const user = result.rows[0];
    if (!user || !user.is_enabled || !user.is_active || !(await verifyPassword(password, user.password_hash))) return NextResponse.json({ error: "Invalid login credentials." }, { status: 401 });
    const token = createSessionToken(user.id, Number(process.env.STAFF_SESSION_MAX_AGE_SECONDS || 60 * 60 * 8),user.session_version);
    const response = NextResponse.json({ user: { id: user.id, email: user.email, phone: user.phone, full_name: user.full_name, role: user.role }, token });
    setSessionCookie(response, token, Number(process.env.STAFF_SESSION_MAX_AGE_SECONDS || 60 * 60 * 8));
    return response;
  } catch (error) {
    console.error("Staff login failed", error);
    return NextResponse.json({ error: "Staff login is unavailable. Confirm Docker PostgreSQL is running and the account was created." }, { status: 500 });
  }
}
