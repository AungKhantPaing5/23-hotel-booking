import { NextResponse } from "next/server";
import { query } from "@/lib/db/pool";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const url = new URL(request.url); const id = url.searchParams.get("id"); const category = url.searchParams.get("category");
    const params: unknown[] = []; let where = "WHERE is_active=true";
    if (id) { params.push(id); where += ` AND id=$${params.length}`; }
    if (category) { params.push(category); where += ` AND lower(category)=lower($${params.length})`; }
    const result = await query<Record<string, unknown>>(`SELECT id,name,description,category,price,availability_note,image_url,is_active,display_order,created_at FROM services ${where} ORDER BY display_order ASC, created_at ASC LIMIT 100`, params);
    return NextResponse.json({ services: result.rows });
  } catch (error) { console.error("Public services failed", error); return NextResponse.json({ error: "Could not load services. Check the database connection." }, { status: 503 }); }
}
