import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/db/session";
export async function POST() { const response = NextResponse.json({ signedOut: true }); clearSessionCookie(response); return response; }
