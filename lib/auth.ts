import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/client";
import type { AppUser } from "@/lib/db/session";

export type StaffRole = "super_admin" | "manager" | "receptionist" | "order_staff" | "kitchen_staff" | "deals_staff" | "service_staff" | "accountant";
export type StaffProfile = { user_id: string; display_name: string; role: StaffRole; is_active: boolean; created_at?: string };

export async function requireUser() {
  const hotelDb = await createClient();
  const { data: { user }, error } = await hotelDb.auth.getUser();
  if (error) console.error("[auth] local session lookup failed:", error.message);
  if (!user) redirect("/login?next=/my-bookings&reason=session");
  return { hotelDb, user: user as AppUser };
}

export async function requireStaff(allowed?: StaffRole[]) {
  const hotelDb = await createClient();
  const { data: { user }, error: userError } = await hotelDb.auth.getUser();
  if (userError) console.error("[auth] session lookup failed in requireStaff:", userError.message);
  if (!user) redirect("/login?next=/admin&reason=session");
  const { data: staff, error: staffError } = await hotelDb.from("staff_profiles")
    .select("user_id,role,display_name,is_active,created_at")
    .eq("user_id", user.id).maybeSingle();
  if (staffError) {
    console.error("[auth] staff profile lookup failed:", staffError.code, staffError.message);
    redirect("/login?next=/admin&reason=staff_lookup");
  }
  if (!staff || !staff.is_active || (allowed && !allowed.includes(staff.role as StaffRole))) {
    redirect("/login?next=/admin&reason=not_staff");
  }
  return { hotelDb, user: user as AppUser, staff: staff as StaffProfile };
}

export async function requireStaffApi(allowed?: StaffRole[]) {
  const hotelDb = await createClient();
  const { data: { user }, error: userError } = await hotelDb.auth.getUser();
  if (userError) console.error("[auth] API session lookup failed:", userError.message);
  if (!user) throw new Error("UNAUTHENTICATED");
  const { data: staff, error } = await hotelDb.from("staff_profiles")
    .select("user_id,role,display_name,is_active,created_at").eq("user_id", user.id).maybeSingle();
  if (error) {
    console.error("[auth] API staff profile lookup failed:", error.code, error.message);
    throw new Error("STAFF_PROFILE_LOOKUP_FAILED");
  }
  if (!staff || !staff.is_active || (allowed && !allowed.includes(staff.role as StaffRole))) throw new Error("FORBIDDEN");
  return { hotelDb, user: user as AppUser, staff: staff as StaffProfile };
}
