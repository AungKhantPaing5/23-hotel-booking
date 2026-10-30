import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/client";
export const runtime = "nodejs";
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await createClient(); const { data: { user } } = await db.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const { id } = await params;
    const { data, error } = await db.from("payments").select("id,booking_id,amount,currency,provider,status,payment_type,provider_reference,created_at,paid_at").eq("id", id).eq("customer_id", user.id).maybeSingle();
    if (error || !data) return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    return NextResponse.json({ payment: data });
  } catch { return NextResponse.json({ error: "Could not read payment status." }, { status: 503 }); }
}
