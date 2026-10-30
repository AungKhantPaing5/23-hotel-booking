import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
export const runtime = "nodejs";
const types: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  if (!/^[a-f0-9-]{36}\.(?:jpg|jpeg|png|webp)$/i.test(filename)) return new NextResponse("Not found", { status: 404 });
  const extension = path.extname(filename).slice(1).toLowerCase();
  try {
    const bytes = await readFile(path.join(process.cwd(), "storage", "services", filename));
    return new NextResponse(bytes, { headers: { "Content-Type": types[extension], "Content-Length": String(bytes.byteLength), "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" } });
  } catch { return new NextResponse("Not found", { status: 404 }); }
}
