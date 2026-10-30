import { requireStaff } from "@/lib/auth";
import { RoomManager } from "@/components/admin/RoomManager";

export const dynamic = "force-dynamic";

export default async function AdminRoomsPage() {
  const { hotelDb } = await requireStaff(["super_admin", "manager"]);
  const { data, error } = await hotelDb
    .from("rooms")
    .select("id,name,slug,description,nightly_rate,capacity,features,image_url,is_active,display_order,created_at")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  return <>
    <p className="eyebrow">ROOM INVENTORY</p>
    <h1 className="serif mt-2 text-3xl">Rooms & rates</h1>
    <p className="mt-2 text-sm leading-6 text-[#6f7886]">Create room listings, update prices and publish or hide rooms for guests. The customer website and Expo mobile app read published rooms from this same database.</p>
    {error ? <div role="alert" className="panel mt-6 p-5 text-sm text-red-700">Could not load rooms: {error.message}. Check the rooms SELECT grant and staff RLS policy.</div> : <div className="mt-6"><RoomManager initialRooms={(data || []) as any[]} /></div>}
  </>;
}
