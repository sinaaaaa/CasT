"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
type EditableStudent = {
  id: string;
  displayName: string;
  externalId: string | null;
  classes: string;
  passed: number;
  completionPercent: number;
};

export function EditStudentDialog({
  student,
  open,
  onOpenChange,
  onSaved,
}: {
  student: EditableStudent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [externalId, setExternalId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !student) return;
    setDisplayName(student.displayName);
    setExternalId(student.externalId ?? "");
    setError(null);
    setBusy(false);
  }, [open, student]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!student) return;
    const name = displayName.trim();
    if (!name) {
      setError("Please enter a name students will see.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/students/${student.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: name,
          ...(externalId.trim() ? { externalId: externalId.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          typeof data.error === "string"
            ? data.error
            : "Could not save. Check the name and Student ID.";
        throw new Error(message);
      }
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      setBusy(false);
    }
  }

  const initial = (student?.displayName ?? "?").charAt(0).toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl border-stone-200 p-0 sm:rounded-2xl">
        <form onSubmit={handleSave}>
          <DialogHeader className="space-y-3 border-b border-stone-100 px-6 pb-4 pt-6 text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-lg font-bold text-stone-700">
                {initial}
              </div>
              <div>
                <DialogTitle className="text-xl font-extrabold text-stone-800">
                  Edit student
                </DialogTitle>
                <DialogDescription className="text-stone-500">
                  This name shows on their dashboard as Hey {displayName.trim().split(/\s+/)[0] || "…"}.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="student-display-name">Nickname / display name</Label>
              <Input
                id="student-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Alex"
                autoFocus
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="student-external-id">Student ID</Label>
              <Input
                id="student-external-id"
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
                placeholder="STU-1001"
                className="font-mono"
                maxLength={64}
              />
              <p className="text-xs text-stone-500">
                They sign in with this ID. It has to match what you already keep on the class list.
              </p>
            </div>

            {student && (
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-stone-50 p-3 text-xs text-stone-600">
                <p>
                  <span className="font-semibold text-stone-800">Class</span>
                  <br />
                  {student.classes || "No class yet"}
                </p>
                <p>
                  <span className="font-semibold text-stone-800">Progress</span>
                  <br />
                  {student.completionPercent}% · {student.passed} correct
                </p>
              </div>
            )}

            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 border-t border-stone-100 px-6 py-4 sm:justify-between">
            {student && (
              <Button asChild type="button" variant="ghost" className="justify-start">
                <Link href={`/teacher/students/${student.id}`}>Open full profile</Link>
              </Button>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !displayName.trim()}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
