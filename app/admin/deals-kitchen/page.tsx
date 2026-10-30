import { requireStaff } from "@/lib/auth";
import { ServiceManager } from "@/components/admin/ServiceManager";

export const dynamic = "force-dynamic";

export default async function DealsKitchenPage() {
  const { hotelDb } = await requireStaff(["super_admin", "manager"]);
  const { data, error } = await hotelDb
    .from("services")
    .select("id,name,description,category,price,availability_note,image_url,display_order,is_active,created_at")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  return <>
    <p className="eyebrow">GUEST EXPERIENCE</p>
    <h1 className="serif mt-2 text-3xl">Deals & Kitchen</h1>
    <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6f7886]">Add and maintain kitchen menu items and promotional deals. Published items appear on the customer website and mobile app. Kitchen and Deals employees can process only orders in their own category.</p>
    {error ? <div role="alert" className="panel mt-6 p-5 text-sm text-red-700">Could not load the catalogue: {error.message}. Run the Deals/Kitchen migration and confirm the manager/Super Admin account is active.</div> : <div className="mt-6"><ServiceManager initialItems={(data || []).filter((item: { category: string }) => ["deals", "kitchen", "food", "dining", "restaurant", "room service", "room_service"].includes(String(item.category).trim().toLowerCase())) as any[]} /></div>}
  </>;
}
