"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles, UserPlus } from "lucide-react";
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

type ClassOption = { id: string; name: string };

function parseApiError(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const record = data as Record<string, unknown>;
  if (typeof record.error === "string") return record.error;
  if (record.error && typeof record.error === "object") {
    const formErrors = (record.error as { formErrors?: string[] }).formErrors;
    if (formErrors?.length) return formErrors.join(" ");
  }
  return fallback;
}

export function AddStudentDialog({
  open,
  onOpenChange,
  classes,
  defaultClassId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: ClassOption[];
  defaultClassId?: string;
  onCreated?: () => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [externalId, setExternalId] = useState("");
  const [classId, setClassId] = useState("");
  const [idMode, setIdMode] = useState<"manual" | "range">("manual");
  const [rangeFrom, setRangeFrom] = useState("1001");
  const [rangeTo, setRangeTo] = useState("1099");
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const needsClass = classes.length > 0;

  useEffect(() => {
    if (!open) return;
    setDisplayName("");
    setExternalId("");
    setClassId(defaultClassId ?? classes[0]?.id ?? "");
    setIdMode("manual");
    setRangeFrom("1001");
    setRangeTo("1099");
    setFieldError(null);
  }, [open, classes, defaultClassId]);

  async function suggestId() {
    const from = Number.parseInt(rangeFrom, 10);
    const to = Number.parseInt(rangeTo, 10);
    if (!Number.isFinite(from) || !Number.isFinite(to)) {
      setFieldError("Enter valid numbers for the ID range.");
      return;
    }
    setBusy(true);
    setFieldError(null);
    try {
      const res = await fetch(
        `/api/teacher/students/suggest-id?from=${from}&to=${to}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(parseApiError(data, "No IDs available in range"));
      setExternalId(data.externalId ?? "");
      setIdMode("manual");
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : "Could not suggest ID");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(null);

    if (!displayName.trim()) {
      setFieldError("Display name is required.");
      return;
    }
    if (!externalId.trim()) {
      setFieldError("Student ID is required. Enter one or generate from a range.");
      return;
    }
    if (needsClass && !classId) {
      setFieldError("Select a class for this student.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/teacher/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          externalId: externalId.trim(),
          ...(classId ? { classId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(parseApiError(data, "Could not add student"));
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : "Could not add student");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-indigo-600" />
            Add student
          </DialogTitle>
          <DialogDescription>
            Create a student account and enroll them in your class so they appear in your roster.
          </DialogDescription>
        </DialogHeader>

        {needsClass ? (
          <form onSubmit={(e) => void submit(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="add-student-class">Class</Label>
              <select
                id="add-student-class"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                disabled={busy}
              >
                {classes.length > 1 && <option value="">Select class…</option>}
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Students must belong to a class you teach to show up in your list.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-student-name">Display name</Label>
              <Input
                id="add-student-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Alex Johnson"
                disabled={busy}
                autoFocus
              />
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={idMode === "manual" ? "default" : "outline"}
                  className="rounded-lg"
                  onClick={() => setIdMode("manual")}
                  disabled={busy}
                >
                  Enter ID
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={idMode === "range" ? "default" : "outline"}
                  className="rounded-lg"
                  onClick={() => setIdMode("range")}
                  disabled={busy}
                >
                  Generate from range
                </Button>
              </div>

              {idMode === "manual" ? (
                <div className="space-y-2">
                  <Label htmlFor="add-student-id">Student ID</Label>
                  <Input
                    id="add-student-id"
                    value={externalId}
                    onChange={(e) => setExternalId(e.target.value)}
                    placeholder="1001 or STU-1001"
                    className="font-mono"
                    disabled={busy}
                  />
                  <p className="text-xs text-muted-foreground">
                    Used for game login. Numbers are stored as STU-####.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Pick the first unused ID between two numbers (max span 500).
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="add-student-from">From</Label>
                      <Input
                        id="add-student-from"
                        type="number"
                        min={1}
                        value={rangeFrom}
                        onChange={(e) => setRangeFrom(e.target.value)}
                        disabled={busy}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="add-student-to">To</Label>
                      <Input
                        id="add-student-to"
                        type="number"
                        min={1}
                        value={rangeTo}
                        onChange={(e) => setRangeTo(e.target.value)}
                        disabled={busy}
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 rounded-lg"
                    onClick={() => void suggestId()}
                    disabled={busy}
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Suggest next available ID
                  </Button>
                  {externalId && (
                    <p className="text-sm font-medium text-indigo-700">
                      Selected: <span className="font-mono">{externalId}</span>
                    </p>
                  )}
                </div>
              )}
            </div>

            {fieldError && <p className="text-sm text-destructive">{fieldError}</p>}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy} className="bg-[#4F46E5] hover:bg-[#4338CA]">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Add student
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You need at least one class before you can add students. Create a class, then return
              here to enroll students.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button asChild className="bg-[#4F46E5] hover:bg-[#4338CA]">
                <Link href="/teacher/classes">Go to classes</Link>
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
