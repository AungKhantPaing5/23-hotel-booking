import Link from "next/link";
import { CalendarDays, Clock3, CreditCard, ArrowUpRight, ConciergeBell, ChefHat, Tags, CheckCircle2, type LucideIcon } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { money, dateLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

function Stat({ label, value, icon: Icon }: { label: string; value: string | number; icon: LucideIcon }) {
  return <div className="panel p-5"><div className="flex items-center justify-between"><p className="text-xs text-[#6f7886]">{label}</p><Icon size={18} className="text-[#977444]" /></div><p className="serif mt-4 text-4xl">{value}</p></div>;
}

export default async function AdminHome() {
  const { hotelDb, staff, user } = await requireStaff();

  // Work-role dashboard: never show hotel revenue, bookings or guest-wide
  // information to Kitchen/Deals staff. The server-side role guard scopes this list by category
  // and to unclaimed or this employee's own claimed orders.
  if (["kitchen_staff", "deals_staff", "order_staff", "service_staff"].includes(staff.role)) {
    const { data: orders, error } = await hotelDb.from("service_orders")
      .select("id,status,created_at,customer_note,assigned_to,services(name,category)")
      .order("created_at", { ascending: false }).limit(20);
    const rows = orders || [];
    const label = staff.role === "deals_staff" ? "Deals" : staff.role === "service_staff" ? "Hotel service" : "Kitchen";
    const unclaimed = rows.filter((order: any) => !order.assigned_to && order.status === "pending").length;
    const inProgress = rows.filter((order: any) => ["accepted", "processing"].includes(order.status) && (!order.assigned_to || order.assigned_to === user.id)).length;
    return <>
      <p className="eyebrow">MY WORK QUEUE</p><h1 className="serif mt-2 text-3xl">Good day, {staff.display_name || "team member"}.</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f7886]">This workspace is restricted to your {label.toLowerCase()} queue. Accepting an unassigned order claims it for your account so other employees cannot continue it.</p>
      <div className="mt-7 grid gap-4 sm:grid-cols-2"><Stat label="Unclaimed pending orders" value={unclaimed} icon={Clock3}/><Stat label="Active work" value={inProgress} icon={CheckCircle2}/></div>
      <section className="panel mt-7"><div className="flex items-center justify-between p-5"><div><h2 className="serif text-2xl">Latest {label.toLowerCase()} orders</h2><p className="mt-1 text-xs text-[#6f7886]">Only the category your role is allowed to process.</p></div><Link href="/admin/orders" className="text-xs font-semibold">Open work queue →</Link></div>
        {error && <p className="px-5 pb-4 text-sm text-red-700">Could not load your queue: {error.message}</p>}
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Category</th><th>Created</th><th>Status</th></tr></thead><tbody>{rows.slice(0, 6).map((order: any) => <tr key={order.id}><td className="whitespace-normal font-semibold">{order.services?.name || "Service order"}<span className="mt-1 block text-xs font-normal text-[#6f7886]">{order.customer_note || "No additional request"}</span></td><td>{order.services?.category}</td><td>{dateLabel(order.created_at)}</td><td><span className={`status ${order.status}`}>{order.status}</span></td></tr>)}{rows.length === 0 && <tr><td colSpan={4} className="py-10 text-center text-[#6f7886]">No orders in your work queue.</td></tr>}</tbody></table></div>
      </section>
    </>;
  }

  if (staff.role === "accountant") {
    const { data: payments, error } = await hotelDb.from("payments").select("id,amount,status,provider,created_at,currency").order("created_at", { ascending: false }).limit(200);
    const rows = payments || [];
    const paidTotal = rows.filter((payment: { status: string; amount: string | number }) => payment.status === "paid").reduce((sum: number, payment: { amount: string | number }) => sum + Number(payment.amount || 0), 0);
    return <><p className="eyebrow">FINANCE WORKSPACE</p><h1 className="serif mt-2 text-3xl">Welcome, {staff.display_name || "accountant"}.</h1><p className="mt-2 text-sm text-[#6f7886]">You can access payment records and reconciliation information only.</p>
      <div className="mt-7 grid gap-4 sm:grid-cols-2"><Stat label="Payment records" value={rows.length} icon={CreditCard}/><Stat label="Recorded paid total (MMK)" value={money(paidTotal)} icon={CheckCircle2}/></div>
      {error && <p className="mt-5 text-sm text-red-700">Could not load payment records: {error.message}</p>}<Link href="/admin/payments" className="btn btn-primary mt-6">Open payment history <ArrowUpRight size={14}/></Link></>;
  }

  if (staff.role === "receptionist") {
    const [{ count: pending }, { count: total }, { count: openRequests }] = await Promise.all([
      hotelDb.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending"),
      hotelDb.from("bookings").select("id", { count: "exact", head: true }),
      hotelDb.from("customer_requests").select("id", { count: "exact", head: true }).neq("status", "resolved"),
    ]);
    return <><p className="eyebrow">FRONT DESK</p><h1 className="serif mt-2 text-3xl">Good day, {staff.display_name || "reception"}.</h1><p className="mt-2 text-sm text-[#6f7886]">Your workspace covers reservations and guest requests.</p>
      <div className="mt-7 grid gap-4 sm:grid-cols-3"><Stat label="Total reservations" value={total || 0} icon={CalendarDays}/><Stat label="Awaiting review" value={pending || 0} icon={Clock3}/><Stat label="Open guest requests" value={openRequests || 0} icon={ConciergeBell}/></div>
      <div className="mt-6 flex flex-wrap gap-3"><Link href="/admin/bookings" className="btn btn-primary">Review reservations <ArrowUpRight size={14}/></Link><Link href="/admin/requests" className="btn btn-outline">Guest requests</Link></div></>;
  }

  const [{ count: pending }, { count: bookings }, { count: payments }, { data: recent }] = await Promise.all([
    hotelDb.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending"),
    hotelDb.from("bookings").select("id", { count: "exact", head: true }),
    hotelDb.from("payments").select("id", { count: "exact", head: true }).eq("status", "paid"),
    hotelDb.from("bookings").select("id,booking_code,check_in,check_out,status,total_amount,created_at,rooms(name),profiles(full_name,phone)").order("created_at", { ascending: false }).limit(6),
  ]);
  const stats = [{ label: "Total reservations", value: bookings || 0, icon: CalendarDays }, { label: "Awaiting review", value: pending || 0, icon: Clock3 }, { label: "Payment records paid", value: payments || 0, icon: CreditCard }];
  return <><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">OVERVIEW</p><h1 className="serif mt-2 text-3xl">Good day, {staff.display_name || "team"}.</h1><p className="mt-2 text-sm text-[#6f7886]">Here is what is happening at your hotel.</p></div><Link href="/admin/bookings" className="btn btn-primary">Review reservations <ArrowUpRight size={14}/></Link></div>
    <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{stats.map(({ label, value, icon: Icon }) => <Stat key={label} label={label} value={value} icon={Icon}/>)}</div>
    <section className="panel mt-7"><div className="flex items-center justify-between p-5"><div><h2 className="serif text-2xl">Recent reservations</h2><p className="mt-1 text-xs text-[#6f7886]">Latest booking activity</p></div><Link className="text-xs font-semibold" href="/admin/bookings">View all →</Link></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Booking</th><th>Guest</th><th>Dates</th><th>Amount</th><th>Status</th></tr></thead><tbody>{(recent || []).map((booking: any) => <tr key={booking.id}><td className="font-semibold">{booking.booking_code}</td><td>{booking.profiles?.full_name || booking.profiles?.phone || "Guest"}<span className="block text-[10px] text-[#6f7886]">{booking.rooms?.name}</span></td><td>{dateLabel(booking.check_in)} — {dateLabel(booking.check_out)}</td><td>{money(Number(booking.total_amount))}</td><td><span className={`status ${booking.status}`}>{booking.status.replaceAll("_", " ")}</span></td></tr>)}{(!recent || recent.length === 0) && <tr><td colSpan={5} className="py-10 text-center text-[#6f7886]">No reservations yet.</td></tr>}</tbody></table></div></section>
    {staff.role === "super_admin" && <div className="mt-6 grid gap-3 sm:grid-cols-2"><Link href="/admin/deals-kitchen" className="panel flex items-center gap-3 p-4"><ChefHat className="text-[#977444]"/><span><strong>Manage Deals & Kitchen</strong><span className="mt-1 block text-xs text-[#6f7886]">Maintain the guest-facing catalogue.</span></span></Link><Link href="/admin/staff" className="panel flex items-center gap-3 p-4"><Tags className="text-[#977444]"/><span><strong>Manage staff roles</strong><span className="mt-1 block text-xs text-[#6f7886]">Invite staff with job-specific permissions.</span></span></Link></div>}
    <p className="mt-5 text-xs text-[#6f7886]">Payment counts reflect recorded paid transactions and are not a substitute for bank reconciliation.</p>
  </>;
}
