"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Search, Trash2, UserPlus } from "lucide-react";
import { BulkLevelAssignmentPanel } from "@/components/teacher/bulk-level-assignment-panel";
import { PageHeader } from "@/components/assessment/page-header";
import { EduStudentListItem } from "@/components/edu/edu-student-list-item";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type StudentRow = {
  id: string;
  displayName: string;
  externalId: string | null;
  email: string;
  classes: string;
  passed: number;
  failed: number;
  avg: number;
  completionPercent: number;
  assignedLevelCount: number;
  needsHelp?: boolean;
  lastActivityAt: string | null;
};

export function StudentsHub({
  students,
  classes,
  initialQ,
  initialClassId,
  initialAssignment,
  initialNeedsHelp,
  initialSort = "name",
}: {
  students: StudentRow[];
  classes: { id: string; name: string }[];
  initialQ?: string;
  initialClassId?: string;
  initialAssignment?: string;
  initialNeedsHelp?: boolean;
  initialSort?: "name" | "recent";
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const allSelected = students.length > 0 && selected.size === students.length;
  const selectedIds = useMemo(() => [...selected], [selected]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(students.map((s) => s.id)));
  }

  async function exportExcel(all: boolean) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/teacher/export/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allStudents: all,
          studentIds: all ? [] : selectedIds,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sparc-assessment-export.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      setMessage("Export downloaded.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  async function addStudent() {
    const displayName = prompt("Student display name");
    if (!displayName?.trim()) return;
    const externalId = prompt("Student ID (e.g. 1001 or STU-1001)");
    if (!externalId?.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/teacher/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim(), externalId: externalId.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      window.location.reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not add student");
      setBusy(false);
    }
  }

  async function editStudent(s: StudentRow) {
    const displayName = prompt("Display name", s.displayName);
    if (!displayName?.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/teacher/students/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      window.location.reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Update failed");
      setBusy(false);
    }
  }

  async function deleteSelected() {
    if (selectedIds.length === 0) return;
    const ok = confirm(
      `Archive ${selectedIds.length} student(s)?\n\nHistorical assessment reports are preserved.`
    );
    if (!ok) return;
    setBusy(true);
    for (const id of selectedIds) {
      await fetch(`/api/teacher/students/${id}`, { method: "DELETE" });
    }
    window.location.reload();
  }

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Students"
        description="Understand each learner&apos;s progress, assign levels, and spot who needs support."
      />

      <BulkLevelAssignmentPanel
        selectedStudentIds={selectedIds}
        onComplete={() => window.location.reload()}
      />

      <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-4 w-4 rounded"
              aria-label="Select all students"
            />
            <span className="text-sm font-medium text-slate-600">
              {selected.size > 0 ? `${selected.size} selected` : `${students.length} students`}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={addStudent} disabled={busy}>
              <UserPlus className="mr-1 h-4 w-4" />
              Add
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => exportExcel(false)}
              disabled={busy || selectedIds.length === 0}
            >
              <Download className="mr-1 h-4 w-4" />
              Export selected
            </Button>
            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => exportExcel(true)} disabled={busy}>
              <Download className="mr-1 h-4 w-4" />
              Export all
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="rounded-xl"
              onClick={deleteSelected}
              disabled={busy || selectedIds.length === 0}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Archive
            </Button>
          </div>
        </div>

        {initialNeedsHelp && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <span>Showing students who need a check-in (2+ recent failed attempts).</span>
            <Button asChild variant="outline" size="sm" className="rounded-xl border-amber-300 bg-white">
              <Link href="/teacher/students">Clear filter</Link>
            </Button>
          </div>
        )}

        <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {initialNeedsHelp && <input type="hidden" name="needsHelp" value="1" />}
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              name="q"
              defaultValue={initialQ}
              placeholder="Search by name or ID…"
              className="rounded-xl pl-9"
            />
          </div>
          <select name="classId" defaultValue={initialClassId} className="h-10 rounded-xl border border-slate-200 px-3 text-sm">
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            name="assignment"
            defaultValue={initialAssignment ?? ""}
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
          >
            <option value="">All students</option>
            <option value="custom">Custom assignments only</option>
            <option value="none">No custom assignments</option>
          </select>
          <select
            name="sort"
            defaultValue={initialSort}
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
            aria-label="Sort students"
          >
            <option value="name">Name (A–Z)</option>
            <option value="recent">Recent activity</option>
          </select>
          <Button type="submit" className="rounded-xl bg-[#4F46E5] hover:bg-[#4338CA]">
            Apply filters
          </Button>
        </form>
        {message && <p className="mt-3 text-sm text-slate-600">{message}</p>}
      </div>

      <div className="space-y-3">
        {students.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-500">
            No students match your filters.
          </div>
        ) : (
          students.map((s) => (
            <EduStudentListItem
              key={s.id}
              {...s}
              selected={selected.has(s.id)}
              onToggleSelect={() => toggle(s.id)}
              onEdit={() => editStudent(s)}
            />
          ))
        )}
      </div>
    </>
  );
}
