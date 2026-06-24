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
import {
  buildStudentSlotPreviews,
  parseApiError,
  readApiJson,
} from "@/lib/api-client";

type ClassOption = { id: string; name: string };

type SlotPreview = {
  displayName: string;
  externalId: string;
  number: number;
};

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
  const [rangeTo, setRangeTo] = useState("530");
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [rangePreview, setRangePreview] = useState<{
    head: SlotPreview[];
    tail: SlotPreview[];
    count: number;
    from: number;
    to: number;
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
    setRangeTo("530");
    setFieldError(null);
    setRangePreview(null);
  }, [open, classes, defaultClassId]);

  function clearRangePreview() {
    setRangePreview(null);
  }

  async function generateRangePreview(): Promise<{
    head: SlotPreview[];
    tail: SlotPreview[];
    count: number;
    from: number;
    to: number;
  } | null> {
    const from = Number.parseInt(rangeFrom, 10);
    const to = Number.parseInt(rangeTo, 10);
    if (!Number.isFinite(from) || !Number.isFinite(to)) {
      setFieldError("Enter valid numbers for the range.");
      return null;
    }
    if (!namePrefix.trim()) {
      setFieldError('Enter a name prefix first (e.g. "test" → test 500 … test 530).');
      return null;
    }

    setBusy(true);
    setFieldError(null);
    setRangePreview(null);
    try {
      const params = new URLSearchParams({
        from: String(from),
        to: String(to),
        namePrefix: namePrefix.trim(),
      });
      const res = await fetch(`/api/teacher/students/suggest-id?${params}`);
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(parseApiError(data, "Could not generate for this range"));

      const record = data as Record<string, unknown>;
      const from = record.from as number;
      const to = record.to as number;
      const count = record.count as number;
      const prefix = String(record.namePrefix ?? namePrefix.trim());
      const { head, tail } = buildStudentSlotPreviews(from, to, prefix);
      const preview = { head, tail, count, from, to };
      setRangePreview(preview);
      return preview;
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : "Could not generate");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function submitBulk() {
    setFieldError(null);
    if (!namePrefix.trim()) {
      setFieldError('Enter a name prefix first (e.g. "test").');
      return;
    }
    if (needsClass && !classId) {
      setFieldError("Select a class for these students.");
      return;
    }

    const preview = rangePreview ?? (await generateRangePreview());
    if (!preview || preview.count === 0) return;

    setBusy(true);
    try {
      const res = await fetch("/api/teacher/students/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          namePrefix: namePrefix.trim(),
          from: Number.parseInt(rangeFrom, 10),
          to: Number.parseInt(rangeTo, 10),
          ...(classId ? { classId } : {}),
        }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(parseApiError(data, "Could not add students"));

      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : "Could not add students");
    } finally {
      setBusy(false);
    }
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(null);

    if (!displayName.trim()) {
      setFieldError("Display name is required.");
      return;
    }
    if (!externalId.trim()) {
      setFieldError("Student ID is required.");
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
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(parseApiError(data, "Could not add student"));
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : "Could not add student");
    } finally {
      setBusy(false);
    }
  }

  const previewHead = rangePreview?.head ?? [];
  const previewTail = rangePreview?.tail ?? [];
  const showPreviewEllipsis =
    rangePreview != null && rangePreview.count > previewHead.length + previewTail.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-indigo-600" />
            Add student
          </DialogTitle>
          <DialogDescription>
            Create student accounts and enroll them in your class so they appear in your roster.
          </DialogDescription>
        </DialogHeader>

        {needsClass ? (
          <div className="space-y-4">
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
                Generate batch
              </Button>
              <Button
                type="button"
                size="sm"
                variant={idMode === "manual" ? "default" : "outline"}
                className="rounded-lg"
                onClick={() => setIdMode("manual")}
                disabled={busy}
              >
                One student
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
                      clearRangePreview();
                    }}
                    placeholder="test"
                    disabled={busy}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Creates <span className="font-mono">test 500</span>, <span className="font-mono">test 501</span>
                    , … for every number in the range. Login IDs: <span className="font-mono">STU-500</span>, etc.
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
                        clearRangePreview();
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
                        clearRangePreview();
                      }}
                      disabled={busy}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  The whole range must be free — if any ID or name already exists, choose a different range.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-lg"
                  onClick={() => void generateRangePreview()}
                  disabled={busy}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Preview batch
                </Button>

                {rangePreview && (
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-indigo-200 bg-white p-3 text-sm">
                    <p className="mb-2 font-medium text-indigo-900">
                      {rangePreview.count} student{rangePreview.count === 1 ? "" : "s"} (
                      {rangePreview.from}–{rangePreview.to})
                    </p>
                    {previewHead.map((slot) => (
                      <div key={slot.number} className="flex justify-between gap-2 text-xs">
                        <span>{slot.displayName}</span>
                        <span className="font-mono text-slate-500">{slot.externalId}</span>
                      </div>
                    ))}
                    {showPreviewEllipsis && (
                      <p className="py-1 text-center text-xs text-muted-foreground">…</p>
                    )}
                    {rangePreview.count > 4 &&
                      previewTail.map((slot) => (
                        <div key={slot.number} className="flex justify-between gap-2 text-xs">
                          <span>{slot.displayName}</span>
                          <span className="font-mono text-slate-500">{slot.externalId}</span>
                        </div>
                      ))}
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
              {idMode === "range" ? (
                <Button
                  type="button"
                  disabled={busy}
                  className="bg-[#4F46E5] hover:bg-[#4338CA]"
                  onClick={() => void submitBulk()}
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {rangePreview
                    ? `Add all ${rangePreview.count} students`
                    : "Add all in range"}
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={busy}
                  className="bg-[#4F46E5] hover:bg-[#4338CA]"
                  onClick={(e) => void submitManual(e)}
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Add student
                </Button>
              )}
            </DialogFooter>
          </div>
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
