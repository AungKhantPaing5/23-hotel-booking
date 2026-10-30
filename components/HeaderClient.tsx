"use client";
import BrandLogo from "@/components/BrandLogo";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";

const links = [
  { href: "/#rooms", label: "Rooms & suites" },
  { href: "/#experiences", label: "Experiences" },
  { href: "/#location", label: "Location" },
  { href: "/my-bookings", label: "My bookings" },
];

type HeaderUser = { full_name: string; email: string | null; phone: string | null };
export default function HeaderClient({ user }: { user: HeaderUser | null }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMenu = () => setMobileOpen(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const accountLabel = user?.full_name || user?.email || user?.phone || "My account";
  async function signOut() {
    setSigningOut(true); setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("Could not sign out. Please try again.");
      window.location.replace("/login");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not sign out."); setSigningOut(false); }
  }

  return (
    <header className="site-header">
      <div className="site-header__inner site-container">
        <Link href="/" className="brand" aria-label="23 Hotel & Residence home" onClick={closeMenu}>
          <BrandLogo size={48}/>
          <span className="brand__copy">
            <span className="brand__name">23 Hotel & Residence</span>
            <span className="brand__tagline">A CONSIDERED CITY STAY</span>
          </span>
        </Link>

        <nav className="site-nav" aria-label="Main navigation">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="site-nav__link">{link.label}</Link>
          ))}
        </nav>

        <div className="site-header__actions">
          {user ? <>
            <Link className="header-signin max-w-40 truncate" href="/my-bookings" title={accountLabel} aria-label={`My account: ${accountLabel}`}>{accountLabel}</Link>
            <button type="button" className="header-signin" disabled={signingOut} onClick={signOut}>{signingOut ? "Signing out…" : "Sign out"}</button>
          </> : <Link className="header-signin" href="/login">Sign in</Link>}
          <Link className="button button--navy header-book" href="/#rooms">Book a stay <ArrowUpRight size={15} /></Link>
          <button
            type="button"
            className="mobile-menu-button"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>

      {error && <p role="alert" className="site-container py-2 text-sm text-red-700">{error}</p>}
      {mobileOpen && (
        <nav className="mobile-nav site-container" aria-label="Mobile navigation">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="mobile-nav__link" onClick={closeMenu}>{link.label}</Link>
          ))}
          {user ? <>
            <Link href="/my-bookings" className="mobile-nav__link" onClick={closeMenu}>{accountLabel}</Link>
            <button type="button" className="mobile-nav__link text-left" disabled={signingOut} onClick={signOut}>{signingOut ? "Signing out…" : "Sign out"}</button>
          </> : <Link href="/login" className="mobile-nav__link" onClick={closeMenu}>Sign in</Link>}
        </nav>
      )}
    </header>
  );
}
