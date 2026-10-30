import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/db/session";
export const runtime = "nodejs";
export async function GET() {
  try { const user = await getCurrentUser(); return user ? NextResponse.json({ user }) : NextResponse.json({ error: "Not signed in." }, { status: 401 }); }
  catch (error) { console.error("Current session lookup failed", error); return NextResponse.json({ error: "Database is not available." }, { status: 503 }); }
}
