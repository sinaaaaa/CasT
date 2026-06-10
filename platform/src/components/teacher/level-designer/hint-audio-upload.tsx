"use client";

import { useRef, useState } from "react";
import { Volume2, Loader2, X, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  audioUrl?: string;
  playAutomatically?: boolean;
  onChange: (audioUrl: string | undefined) => void;
  onPlayAutomaticallyChange?: (value: boolean) => void;
  label?: string;
};

export function HintAudioUpload({
  audioUrl,
  playAutomatically = true,
  onChange,
  onPlayAutomaticallyChange,
  label = "Tip audio (optional)",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLAudioElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  async function onFile(file: File | null) {
    if (!file) return;
    setErr(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/teacher/upload-hint-audio", { method: "POST", body: fd });
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

  function togglePreview() {
    const el = previewRef.current;
    if (!el || !audioUrl) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.src = audioUrl;
      void el.play().then(() => setPlaying(true)).catch(() => setErr("Could not play preview"));
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <p className="text-xs text-muted-foreground">
        Plays in Unity when students see this tip. MP3, WAV, or OGG, max 5 MB.
      </p>

      {audioUrl ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sky-200 bg-sky-50/80 px-3 py-3">
          <Volume2 className="h-5 w-5 text-sky-700" />
          <span className="max-w-[180px] truncate text-xs text-sky-900">{audioUrl}</span>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1" onClick={togglePreview}>
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            Preview
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => inputRef.current?.click()} disabled={uploading}>
            Replace
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={() => {
              onChange(undefined);
              setPlaying(false);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
          <audio ref={previewRef} className="hidden" onEnded={() => setPlaying(false)} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full max-w-sm flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition hover:border-sky-400 hover:bg-sky-50/50 disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="h-7 w-7 animate-spin text-sky-600" />
          ) : (
            <Volume2 className="h-7 w-7 text-sky-600" />
          )}
          <span className="text-sm font-medium text-slate-700">
            {uploading ? "Uploading…" : "Upload tip audio"}
          </span>
        </button>
      )}

      {audioUrl && onPlayAutomaticallyChange && (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300"
            checked={playAutomatically !== false}
            onChange={(e) => onPlayAutomaticallyChange(e.target.checked)}
          />
          Play automatically when tip appears in game
        </label>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/webm,.mp3,.wav,.ogg"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />

      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}
