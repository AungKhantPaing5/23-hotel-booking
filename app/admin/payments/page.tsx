import { requireStaff } from "@/lib/auth";
import { money, dateLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Payments() {
  const { hotelDb, staff } = await requireStaff(["super_admin", "manager", "accountant"]);
  const fullFinanceAccess = staff.role === "super_admin" || staff.role === "manager";
  let data: any[] | null = null;
  let error: { message: string } | null = null;
  if (fullFinanceAccess) {
    const result = await hotelDb.from("payments")
      .select("id,amount,currency,status,provider,provider_reference,payment_type,created_at,booking_id,bookings(booking_code,profiles(full_name,phone))")
      .order("created_at", { ascending: false }).limit(300);
    data = result.data as any[] | null;
    error = result.error;
  } else {
    const result = await hotelDb.from("payments")
      .select("id,amount,currency,status,provider,provider_reference,payment_type,created_at,booking_id")
      .order("created_at", { ascending: false }).limit(300);
    data = result.data as any[] | null;
    error = result.error;
  }

  return <><p className="eyebrow">FINANCE</p><h1 className="serif mt-2 text-3xl">Payment history</h1><p className="mt-2 text-sm text-[#6f7886]">{fullFinanceAccess ? "Provider references and recorded payment statuses. Reconcile against merchant statements." : "Finance-only view: payment status, provider reference and amount. Customer profile and reservation details are restricted."}</p>
    {error && <p role="alert" className="mt-4 text-sm text-red-700">Could not load payment history: {error.message}</p>}
    <div className="panel mt-6"><div className="table-wrap"><table className="data-table"><thead><tr><th>Payment date</th><th>Booking / guest</th><th>Payment type</th><th>Provider</th><th>Reference</th><th>Amount</th><th>Status</th></tr></thead><tbody>
      {(data || []).map((payment: any) => <tr key={payment.id}><td>{dateLabel(payment.created_at)}</td><td>{fullFinanceAccess ? (payment.bookings?.booking_code || "—") : `Ref ${String(payment.booking_id).slice(0, 8)}`}<span className="block text-[10px] text-[#6f7886]">{fullFinanceAccess ? (payment.bookings?.profiles?.full_name || payment.bookings?.profiles?.phone || "Guest") : "Booking reference (limited access)"}</span></td><td>{payment.payment_type === "booking_deposit" ? "Booking deposit" : (payment.payment_type || "Payment")}</td><td>{payment.provider}</td><td>{payment.provider_reference || "—"}</td><td>{money(Number(payment.amount), payment.currency || "MMK")}</td><td><span className={`status ${payment.status}`}>{payment.status}</span></td></tr>)}
      {(!data || data.length === 0) && <tr><td colSpan={7} className="py-10 text-center text-[#6f7886]">No payment records yet.</td></tr>}
    </tbody></table></div></div>
  </>;
}
