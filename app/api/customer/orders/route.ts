import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/db/client";
export const runtime = "nodejs";
const schema = z.object({ serviceId: z.string().uuid(), quantity: z.coerce.number().int().min(1).max(20), note: z.string().trim().max(1000).default(""), bookingId: z.string().uuid() });
export async function GET() {
  try {
    const db = await createClient(); const { data: { user } } = await db.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in to view service orders." }, { status: 401 });
    const result = await db.from("service_orders").select("id,booking_id,quantity,status,customer_note,created_at,services(name,price,category),bookings(booking_code,assigned_room_number,rooms(name))").eq("customer_id", user.id).order("created_at", { ascending: false }).limit(100);
    if (result.error) return NextResponse.json({ error: "Could not load service orders." }, { status: 500 });
    return NextResponse.json({ orders: result.data || [] });
  } catch (error) { console.error("Customer orders fetch failed", error); return NextResponse.json({ error: "Database unavailable." }, { status: 503 }); }
}
export async function POST(request: Request) {
  try {
    const db = await createClient(); const { data: { user } } = await db.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in before ordering." }, { status: 401 });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Choose one of your confirmed bookings and check the quantity/details." }, { status: 400 });
    const booking = await db.from("bookings").select("id,status,booking_code,assigned_room_number").eq("id", parsed.data.bookingId).eq("customer_id", user.id).maybeSingle();
    if (booking.error || !booking.data) return NextResponse.json({ error: "Choose a booking that belongs to your account." }, { status: 404 });
    if (!["confirmed", "checked_in"].includes(booking.data.status)) return NextResponse.json({ error: "You can request services/deals only after the hotel confirms your booking." }, { status: 409 });
    const service = await db.from("services").select("id").eq("id", parsed.data.serviceId).eq("is_active", true).maybeSingle();
    if (service.error || !service.data) return NextResponse.json({ error: "This service or deal is not available." }, { status: 404 });
    const result = await db.from("service_orders").insert({ customer_id: user.id, service_id: parsed.data.serviceId, booking_id: parsed.data.bookingId, quantity: parsed.data.quantity, customer_note: parsed.data.note, status: "pending" }).select("id,status,booking_id").single();
    if (result.error) return NextResponse.json({ error: "Could not place the service/deal request." }, { status: 500 });
    return NextResponse.json({ order: result.data }, { status: 201 });
  } catch (error) { console.error("Customer order create failed", error); return NextResponse.json({ error: "Database unavailable." }, { status: 503 }); }
}
