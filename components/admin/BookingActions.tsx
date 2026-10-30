"use client";
import { useState } from "react";
export function BookingActions({ bookingId, status }: { bookingId: string; status: string; role?: string }) {
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(""); const [roomNumber, setRoomNumber] = useState("");
  async function update(next: string) {
    setBusy(true); setMsg("");
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next, ...(next === "checked_in" ? { roomNumber } : {}) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Update failed");
      setMsg("Updated"); window.location.reload();
    } catch (error) { setMsg(error instanceof Error ? error.message : "Update failed"); }
    finally { setBusy(false); }
  }
  const choices = status === "pending" ? ["confirmed", "rejected"] : status === "confirmed" ? ["checked_in", "cancelled"] : status === "checked_in" ? ["checked_out"] : [];
  if (!choices.length) return <span className="text-xs text-[#6f7886]">No action</span>;
  return <div className="grid min-w-32 gap-2">{status === "confirmed" && <input aria-label="Assigned physical room number" className="control min-w-28 px-2 py-2 text-xs" value={roomNumber} onChange={e => setRoomNumber(e.target.value)} placeholder="Room number for check-in" maxLength={15} />}{choices.map(choice => <button disabled={busy || (choice === "checked_in" && !roomNumber.trim())} key={choice} onClick={() => update(choice)} className={`rounded border px-2 py-2 text-[10px] font-bold capitalize ${choice === "confirmed" ? "border-[#142238] bg-[#142238] text-white" : "border-[#dce3dc] bg-white text-[#435248]"}`}>{busy ? "Saving…" : choice.replaceAll("_", " ")}</button>)}{msg && <span role="alert" className="max-w-40 whitespace-normal text-[10px] text-red-700">{msg}</span>}</div>;
}
