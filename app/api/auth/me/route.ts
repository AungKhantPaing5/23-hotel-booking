import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/db/session";
export const runtime = "nodejs";
export async function GET() {
  try { const user = await getCurrentUser(); return user ? NextResponse.json({ user }, { headers: { "Cache-Control": "private, no-store" } }) : NextResponse.json({ error: "Not signed in." }, { status: 401, headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { console.error("Current session lookup failed", error); return NextResponse.json({ error: "Database is not available." }, { status: 503 }); }
}
