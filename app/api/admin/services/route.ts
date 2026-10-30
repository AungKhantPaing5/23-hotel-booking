import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/auth";

const serviceSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120),
  description: z.string().trim().max(1200).default(""),
  category: z.enum(["Deals", "Kitchen"]),
  price: z.coerce.number().finite().min(0).max(1_000_000_000),
  availability_note: z.string().trim().min(2).max(240).default("Available on request"),
  image_url: z.string().trim().regex(/^\/uploads\/services\/[a-f0-9-]+\.(?:jpg|png|webp)$/i, "Upload a valid service image.").nullable().optional(),
  display_order: z.coerce.number().int().min(0).max(9999).default(0),
  is_active: z.boolean().default(true),
});

export async function POST(request: Request) {
  try {
    const { hotelDb } = await requireStaffApi(["super_admin", "manager"]);
    const parsed = serviceSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Please check the menu item." }, { status: 400 });
    }

    const { data, error } = await hotelDb
      .from("services")
      .insert(parsed.data)
      .select("id,name,description,category,price,availability_note,image_url,display_order,is_active,created_at")
      .single();

    if (error) {
      console.error("service create failed", { code: error.code, message: error.message });
      if (error.code === "42501") return NextResponse.json({ error: "Catalogue write denied. Run the Deals/Kitchen migration and confirm this account is an active manager or Super Admin." }, { status: 403 });
      return NextResponse.json({ error: "Could not create this item. Check the database migration and try again." }, { status: 500 });
    }
    return NextResponse.json({ service: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    const status = message === "UNAUTHENTICATED" ? 401 : 403;
    return NextResponse.json({ error: status === 401 ? "Please sign in again." : "Only an active Manager or Super Admin can manage Deals/Kitchen items." }, { status });
  }
}
