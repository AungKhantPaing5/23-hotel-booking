import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireStaffApi } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

function detectImage(bytes: Buffer): { extension: "jpg" | "png" | "webp"; contentType: string } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: "jpg", contentType: "image/jpeg" };
  }
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { extension: "png", contentType: "image/png" };
  }
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return { extension: "webp", contentType: "image/webp" };
  }
  return null;
}

export async function POST(request: Request) {
  try {
    await requireStaffApi(["super_admin", "manager"]);

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_FILE_BYTES + 128 * 1024) {
      return NextResponse.json({ error: "Room photos must be 5 MB or smaller." }, { status: 413 });
    }

    const formData = await request.formData();
    const candidate = formData.get("file");
    if (!candidate || typeof candidate === "string" || typeof candidate.arrayBuffer !== "function") {
      return NextResponse.json({ error: "Choose a room photo file first." }, { status: 400 });
    }
    if (candidate.size <= 0) return NextResponse.json({ error: "The selected photo is empty." }, { status: 400 });
    if (candidate.size > MAX_FILE_BYTES) return NextResponse.json({ error: "Room photos must be 5 MB or smaller." }, { status: 413 });
    if (!["image/jpeg", "image/png", "image/webp"].includes(candidate.type)) {
      return NextResponse.json({ error: "Only JPG, PNG and WebP room photos are supported." }, { status: 415 });
    }

    const bytes = Buffer.from(await candidate.arrayBuffer());
    const detected = detectImage(bytes);
    if (!detected || detected.contentType !== candidate.type) {
      return NextResponse.json({ error: "The uploaded file is not a valid JPG, PNG or WebP image." }, { status: 415 });
    }

    const fileName = `${randomUUID()}.${detected.extension}`;
    const uploadPath = path.join(process.cwd(), "storage", "rooms");
    await mkdir(uploadPath, { recursive: true });
    await writeFile(path.join(uploadPath, fileName), bytes, { flag: "wx", mode: 0o644 });

    return NextResponse.json({ image_url: `/uploads/rooms/${fileName}`, file_name: fileName }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    }
    if (message === "FORBIDDEN") {
      return NextResponse.json({ error: "Only an active manager or super admin can upload room photos." }, { status: 403 });
    }
    console.error("Room photo upload failed", error);
    return NextResponse.json({ error: "Could not store the photo on the server. Check that public/uploads/rooms is writable." }, { status: 500 });
  }
}
