"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { money } from "@/lib/format";

type Booking = { id: string; booking_code: string; status: string; assigned_room_number?: string | null; rooms?: { name?: string } | null };
type Item = { id: string; name: string; category: string; description: string; price: number; availability_note?: string };
export default function OrderService() {
  const params = useParams<{ id: string }>(); const router = useRouter();
  const [item, setItem] = useState<Item | null>(null); const [bookings, setBookings] = useState<Booking[]>([]); const [bookingId, setBookingId] = useState("");
  const [quantity, setQuantity] = useState("1"); const [note, setNote] = useState(""); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const isDeal = (item?.category || "").trim().toLowerCase() === "deals";
  useEffect(() => { let active = true; (async () => {
    try {
      const response = await fetch("/api/customer/bookings");
      if (response.status === 401) { router.push("/login?next=" + encodeURIComponent(`/services/${params.id}/order`)); return; }
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not load your bookings.");
      if (!active) return; const eligible = (data.bookings || []).filter((b: Booking) => ["confirmed", "checked_in"].includes(b.status)); setBookings(eligible); if (eligible.length) setBookingId(eligible[0].id);
      const itemResponse = await fetch(`/api/public/services?id=${encodeURIComponent(params.id)}`); const itemData = await itemResponse.json();
      const found = (itemData.services || []).find((s: Item) => s.id === params.id); if (!active) return; setItem(found || null);
      if (!eligible.length) setError("You need a confirmed hotel booking before requesting services or ordering deals.");
    } catch (e) { if (active) setError(e instanceof Error ? e.message : "Could not load the order page."); }
    finally { if (active) setLoading(false); }
  })(); return () => { active = false; }; }, [params.id, router]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (!bookingId) throw new Error("Choose your hotel booking first.");
      const response = await fetch("/api/customer/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ serviceId: params.id, bookingId, quantity: Number(quantity), note }) });
      const data = await response.json();
      if (response.status === 401) { router.push("/login?next=" + encodeURIComponent(`/services/${params.id}/order`)); return; }
      if (!response.ok) throw new Error(data.error || "Could not submit the request"); router.push("/my-orders?request=sent");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not submit the request"); }
    finally { setBusy(false); }
  }
  return <main className="container py-12"><Link href="/services" className="text-xs underline">← Back to services & deals</Link><div className="panel mx-auto mt-6 max-w-xl p-6"><p className="eyebrow">{isDeal ? "HOTEL DEAL" : "GUEST SERVICE"}</p><h1 className="serif mt-2 text-3xl">{loading ? "Loading…" : item?.name || (isDeal ? "Order a deal" : "Request a hotel service")}</h1><p className="mt-2 text-sm text-[#6f7886]">Select your own confirmed booking. The hotel team will review the request and confirm availability and final charges.</p>
  {item && <><p className="mt-3 text-sm">{item.description}</p><p className="mt-2 text-lg font-semibold">{money(Number(item.price || 0), "MMK")}</p></>}
  <form className="mt-6 grid gap-4" onSubmit={submit}><label className="field">YOUR BOOKING<select className="control" value={bookingId} onChange={e => setBookingId(e.target.value)} required><option value="">Choose your booking</option>{bookings.map(b => <option key={b.id} value={b.id}>{b.booking_code} · {b.rooms?.name || "Room"}{b.assigned_room_number ? ` · Room ${b.assigned_room_number}` : ""} · {b.status.replaceAll("_", " ")}</option>)}</select></label><label className="field">QUANTITY<input className="control" type="number" min="1" max="20" value={quantity} onChange={e => setQuantity(e.target.value)} required /></label><label className="field">{isDeal ? "DEAL NOTES" : "REQUEST DETAILS"}<textarea className="control" rows={4} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} placeholder="Preferred time, room number or other details" /></label>{error && <p role="alert" className="text-sm text-amber-800">{error}</p>}<button className="btn btn-primary" disabled={busy || loading || !bookingId}>{busy ? "Submitting…" : isDeal ? "Place deal order" : "Send service request"}</button></form></div></main>;
}
