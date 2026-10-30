import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "23 Hotel & Residence", description: "A considered city stay. Explore rooms, request reservations, and discover thoughtful hotel experiences at 23 Hotel & Residence.", applicationName: "23 Hotel & Residence" };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
