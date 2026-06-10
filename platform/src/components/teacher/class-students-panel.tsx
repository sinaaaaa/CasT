"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Member = {
  id: string;
  displayName: string;
  externalId: string | null;
  attemptCount: number;
};

type Candidate = {
  id: string;
  displayName: string;
  externalId: string | null;
};

export function ClassStudentsPanel({
  classId,
  className,
  description,
  members,
  candidates,
}: {
  classId: string;
  className: string;
  description: string | null;
  members: Member[];
  candidates: Candidate[];
}) {
  const router = useRouter();
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enroll() {
    if (!selectedStudentId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/classes/${classId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: selectedStudentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not add student");
        return;
      }
      setSelectedStudentId("");
      router.refresh();
    } catch {
      setError("Could not reach server.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(studentId: string, displayName: string) {
    const ok = confirm(`Remove ${displayName} from ${className}?`);
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/teacher/classes/${classId}/students?studentId=${encodeURIComponent(studentId)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not remove student");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Students in {className}</CardTitle>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Add student to class
            </label>
            <select
              className="h-10 w-full rounded-md border bg-white px-3 text-sm"
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              disabled={busy || candidates.length === 0}
            >
              <option value="">
                {candidates.length === 0 ? "All students already enrolled" : "Select student…"}
              </option>
              {candidates.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName}
                  {s.externalId ? ` (${s.externalId})` : ""}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={enroll}
            disabled={busy || !selectedStudentId}
            className="gap-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Add to class
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>External ID</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No students in this class yet.
                </TableCell>
              </TableRow>
            ) : (
              members.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>{student.displayName}</TableCell>
                  <TableCell>{student.externalId ?? "—"}</TableCell>
                  <TableCell>{student.attemptCount}</TableCell>
                  <TableCell className="space-x-2 text-right">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-sm text-destructive hover:underline"
                      onClick={() => remove(student.id, student.displayName)}
                      disabled={busy}
                      title="Remove from class"
                    >
                      <UserMinus className="h-4 w-4" />
                      Remove
                    </button>
                    <Link
                      href={`/teacher/students/${student.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      Profile
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
