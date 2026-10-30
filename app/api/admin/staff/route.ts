import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/auth";
import { hashPassword } from "@/lib/db/password";
import { withTransaction } from "@/lib/db/pool";

export const runtime = "nodejs";
const schema = z.object({
  email: z.email().transform(value => value.trim().toLowerCase()),
  name: z.string().trim().min(2).max(100),
  password: z.string().min(10).max(256),
  role: z.enum(["manager", "receptionist", "kitchen_staff", "deals_staff", "service_staff", "accountant", "support_staff"]),
});

export async function POST(request: Request) {
  try {
    const { user } = await requireStaffApi(["super_admin"]);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Check the name, email, password and role." }, { status: 400 });
    const passwordHash = await hashPassword(parsed.data.password);
    const created = await withTransaction(async client => {
      const userResult = await client.query<{ id: string }>(
        `INSERT INTO users(email,full_name,password_hash,is_enabled) VALUES($1,$2,$3,true)
         ON CONFLICT(email) DO UPDATE SET full_name=EXCLUDED.full_name,password_hash=EXCLUDED.password_hash,is_enabled=true
         RETURNING id`, [parsed.data.email, parsed.data.name, passwordHash]
      );
      const userId = userResult.rows[0].id;
      await client.query(
        `INSERT INTO profiles(user_id,full_name) VALUES($1,$2)
         ON CONFLICT(user_id) DO UPDATE SET full_name=EXCLUDED.full_name`, [userId, parsed.data.name]
      );
      await client.query(
        `INSERT INTO staff_profiles(user_id,display_name,role,is_active,created_by) VALUES($1,$2,$3,true,$4)
         ON CONFLICT(user_id) DO UPDATE SET display_name=EXCLUDED.display_name,role=EXCLUDED.role,is_active=true,created_by=EXCLUDED.created_by`,
        [userId, parsed.data.name, parsed.data.role, user.id]
      );
      await client.query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'staff.created','staff_profile',$2,$3::jsonb)", [user.id, userId, JSON.stringify({ email: parsed.data.email, role: parsed.data.role })]);
      return { userId };
    });
    return NextResponse.json({ created: true, email: parsed.data.email, role: parsed.data.role, userId: created.userId }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    console.error("staff account creation failed", error);
    return NextResponse.json({ error: status === 401 ? "Please sign in again." : status === 403 ? "Only an active Super Admin can create staff accounts." : "Could not create staff account. Check the database and email uniqueness." }, { status });
  }
}
