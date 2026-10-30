"use client";
import Link from "next/link"; import { useState } from "react"; import { useRouter } from "next/navigation";
export default function RequestPage() {
  const router = useRouter(); const [subject, setSubject] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subject, message }) });
      const data = await response.json();
      if (response.status === 401) { router.push("/login?next=/request"); return; }
      if (!response.ok) throw new Error(data.error || "Could not send request");
      router.push("/my-bookings?request=sent");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send request"); }
    finally { setBusy(false); }
  }
  return <main className="container py-12"><Link href="/" className="serif text-xl">23 Hotel & Residence</Link><div className="panel mx-auto mt-8 max-w-xl p-6"><p className="eyebrow">GUEST CARE</p><h1 className="serif mt-2 text-3xl">How can we help?</h1><form className="mt-6 grid gap-4" onSubmit={submit}><label className="field">SUBJECT<input className="control" value={subject} onChange={e => setSubject(e.target.value)} required maxLength={120} /></label><label className="field">MESSAGE<textarea className="control" rows={6} value={message} onChange={e => setMessage(e.target.value)} required maxLength={4000} /></label>{error && <p className="text-sm text-red-700">{error}</p>}<button className="btn btn-primary" disabled={busy}>{busy ? "Sending…" : "Send request"}</button></form></div></main>;
}
