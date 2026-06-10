"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type ExportMethod = "GET" | "POST";

export function ExcelExportButton({
  url,
  method = "GET",
  body,
  filename,
  label = "Download Excel",
  variant = "outline",
  size = "sm",
}: {
  url: string;
  method?: ExportMethod;
  body?: Record<string, unknown>;
  filename?: string;
  label?: string;
  variant?: "outline" | "default" | "secondary" | "ghost";
  size?: "sm" | "default";
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method,
        ...(method === "POST"
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body ?? {}),
            }
          : {}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? ((await res.text()) || "Export failed"));
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const resolvedFilename = match?.[1] ?? filename ?? "sparc-export.xlsx";

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = resolvedFilename;
      a.click();
      URL.revokeObjectURL(objectUrl);
      setMessage("Excel downloaded.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={download}
        disabled={busy}
        className="gap-2"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {label}
      </Button>
      {message && (
        <span
          className={`text-sm ${message.toLowerCase().includes("fail") ? "text-destructive" : "text-muted-foreground"}`}
        >
          {message}
        </span>
      )}
    </div>
  );
}
