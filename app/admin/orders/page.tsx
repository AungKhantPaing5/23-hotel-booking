import { requireStaff } from "@/lib/auth";
import { OrderActions } from "@/components/admin/OrderActions";

export const dynamic = "force-dynamic";

export default async function Orders() {
  const { hotelDb, staff, user } = await requireStaff(["super_admin", "manager", "order_staff", "kitchen_staff", "deals_staff", "service_staff"]);
  const { data, error } = await hotelDb.from("service_orders")
    .select("id,quantity,status,customer_note,created_at,assigned_to,profiles(full_name,phone),services(name,price,category)")
    .order("created_at", { ascending: false }).limit(200);

  const title = staff.role === "deals_staff" ? "Deals orders" : (staff.role === "kitchen_staff" || staff.role === "order_staff") ? "Kitchen orders" : staff.role === "service_staff" ? "Hotel service orders" : "Service orders";
  const description = staff.role === "deals_staff"
    ? "Only Deals requests are shown. Accepting an unassigned order claims it for your account; other employees cannot continue your claimed order."
    : (staff.role === "kitchen_staff" || staff.role === "order_staff")
      ? "Only Kitchen/Dining requests are shown. Accepting an unassigned order claims it for your account; other employees cannot continue your claimed order."
      : staff.role === "service_staff"
        ? "Only non-kitchen hotel service requests such as swimming and transport are shown. Accepting an order claims it for your account."
        : "Coordinate guest service requests. Team members can only process orders allowed by their staff role; accepting an order assigns it to the employee.";

  return <>
    <p className="eyebrow">GUEST EXPERIENCE</p><h1 className="serif mt-2 text-3xl">{title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[#6f7886]">{description}</p>
    {error && <div role="alert" className="panel mt-6 p-5 text-sm text-red-700">Could not load orders: {error.message}. Confirm the Deals/Kitchen migration has been run.</div>}
    <div className="panel mt-6"><div className="table-wrap"><table className="data-table"><thead><tr><th>Service / guest</th><th>Qty</th><th>Request</th><th>Assigned to</th><th>Status</th><th>Update</th></tr></thead><tbody>
      {(data || []).map((order: any) => <tr key={order.id}>
        <td><b>{order.services?.name}</b><span className="mt-1 block text-[10px] uppercase tracking-wider text-[#8a7149]">{order.services?.category}</span><span className="block text-xs text-[#6f7886]">{order.profiles?.full_name || order.profiles?.phone || "Guest"}</span></td>
        <td>{order.quantity}</td><td className="max-w-48 whitespace-normal">{order.customer_note || "—"}</td>
        <td className="font-mono text-[10px]">{order.assigned_to === null ? "Unclaimed" : order.assigned_to === user.id ? "You" : "Assigned"}</td>
        <td><span className={`status ${order.status}`}>{order.status}</span></td><td><OrderActions id={order.id} status={order.status}/></td>
      </tr>)}
      {(!data || data.length === 0) && <tr><td colSpan={6} className="py-10 text-center text-[#6f7886]">No orders in your queue.</td></tr>}
    </tbody></table></div></div>
  </>;
}
