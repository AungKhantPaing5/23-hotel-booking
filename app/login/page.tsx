"use client";
import Link from "next/link";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type AuthResponse = { error?: string; message?: string; developmentCode?: string; token?: string };
function LoginForm() {
  const params = useSearchParams();
  const [mode, setMode] = useState<"phone" | "staff">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const next = params.get("next") || "/my-bookings";

  async function sendPhone(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const normalized = phone.trim().replace(/[\s()-]/g, "");
      if (!/^\+[1-9]\d{7,14}$/.test(normalized)) throw new Error("Enter your phone number in international format, e.g. +959xxxxxxxxx.");
      const response = await fetch("/api/auth/otp/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone: normalized, fullName }) });
      const body = await response.json() as AuthResponse;
      if (!response.ok) throw new Error(body.error || "Could not send verification code.");
      setPhone(normalized); setSent(true);
      setMessage(body.developmentCode ? `Local development code: ${body.developmentCode}. In production, this is delivered by your configured SMS provider.` : (body.message || "A verification code has been sent."));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send OTP"); }
    finally { setBusy(false); }
  }
  async function verifyPhone(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/otp/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, code: otp.trim() }) });
      const body = await response.json() as AuthResponse;
      if (!response.ok) throw new Error(body.error || "Could not verify code.");
      window.location.replace(next.startsWith("/") && !next.startsWith("//") ? next : "/my-bookings");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not verify code"); setBusy(false); }
  }
  async function staffLogin(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/staff-login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: email.trim(), password }) });
      const body = await response.json() as AuthResponse;
      if (!response.ok) throw new Error(body.error || "Could not sign in.");
      const requested = params.get("next");
      const destination = requested && /^\/admin(?:\/|$)/.test(requested) && !requested.startsWith("//") ? requested : "/admin";
      window.location.replace(destination);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not sign in"); setBusy(false); }
  }

  return <main className="grid min-h-screen bg-white md:grid-cols-2">
    <section className="relative hidden bg-[#142238] p-12 text-white md:flex md:flex-col md:justify-between"><Link href="/" className="serif text-2xl">23 Hotel & Residence</Link><div><p className="eyebrow mb-5">YOUR NEXT STAY STARTS HERE</p><h1 className="serif text-5xl leading-tight">A little more<br/>room to relax.</h1><p className="mt-5 max-w-sm text-sm leading-7 text-[#d0d7e0]">Sign in securely to manage reservations and hotel operations.</p></div><p className="text-xs text-[#a9b5c2]">A refined city stay.</p></section>
    <section className="flex items-center justify-center p-6"><div className="w-full max-w-md"><Link href="/" className="serif mb-12 block text-xl md:hidden">23 Hotel & Residence</Link><p className="eyebrow mb-3">ACCOUNT ACCESS</p><h2 className="serif text-4xl">Welcome back.</h2><p className="mt-3 text-sm leading-6 text-[#6f7886]">Guests sign in with their phone number. Staff sign in with a work email and password created by the Super Admin.</p>
      <div className="mt-7 grid grid-cols-2 gap-2 rounded bg-[#f2f4ef] p-1"><button type="button" onClick={() => { setMode("phone"); setError(""); }} className={`rounded px-3 py-3 text-xs font-bold ${mode === "phone" ? "bg-white shadow-sm" : "text-[#6f7886]"}`}>Guest · Phone</button><button type="button" onClick={() => { setMode("staff"); setError(""); }} className={`rounded px-3 py-3 text-xs font-bold ${mode === "staff" ? "bg-white shadow-sm" : "text-[#6f7886]"}`}>Staff · Email</button></div>
      {mode === "phone" ? <form className="mt-5 grid gap-4" onSubmit={sent ? verifyPhone : sendPhone}>{!sent && <label className="field">YOUR NAME (OPTIONAL)<input className="control" value={fullName} onChange={e => setFullName(e.target.value)} maxLength={100} placeholder="Enter your name" /></label>}<label className="field">PHONE NUMBER<input className="control" type="tel" autoComplete="tel" placeholder="+959xxxxxxxxx" value={phone} onChange={e => setPhone(e.target.value)} required disabled={sent} /></label>{sent && <label className="field">VERIFICATION CODE<input className="control" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" value={otp} onChange={e => setOtp(e.target.value)} required /></label>}{message && <p className="rounded bg-[#f6f3ec] p-3 text-xs leading-5 text-[#526057]">{message}</p>}<button className="btn btn-primary mt-2 w-full" disabled={busy}>{busy ? "Please wait…" : sent ? "Verify & sign in" : "Send verification code"}</button>{sent && <button type="button" className="text-xs text-[#526057] underline" onClick={() => { setSent(false); setOtp(""); setMessage(""); }}>Change phone number</button>}</form> : <form className="mt-5 grid gap-4" onSubmit={staffLogin}><label className="field">WORK EMAIL<input className="control" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required placeholder="admin@23hotel.com" /></label><label className="field">PASSWORD<input className="control" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label><button className="btn btn-primary mt-2 w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in to staff portal"}</button></form>}
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}{params.get("reason") === "staff_lookup" && <p role="alert" className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">The local database could not read your staff profile. Check Docker PostgreSQL and your staff role.</p>}{params.get("reason") === "not_staff" && <p role="alert" className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">This account has no active staff role.</p>}{params.get("reason") === "session" && <p role="alert" className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">Your local session was not found. Please sign in again.</p>}
      <p className="mt-7 text-xs leading-5 text-[#6f7886]">Local development mode uses a test OTP. Production phone verification requires a configured SMS provider. Passwords are stored as salted scrypt hashes.</p><Link href="/" className="mt-8 inline-block text-xs text-[#526057]">← Back to hotel</Link></div></section>
  </main>;
}
export default function LoginPage() { return <Suspense fallback={<div className="p-10">Loading…</div>}><LoginForm /></Suspense>; }
