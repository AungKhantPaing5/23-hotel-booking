import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/auth";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(1200).optional(),
  category: z.enum(["Deals", "Kitchen"]).optional(),
  price: z.coerce.number().finite().min(0).max(1_000_000_000).optional(),
  availability_note: z.string().trim().min(2).max(240).optional(),
  image_url: z.string().trim().regex(/^\/uploads\/services\/[a-f0-9-]+\.(?:jpg|png|webp)$/i, "Upload a valid service image.").nullable().optional(),
  display_order: z.coerce.number().int().min(0).max(9999).optional(),
  is_active: z.boolean().optional(),
}).refine((body) => Object.keys(body).length > 0, "Provide at least one field to update.");

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { hotelDb } = await requireStaffApi(["super_admin", "manager"]);
    const { id } = await params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid menu item." }, { status: 400 });

    const { data, error } = await hotelDb
      .from("services")
      .update(parsed.data)
      .eq("id", id)
      .select("id,name,description,category,price,availability_note,image_url,display_order,is_active,created_at")
      .maybeSingle();
    if (error) {
      console.error("service update failed", { code: error.code, message: error.message });
      return NextResponse.json({ error: error.code === "42501" ? "You do not have permission to update menu items." : "Could not update this item." }, { status: error.code === "42501" ? 403 : 500 });
    }
    if (!data) return NextResponse.json({ error: "Menu item not found." }, { status: 404 });
    return NextResponse.json({ service: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    const status = message === "UNAUTHENTICATED" ? 401 : 403;
    return NextResponse.json({ error: status === 401 ? "Please sign in again." : "Only an active Manager or Super Admin can manage Deals/Kitchen items." }, { status });
  }
}

// Archive rather than delete so past order history keeps its service relation.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { hotelDb } = await requireStaffApi(["super_admin", "manager"]);
    const { id } = await params;
    const { data, error } = await hotelDb
      .from("services")
      .update({ is_active: false })
      .eq("id", id)
      .select("id,is_active")
      .maybeSingle();
    if (error) return NextResponse.json({ error: "Could not archive this item." }, { status: error.code === "42501" ? 403 : 500 });
    if (!data) return NextResponse.json({ error: "Menu item not found." }, { status: 404 });
    return NextResponse.json({ service: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    const status = message === "UNAUTHENTICATED" ? 401 : 403;
    return NextResponse.json({ error: status === 401 ? "Please sign in again." : "Only an active Manager or Super Admin can manage Deals/Kitchen items." }, { status });
  }
}
