"use client";

import { useRef, useState } from "react";
import { Download, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ItemsDatasetRestore() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function downloadBackup() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/teacher/levels/export-dataset");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sparc-items-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ text: "Items backup downloaded.", ok: true });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Export failed", ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function restoreFile(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      const text = await file.text();
      const dataset = JSON.parse(text);
      const res = await fetch("/api/teacher/levels/restore-dataset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Restore failed");
      setMessage({
        text: `Restored ${data.imported} items (${(data.levelKeys as string[]).join(", ")}). Refresh the page.`,
        ok: true,
      });
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Restore failed", ok: false });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Card className="mb-6 border-amber-200/80 bg-amber-50/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <RotateCcw className="h-4 w-4" />
          Backup & restore items
        </CardTitle>
        <CardDescription>
          Download a JSON backup of all items (grids, hints, publish state). Upload a backup file to
          restore items after a database reset. Student attempts are not included — use Docker database
          backup for full recovery.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void downloadBackup()}>
          <Download className="h-4 w-4" />
          Download items backup
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          Restore from JSON
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void restoreFile(file);
          }}
        />
        {message && (
          <p className={`w-full text-sm ${message.ok ? "text-emerald-800" : "text-destructive"}`}>
            {message.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
