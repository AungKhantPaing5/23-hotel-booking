import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/db/client";
import { createCheckout, paymentMethodConfigured, type PaymentMethod } from "@/lib/payments/provider";

export const runtime = "nodejs";
const schema = z.object({ bookingId: z.string().uuid(), method: z.enum(["mmqr", "wallets_cards"]) });
function depositConfig() {
  const raw = Number(process.env.BOOKING_DEPOSIT_PERCENT || "30");
  return Number.isFinite(raw) ? Math.min(100, Math.max(1, raw)) : 30;
}
export async function POST(req: Request) {
  let depositAmount = 0; const depositPercent = depositConfig();
  try {
    const hotelDb = await createClient();
    const { data: { user } } = await hotelDb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Choose a valid payment method and booking." }, { status: 400 });
    const method: PaymentMethod = parsed.data.method;
    const { data: booking, error: readError } = await hotelDb.from("bookings")
      .select("id,booking_code,total_amount,currency,status,profiles(phone,full_name)")
      .eq("id", parsed.data.bookingId).eq("customer_id", user.id).maybeSingle();
    if (readError || !booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    if (booking.status !== "confirmed") return NextResponse.json({ error: "The hotel must confirm this booking before a deposit can be paid." }, { status: 409 });
    if (!paymentMethodConfigured(method)) {
      const gateway = method === "mmqr" ? "MyanMyanPay MMQR" : "Dinger hosted wallet/bank/card checkout";
      return NextResponse.json({ error: `${gateway} is not configured. Add the approved merchant credentials to .env.local, set the public HTTPS callback/return URLs, and test using the provider's sandbox first.`, depositPercent, paymentConfigured: false }, { status: 503 });
    }
    depositAmount = Math.ceil(Number(booking.total_amount) * depositPercent / 100);
    if (!Number.isFinite(depositAmount) || depositAmount <= 0) return NextResponse.json({ error: "This booking has no payable deposit amount." }, { status: 400 });
    if ((booking.currency || "MMK") !== "MMK") return NextResponse.json({ error: "This gateway configuration supports MMK deposits only. Contact the hotel before using another currency." }, { status: 400 });
    const { data: alreadyPaid } = await hotelDb.from("payments").select("id").eq("booking_id", booking.id).eq("customer_id", user.id).eq("payment_type", "booking_deposit").eq("status", "paid").limit(1).maybeSingle();
    if (alreadyPaid) return NextResponse.json({ error: "A deposit for this booking is already recorded as paid." }, { status: 409 });

    const provider = method === "mmqr" ? "myanmyanpay_mmqr" : "dinger";
    const { data: payment, error: payError } = await hotelDb.from("payments").insert({ booking_id: booking.id, customer_id: user.id, amount: depositAmount, currency: booking.currency || "MMK", provider, payment_type: "booking_deposit", status: "pending" }).select("id").single();
    if (payError?.code === "23505") return NextResponse.json({ error: "A deposit checkout already exists. Check its status or contact reception before retrying." }, { status: 409 });
    if (payError || !payment) return NextResponse.json({ error: "Could not create deposit payment record." }, { status: 400 });
    try {
      const guest = Array.isArray(booking.profiles) ? booking.profiles[0] : booking.profiles;
      const checkout = await createCheckout({ paymentId: payment.id, bookingId: booking.id, amount: depositAmount, currency: booking.currency || "MMK", customerPhone: guest?.phone || "", customerName: guest?.full_name || user.email || "Hotel Guest", customerEmail: user.email || "", description: `23 Hotel booking deposit ${booking.booking_code}` }, method);
      await hotelDb.from("payments").update({ provider_reference: checkout.providerReference }).eq("id", payment.id);
      if (checkout.method === "mmqr") return NextResponse.json({ method: checkout.method, paymentId: payment.id, qrDataUrl: checkout.qrDataUrl, qrText: checkout.qrText, depositAmount, depositPercent, currency: booking.currency || "MMK", paymentConfigured: true });
      return NextResponse.json({ method: checkout.method, paymentId: payment.id, checkoutUrl: checkout.checkoutUrl, depositAmount, depositPercent, currency: booking.currency || "MMK", paymentConfigured: true });
    } catch (error) {
      await hotelDb.from("payments").update({ status: "failed", failure_reason: error instanceof Error ? error.message : "Provider adapter unavailable" }).eq("id", payment.id);
      console.error("Deposit checkout provider error", error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Payment provider unavailable", depositAmount, depositPercent, paymentConfigured: false }, { status: 503 });
    }
  } catch (error) {
    console.error("Deposit checkout failed", error);
    return NextResponse.json({ error: "Unexpected server error.", depositAmount, depositPercent }, { status: 500 });
  }
}
