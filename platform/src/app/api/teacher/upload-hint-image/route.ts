import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);

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
      return Response.json({ error: "Use PNG, JPG, WebP, or GIF" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return Response.json({ error: "Image must be under 2 MB" }, { status: 400 });
    }

    const ext =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : file.type === "image/gif"
            ? "gif"
            : "jpg";

    const dir = path.join(process.cwd(), "public", "uploads", "hints");
    await mkdir(dir, { recursive: true });

    const filename = `${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, filename), buffer);

    const url = `/uploads/hints/${filename}`;
    return Response.json({ url });
  } catch (e) {
    console.error("[upload-hint-image]", e);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
