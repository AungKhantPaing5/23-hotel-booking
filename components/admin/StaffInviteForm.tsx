"use client";
import { useState } from "react";

const roles = [
  { value: "support_staff", label: "Support staff", detail: "Customer support chat only; cannot manage rooms, reservations, payments or staff." },
  { value: "manager", label: "Manager", detail: "Rooms, reservations, catalogue and hotel operations; cannot manage staff accounts." },
  { value: "receptionist", label: "Receptionist", detail: "Reservations and guest requests only." },
  { value: "kitchen_staff", label: "Kitchen staff", detail: "Kitchen and dining orders; accepts an order to claim it." },
  { value: "deals_staff", label: "Deals staff", detail: "Deals orders only; accepts an order to claim it." },
  { value: "service_staff", label: "Hotel service staff", detail: "Swimming, transport and other non-kitchen hotel service orders only." },
  { value: "accountant", label: "Accountant", detail: "Payment history only." },
];

export function StaffInviteForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("receptionist");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const chosenRole = roles.find((item) => item.value === role);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, name, role, password }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Invitation failed");
      setMessage(`Staff account created for ${email} with the ${chosenRole?.label || "staff"} role. Share the password with the employee through a secure channel.`);
      setEmail(""); setName(""); setPassword("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Invitation failed");
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
    <label className="field">FULL NAME<input className="control" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={100} /></label>
    <label className="field">EMAIL<input className="control" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
    <label className="field">INITIAL PASSWORD<input className="control" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={10} maxLength={256} autoComplete="new-password" /><span className="mt-1 block text-[10px] text-[#6f7886]">Use at least 10 characters. Send it to the employee securely.</span></label>
    <label className="field sm:col-span-2">ASSIGNED JOB / ROLE<select className="control" value={role} onChange={(event) => setRole(event.target.value)}>{roles.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
    {chosenRole && <div className="rounded border border-[#e6e0d6] bg-[#faf8f3] p-3 text-xs leading-5 text-[#526075] sm:col-span-2"><strong className="block text-[#17263b]">{chosenRole.label} permissions</strong>{chosenRole.detail}</div>}
    <div className="flex items-end sm:col-span-2"><button className="btn btn-primary w-full sm:w-auto" disabled={busy}>{busy ? "Creating staff account…" : "Create staff account"}</button></div>
    {message && <p role="status" className="text-sm text-green-700 sm:col-span-2">{message}</p>}
    {error && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{error}</p>}
  </form>;
}
