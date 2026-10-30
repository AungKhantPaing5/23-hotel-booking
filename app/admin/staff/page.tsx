import { requireStaff } from "@/lib/auth";
import { StaffInviteForm } from "@/components/admin/StaffInviteForm";

export const dynamic = "force-dynamic";

const roleDescriptions: Record<string, string> = {
  super_admin: "Full system access; can invite and manage staff.",
  manager: "Hotel operations, rooms, bookings, services, deals and kitchen catalogue; cannot manage staff accounts.",
  receptionist: "Reservations and guest requests.",
  kitchen_staff: "Kitchen/dining orders only; accepted orders are assigned to that employee.",
  order_staff: "Legacy role limited to kitchen/dining orders; new staff should use Kitchen staff.",
  deals_staff: "Deals orders only; accepted orders are assigned to that employee.",
  service_staff: "Swimming, transport and other non-kitchen service orders only.",
  accountant: "Payment history and finance information only.",
};

export default async function StaffPage() {
  const { hotelDb } = await requireStaff(["super_admin"]);
  const { data, error } = await hotelDb.from("staff_profiles")
    .select("user_id,display_name,role,is_active,created_at")
    .order("created_at", { ascending: false });

  return <>
    <p className="eyebrow">TEAM ACCESS</p>
    <h1 className="serif mt-2 text-3xl">Staff & roles</h1>
    <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6f7886]">Only Super Admin can invite staff. Choose a job-specific role: employees only see and process the records required for their work. Deals and Kitchen employees can handle only their category, and an accepted order becomes assigned to that employee.</p>
    <div className="panel mt-6 p-5"><h2 className="serif text-xl">Add a staff member</h2><p className="mt-1 text-xs text-[#6f7886]">Create the staff login directly in the Docker database. No cloud identity provider or SMTP service is required. Set an initial password and share it with the employee through a secure channel.</p><div className="mt-4"><StaffInviteForm /></div></div>
    <div className="panel mt-6 overflow-hidden"><div className="border-b border-[#e8ebee] p-5"><h2 className="serif text-xl">Team directory</h2><p className="mt-1 text-xs text-[#6f7886]">Role permissions are enforced by server-side route checks. Database credentials are kept on the server and are never exposed to the browser.</p></div>
      {error ? <p className="p-5 text-sm text-red-700">Could not load staff: {error.message}. Check the staff_profiles migration and grants.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Name</th><th>Login user ID</th><th>Role / responsibility</th><th>Status</th></tr></thead><tbody>{(data || []).map((member: { user_id: string; display_name: string; role: string; is_active: boolean }) => <tr key={member.user_id}><td className="font-semibold">{member.display_name || "Staff member"}</td><td className="font-mono text-[10px]">{member.user_id}</td><td className="whitespace-normal"><b>{member.role.replaceAll("_", " ")}</b><span className="mt-1 block max-w-sm text-[10px] leading-4 text-[#6f7886]">{roleDescriptions[member.role] || "Role-specific access"}</span></td><td><span className={`status ${member.is_active ? "confirmed" : "cancelled"}`}>{member.is_active ? "Active" : "Inactive"}</span></td></tr>)}{(!data || data.length === 0) && <tr><td colSpan={4} className="py-10 text-center text-sm text-[#6f7886]">No staff profiles yet.</td></tr>}</tbody></table></div>}
    </div>
  </>;
}
