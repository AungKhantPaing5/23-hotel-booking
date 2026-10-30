import Link from "next/link";
import {
  LayoutDashboard, CalendarDays, ConciergeBell, CreditCard, Users,
  MessageSquare, LogOut, ArrowUpRight, BedDouble, ChefHat,
} from "lucide-react";
import { requireStaff, type StaffRole } from "@/lib/auth";
import { createClient } from "@/lib/db/client";

const allLinks = {
  overview: { href: "/admin", label: "Overview", icon: LayoutDashboard },
  bookings: { href: "/admin/bookings", label: "Reservations", icon: CalendarDays },
  rooms: { href: "/admin/rooms", label: "Rooms & rates", icon: BedDouble },
  orders: { href: "/admin/orders", label: "Service orders", icon: ConciergeBell },
  catalogue: { href: "/admin/deals-kitchen", label: "Deals & kitchen", icon: ChefHat },
  payments: { href: "/admin/payments", label: "Payments", icon: CreditCard },
  requests: { href: "/admin/requests", label: "Guest requests", icon: MessageSquare },
  staff: { href: "/admin/staff", label: "Staff & roles", icon: Users },
};

const visibleLinkKeys: Record<StaffRole, (keyof typeof allLinks)[]> = {
  super_admin: ["overview", "bookings", "rooms", "orders", "catalogue", "payments", "requests", "staff"],
  manager: ["overview", "bookings", "rooms", "orders", "catalogue", "payments", "requests"],
  receptionist: ["overview", "bookings", "requests"],
  kitchen_staff: ["overview", "orders"],
  order_staff: ["overview", "orders"],
  deals_staff: ["overview", "orders"],
  service_staff: ["overview", "orders"],
  accountant: ["overview", "payments"],
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { staff } = await requireStaff();
  const links = visibleLinkKeys[staff.role].map((key) => allLinks[key]);

  return (
    <div className="admin-shell md:flex">
      <aside className="admin-sidebar md:sticky md:top-0 md:h-screen">
        <Link href="/" className="admin-sidebar__brand">
          <span className="admin-sidebar__brand-mark">23</span>
          <span><span className="admin-sidebar__brand-name">23 Hotel & Residence</span><span className="admin-sidebar__brand-label">MANAGEMENT WORKSPACE</span></span>
        </Link>
        <p className="admin-section-label">{staff.role === "kitchen_staff" || staff.role === "order_staff" ? "KITCHEN OPERATIONS" : staff.role === "deals_staff" ? "DEALS OPERATIONS" : staff.role === "service_staff" ? "HOTEL SERVICE OPERATIONS" : staff.role === "accountant" ? "FINANCE" : staff.role === "receptionist" ? "FRONT DESK" : "HOTEL OPERATIONS"}</p>
        <nav className="admin-nav" aria-label="Admin navigation">
          {links.map(({ href, label, icon: Icon }) => <Link href={href} key={href}><Icon size={16} strokeWidth={1.8} /><span>{label}</span></Link>)}
        </nav>
        <div className="admin-profile">
          <p className="admin-profile__name">{staff.display_name || "Hotel staff"}</p>
          <p className="admin-profile__role">{staff.role.replaceAll("_", " ")}</p>
          <form action={async () => {
            "use server";
            const hotelDb = await createClient();
            await hotelDb.auth.signOut();
            const { redirect } = await import("next/navigation");
            redirect("/login");
          }}>
            <button className="mt-4 flex items-center gap-2 text-xs text-[#b9c4d0] hover:text-white"><LogOut size={14} /> Sign out</button>
          </form>
          <Link href="/" className="mt-3 flex items-center gap-2 text-xs text-[#b9c4d0] hover:text-white">View customer site <ArrowUpRight size={13} /></Link>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="admin-topbar">
          <div><p className="admin-topbar__eyebrow">23 HOTEL & RESIDENCE / OPERATIONS</p><p className="admin-topbar__title">{staff.role.replaceAll("_", " ")} workspace</p></div>
          <div className="flex items-center gap-3"><span className="admin-topbar__badge">ROLE-RESTRICTED PORTAL</span><span className="hidden text-xs text-[#6f7886] sm:inline">Signed in as {staff.display_name || "staff"}</span></div>
        </header>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
