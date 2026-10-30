"use client";
import { useState } from "react";
import { CreditCard, LoaderCircle, QrCode, RefreshCw } from "lucide-react";
import { money } from "@/lib/format";

type Method = "mmqr" | "wallets_cards";
export function DepositPaymentButton({ bookingId, totalAmount, currency = "MMK" }: { bookingId: string; totalAmount: number; currency?: string }) {
  const percentRaw = Number(process.env.NEXT_PUBLIC_BOOKING_DEPOSIT_PERCENT || "30");
  const percent = Number.isFinite(percentRaw) ? Math.min(100, Math.max(1, percentRaw)) : 30;
  const deposit = Math.ceil(totalAmount * percent / 100);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState(""); const [qrText, setQrText] = useState(""); const [paymentId, setPaymentId] = useState(""); const [paymentStatus, setPaymentStatus] = useState("");
  async function pay(method: Method) {
    setBusy(true); setMessage(""); setQrDataUrl(""); setQrText(""); setPaymentId(""); setPaymentStatus("");
    try {
      const response = await fetch("/api/payments/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookingId, method }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Payment could not start.");
      if (typeof data.checkoutUrl === "string") { window.location.assign(data.checkoutUrl); return; }
      if (typeof data.qrDataUrl === "string" && typeof data.paymentId === "string") {
        setQrDataUrl(data.qrDataUrl); setQrText(data.qrText || ""); setPaymentId(data.paymentId); setPaymentStatus("pending"); return;
      }
      throw new Error("The payment provider returned an incomplete checkout response.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not connect to the payment service."); }
    finally { setBusy(false); }
  }
  async function checkStatus() {
    if (!paymentId) return; setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/payments/${encodeURIComponent(paymentId)}`); const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not check payment status.");
      setPaymentStatus(data.payment.status);
      if (data.payment.status === "paid") setMessage("Deposit payment has been verified. Refresh this page to update your booking.");
      else if (data.payment.status === "pending") setMessage("Payment is still pending. Complete the QR payment, then check again.");
      else setMessage(`Payment status: ${String(data.payment.status).replaceAll("_", " ")}. You can start another payment attempt if appropriate.`);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not check payment status."); }
    finally { setBusy(false); }
  }
  return <div className="mt-4 grid max-w-lg gap-3">
    <p className="text-sm font-semibold">Deposit required: {percent}% · {money(deposit, currency)}</p>
    <div className="grid gap-2 sm:grid-cols-2">
      <button type="button" onClick={() => pay("mmqr")} disabled={busy || deposit <= 0} className="btn btn-primary inline-flex items-center justify-center gap-2">
        {busy ? <LoaderCircle size={16} className="animate-spin" /> : <QrCode size={16} />} Pay by MMQR
      </button>
      <button type="button" onClick={() => pay("wallets_cards")} disabled={busy || deposit <= 0} className="btn btn-outline inline-flex items-center justify-center gap-2">
        {busy ? <LoaderCircle size={16} className="animate-spin" /> : <CreditCard size={16} />} Wallets / bank / cards
      </button>
    </div>
    {qrDataUrl && <div className="panel grid justify-items-center gap-3 p-5 text-center">
      <h3 className="serif text-xl">Scan to pay your deposit</h3><p className="text-xs leading-5 text-[#6f7886]">Open an MMQR-compatible banking or wallet app and scan this QR. Keep the amount equal to the deposit shown above.</p>
      <img src={qrDataUrl} alt="Deposit payment MMQR code" width={280} height={280} className="h-auto w-full max-w-[280px] rounded-xl bg-white p-2" />
      <p className="text-sm font-bold">{money(deposit, currency)}</p>
      <button type="button" onClick={checkStatus} disabled={busy} className="btn btn-primary inline-flex items-center gap-2">{busy ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCw size={15} />} Check payment status</button>
      {paymentStatus && <p className="text-xs font-semibold capitalize">Status: {paymentStatus.replaceAll("_", " ")}</p>}
    </div>}
    {message && <p role="status" className="text-xs leading-5 text-amber-800">{message}</p>}
    <p className="text-[11px] leading-5 text-[#6f7886]">Wallets and card options shown on the hosted checkout depend on the hotel&apos;s approved merchant account. A deposit is marked paid only after the provider verifies the transaction callback.</p>
  </div>;
}
