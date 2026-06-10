import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/ogg",
  "audio/webm",
]);

function extForMime(type: string): string {
  if (type.includes("ogg")) return "ogg";
  if (type.includes("wav")) return "wav";
  if (type.includes("webm")) return "webm";
  return "mp3";
}

export async function POST(request: NextRequest) {
  const { error } = await requireTeacher();
  if (error) return error;

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return Response.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!ALLOWED.has(file.type)) {
      return Response.json({ error: "Use MP3, WAV, or OGG" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return Response.json({ error: "Audio must be under 5 MB" }, { status: 400 });
    }

    const ext = extForMime(file.type);
    const dir = path.join(process.cwd(), "public", "uploads", "hint-audio");
    await mkdir(dir, { recursive: true });

    const filename = `${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, filename), buffer);

    const url = `/uploads/hint-audio/${filename}`;
    return Response.json({ url });
  } catch (e) {
    console.error("[upload-hint-audio]", e);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
