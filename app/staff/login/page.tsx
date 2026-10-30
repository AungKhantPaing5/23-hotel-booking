import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";
export default function StaffLoginPage() {
  return <Suspense fallback={<div className="p-10">Loading…</div>}><LoginForm staffOnly /></Suspense>;
}
