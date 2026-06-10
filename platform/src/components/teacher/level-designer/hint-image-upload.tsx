"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  imageUrl?: string;
  onChange: (imageUrl: string | undefined) => void;
  label?: string;
};

export function HintImageUpload({ imageUrl, onChange, label = "Picture for students (optional)" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(file: File | null) {
    if (!file) return;
    setErr(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/teacher/upload-hint-image", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Upload failed");
        return;
      }
      onChange(data.url as string);
    } catch {
      setErr("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <p className="text-xs text-muted-foreground">Shown in the top-right panel in Unity. PNG or JPG, max 2 MB.</p>

      {imageUrl ? (
        <div className="relative inline-block overflow-hidden rounded-xl border-2 border-dashed border-primary/30 bg-slate-50 p-2">
          <div className="relative h-28 w-full min-w-[120px] max-w-[220px] sm:h-32">
            <Image src={imageUrl} alt="Hint preview" fill className="object-contain" unoptimized />
          </div>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute right-1 top-1 h-7 w-7"
            onClick={() => onChange(undefined)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full max-w-sm flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center transition hover:border-primary hover:bg-primary/5 disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : (
            <ImagePlus className="h-8 w-8 text-primary" />
          )}
          <span className="text-sm font-medium text-slate-700">
            {uploading ? "Uploading…" : "Click to upload image"}
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />

      {imageUrl && (
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          Replace image
        </Button>
      )}

      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}
