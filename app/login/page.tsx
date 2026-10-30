import { Suspense } from "react";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";
export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "";
  // Preserve old bookmarked admin login URLs without adding staff controls to customer login.
  if (/^\/admin(?:\/|\?|$)/.test(next)) {
    const destination = new URLSearchParams({ next });
    if (typeof params.reason === "string" && ["session", "staff_lookup", "not_staff"].includes(params.reason)) destination.set("reason", params.reason);
    redirect(`/staff/login?${destination}`);
  }
  return <Suspense fallback={<div className="p-10">Loading…</div>}><LoginForm /></Suspense>;
}
