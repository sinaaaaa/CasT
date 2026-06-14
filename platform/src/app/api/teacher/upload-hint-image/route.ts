import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import {
  contentTypeForAudioExt,
  contentTypeForImageExt,
  imageExtensionForFile,
  storeTeacherUpload,
} from "@/lib/teacher-upload-storage";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { error } = await requireTeacher();
  if (error) return error;

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return Response.json({ error: "No file uploaded" }, { status: 400 });
    }

    const ext = imageExtensionForFile(file);
    if (!ext) {
      return Response.json({ error: "Use PNG, JPG, WebP, or GIF" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return Response.json({ error: "Image must be under 2 MB" }, { status: 400 });
    }

    const url = await storeTeacherUpload("hints", file, ext, contentTypeForImageExt(ext));
    return Response.json({ url });
  } catch (e) {
    console.error("[upload-hint-image]", e);
    const message = e instanceof Error ? e.message : "Upload failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
