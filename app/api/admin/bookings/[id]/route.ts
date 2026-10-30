import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/auth";
import { roomNumberSchema } from "@/lib/room-inventory";
import { sendSms } from "@/lib/notifications/sms";

const bodySchema = z.object({
  status: z.enum(["confirmed", "rejected", "cancelled", "checked_in", "checked_out"]),
  roomNumber: roomNumberSchema.optional(),
});
const allowed: Record<string, string[]> = {
  pending: ["confirmed", "rejected"], confirmed: ["checked_in", "cancelled"], checked_in: ["checked_out"],
};
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { hotelDb } = await requireStaffApi(["super_admin", "manager", "receptionist"]);
    const { id } = await params;
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid booking status or room number." }, { status: 400 });
    const { data: booking, error: readError } = await hotelDb.from("bookings")
      .select("id,status,booking_code,check_in,customer_id,assigned_room_number,profiles(phone,full_name)").eq("id", id).maybeSingle();
    if (readError || !booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    const roomNumber = booking.assigned_room_number || parsed.data.roomNumber;
    if (parsed.data.status === "checked_in" && !roomNumber) return NextResponse.json({error:"Choose the room number for this legacy reservation."},{status:400});
    if (booking.assigned_room_number && parsed.data.roomNumber && parsed.data.roomNumber!==booking.assigned_room_number) return NextResponse.json({error:"Keep the room number selected by the customer."},{status:409});
    if (!allowed[booking.status]?.includes(parsed.data.status)) return NextResponse.json({ error: `Cannot change ${booking.status} to ${parsed.data.status}.` }, { status: 409 });
    const { data: updated, error } = await hotelDb.rpc("transition_booking_status", {
      p_booking_id: id, p_expected_status: booking.status, p_new_status: parsed.data.status,
      p_actor_id: (await hotelDb.auth.getUser()).data.user?.id, p_room_number: roomNumber || null,
    });
    if (error) {
      if (error.message.includes("ROOM_ALREADY_ASSIGNED") || error.code === "23505") return NextResponse.json({ error: "That room number is already assigned to another checked-in guest." }, { status: 409 });
      if (error.message.includes("ROOM_NUMBER_REQUIRED")) return NextResponse.json({ error: "Room number is required for check-in." }, { status: 400 });
      return NextResponse.json({ error: "Could not update booking. Refresh and retry." }, { status: 409 });
    }
    const guest = Array.isArray(booking.profiles) ? booking.profiles[0] : booking.profiles;
    const phone = guest?.phone;
    if (phone) {
      const message = parsed.data.status === "confirmed"
        ? `23 Hotel & Residence: booking ${booking.booking_code} is confirmed. Check-in: ${booking.check_in}.`
        : parsed.data.status === "rejected"
          ? `23 Hotel & Residence: booking ${booking.booking_code} could not be confirmed. Please contact reception.`
          : parsed.data.status === "checked_in"
            ? `23 Hotel & Residence: check-in complete for ${booking.booking_code}. Room: ${roomNumber}.`
            : `23 Hotel & Residence: booking ${booking.booking_code} status updated to ${parsed.data.status.replaceAll("_", " ")}.`;
      const sms = await sendSms(phone, message);
      await hotelDb.from("notification_logs").insert({ user_id: booking.customer_id, booking_id: id, channel: "sms", template_key: `booking_${parsed.data.status}`, recipient: phone, status: sms.sent ? "sent" : "failed", provider_message_id: sms.providerMessageId, error_message: sms.reason || null });
    }
    return NextResponse.json({ booking: updated, notification: "SMS is attempted when configured; delivery depends on the provider." });
  } catch (e) { if (e instanceof Response) return e; return NextResponse.json({ error: "Unexpected server error." }, { status: 500 }); }
}
