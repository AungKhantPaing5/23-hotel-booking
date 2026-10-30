import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/auth";

const roomImageSchema = z.string().trim().max(2000).refine(
  (value) => value === "" || /^https?:\/\/\S+$/i.test(value) || /^\/uploads\/rooms\/[a-f0-9-]+\.(?:jpg|png|webp)$/i.test(value),
  "Choose a valid room photo file."
);

const roomPatchSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  description: z.string().trim().max(2000).optional(),
  nightly_rate: z.coerce.number().finite().min(0).max(1000000000).optional(),
  capacity: z.coerce.number().int().min(1).max(20).optional(),
  features: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  image_url: roomImageSchema.optional(),
  display_order: z.coerce.number().int().min(0).max(9999).optional(),
  is_active: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, "No room changes were provided.");

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { hotelDb, user } = await requireStaffApi(["super_admin", "manager"]);
    const { id } = await context.params;
    const parsed = roomPatchSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Please check the room details." }, { status: 400 });

    const patch = {
      ...parsed.data,
      ...(parsed.data.image_url !== undefined ? { image_url: parsed.data.image_url || null } : {}),
    };

    const { data, error } = await hotelDb
      .from("rooms")
      .update(patch)
      .eq("id", id)
      .select("id,name,slug,description,nightly_rate,capacity,features,image_url,is_active,display_order,created_at")
      .maybeSingle();

    if (error) {
      console.error("room update failed", { code: error.code, message: error.message, userId: user.id });
      if (error.code === "23505") return NextResponse.json({ error: "That room URL slug already exists." }, { status: 409 });
      if (error.code === "42501") return NextResponse.json({ error: "Your staff account cannot manage rooms. Check the rooms table grants and staff RLS policy." }, { status: 403 });
      return NextResponse.json({ error: "Could not update this room. Check the database migration and try again." }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: "Room not found or permission denied." }, { status: 404 });
    return NextResponse.json({ room: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    const status = message === "UNAUTHENTICATED" ? 401 : 403;
    return NextResponse.json({ error: status === 401 ? "Please sign in again." : "Only an active manager or super admin can manage rooms." }, { status });
  }
}
