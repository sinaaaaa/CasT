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
  const [namePrefix, setNamePrefix] = useState("");
  const [classId, setClassId] = useState("");
  const [idMode, setIdMode] = useState<"manual" | "range">("range");
  const [rangeFrom, setRangeFrom] = useState("500");
  const [rangeTo, setRangeTo] = useState("100");
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [generatedPreview, setGeneratedPreview] = useState<{
    displayName: string;
    externalId: string;
    number: number;
  } | null>(null);

  const needsClass = classes.length > 0;

  useEffect(() => {
    if (!open) return;
    setDisplayName("");
    setExternalId("");
    setNamePrefix("");
    setClassId(defaultClassId ?? classes[0]?.id ?? "");
    setIdMode("range");
    setRangeFrom("500");
    setRangeTo("100");
    setFieldError(null);
    setGeneratedPreview(null);
  }, [open, classes, defaultClassId]);

  async function suggestFromRange(): Promise<{
    displayName: string;
    externalId: string;
    number: number;
  } | null> {
    const from = Number.parseInt(rangeFrom, 10);
    const to = Number.parseInt(rangeTo, 10);
    if (!Number.isFinite(from) || !Number.isFinite(to)) {
      setFieldError("Enter valid numbers for the range.");
      return null;
    }
    if (!namePrefix.trim()) {
      setFieldError('Enter a name prefix first (e.g. "test" → test 500, test 501).');
      return null;
    }

    setBusy(true);
    setFieldError(null);
    try {
      const params = new URLSearchParams({
        from: String(from),
        to: String(to),
        namePrefix: namePrefix.trim(),
      });
      const res = await fetch(`/api/teacher/students/suggest-id?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(parseApiError(data, "No slots available in range"));

      const next = {
        displayName: data.displayName as string,
        externalId: data.externalId as string,
        number: data.number as number,
      };
      setGeneratedPreview(next);
      setDisplayName(next.displayName);
      setExternalId(next.externalId);
      return next;
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : "Could not generate");
      setGeneratedPreview(null);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent, addAnother = false) {
    e.preventDefault();
    setFieldError(null);

    let finalDisplayName = displayName.trim();
    let finalExternalId = externalId.trim();

    if (idMode === "range") {
      if (!namePrefix.trim()) {
        setFieldError('Enter a name prefix first (e.g. "test").');
        return;
      }
      if (!finalDisplayName || !finalExternalId) {
        const generated = await suggestFromRange();
        if (!generated) return;
        finalDisplayName = generated.displayName;
        finalExternalId = generated.externalId;
      }
    }

    if (!finalDisplayName) {
      setFieldError("Display name is required.");
      return;
    }
    if (!finalExternalId) {
      setFieldError("Student ID is required. Generate from range or enter manually.");
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
          displayName: finalDisplayName,
          externalId: finalExternalId,
          ...(classId ? { classId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(parseApiError(data, "Could not add student"));

      if (addAnother && idMode === "range") {
        setDisplayName("");
        setExternalId("");
        setGeneratedPreview(null);
        onCreated?.();
        await suggestFromRange();
        return;
      }

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
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={idMode === "range" ? "default" : "outline"}
                className="rounded-lg"
                onClick={() => setIdMode("range")}
                disabled={busy}
              >
                Generate name + ID
              </Button>
              <Button
                type="button"
                size="sm"
                variant={idMode === "manual" ? "default" : "outline"}
                className="rounded-lg"
                onClick={() => setIdMode("manual")}
                disabled={busy}
              >
                Enter manually
              </Button>
            </div>

            {idMode === "range" ? (
              <div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                <div className="space-y-2">
                  <Label htmlFor="add-student-prefix">Name prefix</Label>
                  <Input
                    id="add-student-prefix"
                    value={namePrefix}
                    onChange={(e) => {
                      setNamePrefix(e.target.value);
                      setGeneratedPreview(null);
                    }}
                    placeholder="test"
                    disabled={busy}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Students are named <span className="font-medium">prefix + number</span>, e.g.{" "}
                    <span className="font-mono">test 500</span>, <span className="font-mono">test 501</span>
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="add-student-from">From</Label>
                    <Input
                      id="add-student-from"
                      type="number"
                      min={1}
                      value={rangeFrom}
                      onChange={(e) => {
                        setRangeFrom(e.target.value);
                        setGeneratedPreview(null);
                      }}
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
                      onChange={(e) => {
                        setRangeTo(e.target.value);
                        setGeneratedPreview(null);
                      }}
                      disabled={busy}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Range can be entered in any order (500–100 or 100–500). Login ID uses STU-###
                  (e.g. STU-500).
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-lg"
                  onClick={() => void suggestFromRange()}
                  disabled={busy}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Generate next available
                </Button>
                {generatedPreview && (
                  <div className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm">
                    <p className="font-medium text-slate-900">{generatedPreview.displayName}</p>
                    <p className="font-mono text-xs text-indigo-700">{generatedPreview.externalId}</p>
                  </div>
                )}
              </div>
            ) : (
              <>
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
                <div className="space-y-2">
                  <Label htmlFor="add-student-id">Student ID</Label>
                  <Input
                    id="add-student-id"
                    value={externalId}
                    onChange={(e) => setExternalId(e.target.value)}
                    placeholder="500 or STU-500"
                    className="font-mono"
                    disabled={busy}
                  />
                </div>
              </>
            )}

            {idMode === "range" && (displayName || externalId) && (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Will be created
                </p>
                <p className="font-medium">{displayName || "—"}</p>
                <p className="font-mono text-xs text-slate-600">{externalId || "—"}</p>
              </div>
            )}

            {fieldError && <p className="text-sm text-destructive">{fieldError}</p>}

            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              {idMode === "range" && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={(e) => void submit(e, true)}
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Add &amp; next
                </Button>
              )}
              <Button
                type="submit"
                disabled={busy}
                className="bg-[#4F46E5] hover:bg-[#4338CA]"
              >
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
