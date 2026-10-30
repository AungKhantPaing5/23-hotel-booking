"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";

const links = [
  { href: "/#rooms", label: "Rooms & suites" },
  { href: "/#experiences", label: "Experiences" },
  { href: "/#location", label: "Location" },
  { href: "/my-bookings", label: "My bookings" },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMenu = () => setMobileOpen(false);

  return (
    <header className="site-header">
      <div className="site-header__inner site-container">
        <Link href="/" className="brand" aria-label="23 Hotel & Residence home" onClick={closeMenu}>
          <span className="brand__mark">23</span>
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
          <Link className="header-signin" href="/login">Sign in</Link>
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

      {mobileOpen && (
        <nav className="mobile-nav site-container" aria-label="Mobile navigation">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="mobile-nav__link" onClick={closeMenu}>{link.label}</Link>
          ))}
          <Link href="/login" className="mobile-nav__link" onClick={closeMenu}>Guest & staff sign in</Link>
        </nav>
      )}
    </header>
  );
}
