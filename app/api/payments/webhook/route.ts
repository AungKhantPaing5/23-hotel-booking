import { NextResponse } from "next/server";
import { createDecipheriv, createHash, timingSafeEqual, createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/db/client";
import { createMMPayWebhookVerifier } from "@/lib/payments/provider";
export const runtime = "nodejs";

type ProviderEvent = { paymentId: string; status: "paid" | "failed" | "cancelled" | "pending"; amount: number; currency: string; reference: string; eventId: string; provider: "myanmyanpay_mmqr" | "dinger" };
function safeEqualHex(a: string, b: string) {
  if (!/^[a-f0-9]+$/i.test(a) || !/^[a-f0-9]+$/i.test(b) || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
function verifyDinger(body: any): ProviderEvent {
  const key = process.env.DINGER_CALLBACK_KEY;
  if (!key) throw new Error("DINGER_CALLBACK_KEY_NOT_CONFIGURED");
  if (typeof body?.paymentResult !== "string" || typeof body?.checksum !== "string") throw new Error("INVALID_DINGER_CALLBACK");
  const decipher = createDecipheriv("aes-256-ecb", Buffer.from(key, "utf8"), null);
  decipher.setAutoPadding(true);
  const plaintext = Buffer.concat([decipher.update(Buffer.from(body.paymentResult, "base64")), decipher.final()]).toString("utf8");
  const expected = createHash("sha256").update(plaintext).digest("hex");
  if (!safeEqualHex(body.checksum, expected)) throw new Error("INVALID_DINGER_CHECKSUM");
  const result = JSON.parse(plaintext);
  if (!result.merchantOrderId || !Number.isFinite(Number(result.totalAmount)) || !result.transactionStatus) throw new Error("INVALID_DINGER_RESULT");
  const status = String(result.transactionStatus).toUpperCase();
  const mapped = status === "SUCCESS" ? "paid" : status === "CANCELLED" ? "cancelled" : ["ERROR", "TIMEOUT", "DECLINED", "SYSTEM_ERROR"].includes(status) ? "failed" : "pending";
  return { paymentId: String(result.merchantOrderId), status: mapped, amount: Number(result.totalAmount), currency: "MMK", reference: String(result.transactionId || ""), eventId: `dinger:${result.merchantOrderId}:${status}:${result.transactionId || "no-ref"}`, provider: "dinger" };
}
export async function POST(req: Request) {
  try {
    const raw = await req.text();
    let body: any;
    try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid JSON callback." }, { status: 400 }); }
    let event: ProviderEvent;
    if (body?.paymentResult) {
      event = verifyDinger(body);
    } else if (body?.orderId && body?.status) {
      const nonce = req.headers.get("x-mmpay-nonce") || "";
      const signature = req.headers.get("x-mmpay-signature") || "";
      if (!nonce || !signature) return NextResponse.json({ error: "Missing MMQR callback signature." }, { status: 401 });
      const verifier = createMMPayWebhookVerifier();
      await verifier.listen(JSON.stringify(body), nonce, signature);
      const status = String(body.status).toUpperCase();
      const mapped = status === "SUCCESS" ? "paid" : ["FAILED", "EXPIRED"].includes(status) ? "failed" : status === "CANCELLED" || status === "REFUNDED" ? "cancelled" : "pending";
      event = { paymentId: String(body.orderId), status: mapped, amount: Number(body.amount), currency: String(body.currency || "MMK"), reference: String(body.transactionRefId || body.vendorQrRefId || ""), eventId: `mmpay:${body.orderId}:${status}:${body.transactionRefId || body.vendorQrRefId || "no-ref"}`, provider: "myanmyanpay_mmqr" };
    } else {
      const secret = process.env.PAYMENT_WEBHOOK_SECRET;
      const signature = req.headers.get("x-payment-signature") || "";
      if (!secret) return NextResponse.json({ error: "Unsupported payment callback." }, { status: 400 });
      const expected = createHmac("sha256", secret).update(raw).digest("hex");
      if (!safeEqualHex(signature, expected)) return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
      if (!body.event_id || !body.payment_id || !body.status) return NextResponse.json({ error: "Invalid event." }, { status: 400 });
      event = { paymentId: String(body.payment_id), status: ["paid", "failed", "cancelled"].includes(body.status) ? body.status : "pending", amount: Number(body.amount), currency: String(body.currency || "MMK"), reference: String(body.provider_reference || ""), eventId: String(body.event_id), provider: body.provider === "dinger" ? "dinger" : "myanmyanpay_mmqr" };
    }
    if (!event.paymentId || !Number.isFinite(event.amount) || event.amount <= 0) return NextResponse.json({ error: "Invalid payment callback fields." }, { status: 400 });
    const admin = createAdminClient();
    const { data: payment, error: readError } = await admin.from("payments").select("id,amount,currency,provider,status").eq("id", event.paymentId).maybeSingle();
    if (readError || !payment) return NextResponse.json({ error: "Payment record not found." }, { status: 404 });
    if (payment.provider !== event.provider) return NextResponse.json({ error: "Provider does not match payment record." }, { status: 409 });
    if (Math.round(Number(payment.amount) * 100) !== Math.round(event.amount * 100) || (payment.currency || "MMK") !== event.currency) return NextResponse.json({ error: "Payment amount or currency mismatch." }, { status: 409 });
    const { data: existing } = await admin.from("payment_webhook_events").select("event_id").eq("event_id", event.eventId).maybeSingle();
    if (!existing) {
      const { error: inserted } = await admin.from("payment_webhook_events").insert({ event_id: event.eventId, payment_id: event.paymentId, event_status: event.status });
      if (inserted) return NextResponse.json({ error: "Could not record event." }, { status: 409 });
    }
    if (payment.status === "pending" && event.status !== "pending") {
      const { error: updated } = await admin.from("payments").update({ status: event.status, provider_reference: event.reference || null, paid_at: event.status === "paid" ? new Date().toISOString() : null, failure_reason: event.status === "failed" ? "Payment provider reported failure." : null }).eq("id", event.paymentId).eq("status", "pending");
      if (updated) return NextResponse.json({ error: "Could not update payment status." }, { status: 500 });
    }
    return NextResponse.json({ received: true, duplicate: Boolean(existing) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "INVALID_CALLBACK";
    if (message.includes("NOT_CONFIGURED")) return NextResponse.json({ error: "Payment callback keys are not configured." }, { status: 503 });
    if (message.includes("INVALID") || message.includes("bad decrypt") || message.includes("Malformed")) return NextResponse.json({ error: "Payment callback could not be verified." }, { status: 401 });
    console.error("Payment webhook rejected or failed", error);
    return NextResponse.json({ error: "Payment webhook failed verification or processing." }, { status: 400 });
  }
}
