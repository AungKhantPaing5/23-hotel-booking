import { createHmac } from "node:crypto";

export function customerEmail(value: unknown): string {
  const email = String(value || "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  return email;
}

// Keep the existing international database/SMS representation, accept local input.
export function customerPhone(value: unknown): string {
  const input = String(value || "").replace(/[\s()-]/g, "");
  const local = input.startsWith("+959") ? `0${input.slice(3)}` : input;
  if (!/^09\d{9}$/.test(local)) throw new Error("Enter an 11-digit Myanmar phone number starting with 09.");
  return `+95${local.slice(1)}`;
}

export function customerOtpHash(email: string, phone: string, code: string): string {
  const secret = process.env.OTP_SECRET || process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32 || secret.startsWith("local-dev-") || secret.includes("change-before-production"))) {
    throw new Error("Configure a random OTP_SECRET of at least 32 characters.");
  }
  return createHmac("sha256", secret || "development-only-otp-secret").update(JSON.stringify([email, phone, code])).digest("hex");
}

export type CustomerAccount = { id: string; email: string | null; phone: string | null; full_name: string; is_enabled: boolean; is_staff: boolean };
export function matchingCustomer(rows: CustomerAccount[], email: string, phone: string): CustomerAccount | null {
  if (rows.length > 1) throw new Error("ACCOUNT_MISMATCH");
  const account = rows[0];
  if (!account) return null;
  if (!account.is_enabled || account.is_staff || account.phone !== phone || (account.email && account.email.toLowerCase() !== email)) throw new Error("ACCOUNT_MISMATCH");
  return account;
}
