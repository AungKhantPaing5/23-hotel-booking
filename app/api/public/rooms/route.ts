import { NextResponse } from "next/server";
import { query } from "@/lib/db/pool";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const url = new URL(request.url); const slug = url.searchParams.get("slug"); const id = url.searchParams.get("id");
    const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit") || 50) || 50));
    const result = await query<Record<string, unknown>>(
      `SELECT id,name,slug,description,nightly_rate,capacity,features,image_url,is_active,display_order,created_at FROM rooms WHERE is_active=true${slug ? " AND slug=$1" : id ? " AND id=$1" : ""} ORDER BY display_order ASC, created_at ASC LIMIT ${limit}`,
      slug ? [slug] : id ? [id] : []
    );
    return NextResponse.json({ rooms: result.rows });
  } catch (error) { console.error("Public rooms failed", error); return NextResponse.json({ error: "Could not load rooms. Check the database connection." }, { status: 503 }); }
}
