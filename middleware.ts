import { NextResponse, type NextRequest } from "next/server";

// Local PostgreSQL edition uses an application-owned signed session cookie.
// Authorization is enforced in server components and API route handlers.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };
