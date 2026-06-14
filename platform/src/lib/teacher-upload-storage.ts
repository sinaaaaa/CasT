import { put } from "@vercel/blob";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export type TeacherUploadFolder = "hints" | "hint-audio";

const LOCAL_PUBLIC_DIRS: Record<TeacherUploadFolder, string> = {
  hints: "uploads/hints",
  "hint-audio": "uploads/hint-audio",
};

function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function imageExtensionForFile(file: File): string | null {
  const ext = fileExtension(file.name);
  if (ext === "png") return "png";
  if (ext === "jpg" || ext === "jpeg") return "jpg";
  if (ext === "webp") return "webp";
  if (ext === "gif") return "gif";

  switch (file.type) {
    case "image/png":
      return "png";
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return null;
  }
}

export function audioExtensionForFile(file: File): string | null {
  const ext = fileExtension(file.name);
  if (ext === "mp3") return "mp3";
  if (ext === "wav") return "wav";
  if (ext === "ogg") return "ogg";
  if (ext === "webm") return "webm";

  const type = file.type.toLowerCase();
  if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
  if (type.includes("wav")) return "wav";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("webm")) return "webm";
  return null;
}

export function contentTypeForImageExt(ext: string): string {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

export function contentTypeForAudioExt(ext: string): string {
  if (ext === "wav") return "audio/wav";
  if (ext === "ogg") return "audio/ogg";
  if (ext === "webm") return "audio/webm";
  return "audio/mpeg";
}

function isVercelProduction(): boolean {
  return process.env.VERCEL === "1";
}

function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

export async function storeTeacherUpload(
  folder: TeacherUploadFolder,
  file: File,
  ext: string,
  contentType: string
): Promise<string> {
  const filename = `${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (blobConfigured()) {
    const blob = await put(`${LOCAL_PUBLIC_DIRS[folder]}/${filename}`, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });
    return blob.url;
  }

  if (isVercelProduction()) {
    throw new Error(
      "Uploads are not configured on production. Add a Vercel Blob store to this project (Storage → Blob) and redeploy."
    );
  }

  const dir = path.join(process.cwd(), "public", LOCAL_PUBLIC_DIRS[folder]);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buffer);
  return `/${LOCAL_PUBLIC_DIRS[folder]}/${filename}`;
}
