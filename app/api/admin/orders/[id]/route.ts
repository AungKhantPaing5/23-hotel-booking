import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/auth";

const schema = z.object({ status: z.enum(["accepted", "rejected", "processing", "completed", "cancelled"]) });
const transitions: Record<string, string[]> = {
  pending: ["accepted", "rejected"],
  accepted: ["processing", "cancelled"],
  processing: ["completed"],
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { hotelDb } = await requireStaffApi(["super_admin", "manager", "order_staff", "kitchen_staff", "deals_staff", "service_staff"]);
    const { id } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid status." }, { status: 400 });

    const { data: order, error: readError } = await hotelDb.from("service_orders").select("id,status").eq("id", id).maybeSingle();
    if (readError) {
      console.error("service order lookup failed", { code: readError.code, message: readError.message });
      return NextResponse.json({ error: "Could not read the order. Check the role-scoped order policies." }, { status: 403 });
    }
    if (!order) return NextResponse.json({ error: "Order not found in your work queue, or it is assigned to another employee." }, { status: 404 });
    if (!transitions[order.status]?.includes(parsed.data.status)) return NextResponse.json({ error: "That status transition is not allowed." }, { status: 409 });

    const { data, error } = await hotelDb.rpc("transition_service_order_status", {
      p_order_id: id,
      p_expected_status: order.status,
      p_new_status: parsed.data.status,
    });
    if (error) {
      console.error("service order transition rejected", { code: error.code, message: error.message });
      if (error.message.includes("ORDER_ASSIGNED_TO_ANOTHER_STAFF")) return NextResponse.json({ error: "This order is assigned to another employee." }, { status: 403 });
      if (error.message.includes("NOT_AUTHORIZED_FOR_CATEGORY")) return NextResponse.json({ error: "Your staff role cannot process this category." }, { status: 403 });
      return NextResponse.json({ error: "Could not update the order. Refresh the queue and try again." }, { status: 409 });
    }
    return NextResponse.json({ order: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    const status = message === "UNAUTHENTICATED" ? 401 : 403;
    return NextResponse.json({ error: status === 401 ? "Please sign in again." : "Your staff role cannot update service orders." }, { status });
  }
}
