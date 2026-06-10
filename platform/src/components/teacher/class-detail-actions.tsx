"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ClassDetailActions({
  classId,
  className,
  classCode,
}: {
  classId: string;
  className: string;
  classCode: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function edit() {
    const name = prompt("Class name", className);
    if (!name?.trim()) return;
    const code = prompt("Class code", classCode);
    if (!code?.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/classes/${classId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Update failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach server.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const ok = confirm(
      `Delete class "${className}"?\n\nEnrolled students will be unlinked. Accounts and attempt history are preserved.`
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/teacher/classes/${classId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Delete failed");
        setBusy(false);
        return;
      }
      router.push("/teacher/classes");
      router.refresh();
    } catch {
      setError("Could not reach server.");
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={edit} disabled={busy} className="gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
        Edit class
      </Button>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={remove}
        disabled={busy}
        className="gap-2"
      >
        <Trash2 className="h-4 w-4" />
        Delete class
      </Button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  );
}
