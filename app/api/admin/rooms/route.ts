import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/auth";

const roomImageSchema = z.string().trim().max(2000).refine(
  (value) => value === "" || /^https?:\/\/\S+$/i.test(value) || /^\/uploads\/rooms\/[a-f0-9-]+\.(?:jpg|png|webp)$/i.test(value),
  "Choose a valid room photo file."
);

const roomSchema = z.object({
  name: z.string().trim().min(2, "Room name must be at least 2 characters.").max(100),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens for the URL slug."),
  description: z.string().trim().max(2000).default(""),
  nightly_rate: z.coerce.number().finite().min(0).max(1000000000),
  capacity: z.coerce.number().int().min(1).max(20),
  features: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  image_url: roomImageSchema.optional().default(""),
  display_order: z.coerce.number().int().min(0).max(9999).default(0),
  is_active: z.boolean().default(true),
});

export async function POST(request: Request) {
  try {
    const { hotelDb, user } = await requireStaffApi(["super_admin", "manager"]);
    const raw = await request.json();
    const parsed = roomSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Please check the room details." }, { status: 400 });
    }

    const input = parsed.data;
    const { data, error } = await hotelDb
      .from("rooms")
      .insert({ ...input, image_url: input.image_url || null })
      .select("id,name,slug,description,nightly_rate,capacity,features,image_url,is_active,display_order,created_at")
      .single();

    if (error) {
      console.error("room create failed", { code: error.code, message: error.message, userId: user.id });
      if (error.code === "23505") return NextResponse.json({ error: "That room URL slug already exists. Choose a different slug." }, { status: 409 });
      if (error.code === "42501") return NextResponse.json({ error: "Your staff account cannot manage rooms. Check the rooms table grants and staff RLS policy." }, { status: 403 });
      return NextResponse.json({ error: "Could not save this room. Check the database migration and try again." }, { status: 500 });
    }

    return NextResponse.json({ room: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    const status = message === "UNAUTHENTICATED" ? 401 : 403;
    return NextResponse.json({ error: status === 401 ? "Please sign in again." : "Only an active manager or super admin can manage rooms." }, { status });
  }
}
