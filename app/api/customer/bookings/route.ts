import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/client";
export const runtime = "nodejs";
export async function GET() {
  try {
    const db = await createClient(); const { data: { user } } = await db.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in to view bookings." }, { status: 401 });
    const [bookings, payments] = await Promise.all([
      db.from("bookings").select("id,booking_code,check_in,check_out,guests,status,total_amount,assigned_room_number,created_at,rooms(name)").eq("customer_id", user.id).order("created_at", { ascending: false }).limit(100),
      db.from("payments").select("id,amount,currency,status,provider,provider_reference,payment_type,created_at,bookings(booking_code)").eq("customer_id", user.id).order("created_at", { ascending: false }).limit(50),
    ]);
    if (bookings.error || payments.error) return NextResponse.json({ error: "Could not load booking history." }, { status: 500 });
    return NextResponse.json({ bookings: bookings.data || [], payments: payments.data || [] });
  } catch (error) { console.error("Customer bookings fetch failed", error); return NextResponse.json({ error: "Database unavailable." }, { status: 503 }); }
}
