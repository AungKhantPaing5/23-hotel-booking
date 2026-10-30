import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/client";
export const runtime = "nodejs";
export async function GET() {
  try {
    const db = await createClient(); const { data: { user } } = await db.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in to view requests." }, { status: 401 });
    const result = await db.from("customer_requests").select("id,subject,status,created_at").eq("customer_id", user.id).order("created_at", { ascending: false }).limit(20);
    if (result.error) return NextResponse.json({ error: "Could not load requests." }, { status: 500 });
    return NextResponse.json({ requests: result.data || [] });
  } catch (error) { console.error("Customer requests fetch failed", error); return NextResponse.json({ error: "Database unavailable." }, { status: 503 }); }
}
