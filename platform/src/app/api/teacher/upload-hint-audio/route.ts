import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import {
  audioExtensionForFile,
  contentTypeForAudioExt,
  storeTeacherUpload,
} from "@/lib/teacher-upload-storage";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

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

    const ext = audioExtensionForFile(file);
    if (!ext) {
      return Response.json({ error: "Use MP3, WAV, or OGG" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return Response.json({ error: "Audio must be under 5 MB" }, { status: 400 });
    }

    const url = await storeTeacherUpload("hint-audio", file, ext, contentTypeForAudioExt(ext));
    return Response.json({ url });
  } catch (e) {
    console.error("[upload-hint-audio]", e);
    const message = e instanceof Error ? e.message : "Upload failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
