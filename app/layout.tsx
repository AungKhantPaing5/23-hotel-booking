import type { Metadata } from "next";
import "./globals.css";
import SupportChatWidget from "@/components/support/SupportChatWidget";
export const metadata: Metadata = { title: "23 Hotel & Residence", description: "A considered city stay. Explore rooms, request reservations, and discover thoughtful hotel experiences at 23 Hotel & Residence.", applicationName: "23 Hotel & Residence" };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}<SupportChatWidget/></body></html>; }
