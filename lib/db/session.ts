import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import type { NextResponse } from "next/server";
import { query } from "@/lib/db/pool";

export type AppUser = {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string;
  user_metadata: { full_name: string };
};

const COOKIE_NAME = "23hotel_session";
const DEV_SECRET = "local-only-change-this-session-secret-before-deployment-23hotel";
function secret() {
  const value = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production" && (!value || value.length < 32 || (value === DEV_SECRET || value.startsWith("local-dev-") || value.includes("replace-this")))) {
    throw new Error("Set SESSION_SECRET to a unique random value of at least 32 characters in production.");
  }
  return value || DEV_SECRET;
}
function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}
export function createSessionToken(userId: string, maxAgeSeconds = Number(process.env.SESSION_MAX_AGE_SECONDS || 60 * 60 * 24 * 7)) {
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + maxAgeSeconds, v: 1 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
function verifyToken(token: string): { sub: string; exp: number; v: number } | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature || token.split(".").length !== 2) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: string; exp?: number; v?: number };
    if (typeof decoded.sub !== "string" || !/^[a-f0-9-]{36}$/i.test(decoded.sub) || typeof decoded.exp !== "number" || !Number.isFinite(decoded.exp) || decoded.exp <= Math.floor(Date.now() / 1000) || decoded.v !== 1) return null;
    return decoded as { sub: string; exp: number; v: number };
  } catch {
    return null;
  }
}
export function setSessionCookie(response: NextResponse, token: string, maxAgeSeconds = Number(process.env.SESSION_MAX_AGE_SECONDS || 60 * 60 * 24 * 7)) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}
export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}

export async function getSessionToken(): Promise<string | null> {
  const headerStore = await headers();
  const authorization = headerStore.get("authorization") || "";
  if (authorization.startsWith("Bearer ")) return authorization.slice(7).trim() || null;
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value || null;
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const token = await getSessionToken();
  if (!token) return null;
  const parsed = verifyToken(token);
  if (!parsed) return null;
  const result = await query<{ id: string; email: string | null; phone: string | null; full_name: string; is_enabled: boolean }>(
    "SELECT id, email, phone, full_name, is_enabled FROM users WHERE id = $1 LIMIT 1", [parsed.sub]
  );
  const row = result.rows[0];
  if (!row || !row.is_enabled) return null;
  return { id: row.id, email: row.email, phone: row.phone, full_name: row.full_name, user_metadata: { full_name: row.full_name } };
}

export async function getCurrentUserByToken(token: string): Promise<AppUser | null> {
  const parsed = verifyToken(token);
  if (!parsed) return null;
  const result = await query<{ id: string; email: string | null; phone: string | null; full_name: string; is_enabled: boolean }>(
    "SELECT id, email, phone, full_name, is_enabled FROM users WHERE id = $1 LIMIT 1", [parsed.sub]
  );
  const row = result.rows[0];
  if (!row || !row.is_enabled) return null;
  return { id: row.id, email: row.email, phone: row.phone, full_name: row.full_name, user_metadata: { full_name: row.full_name } };
}
