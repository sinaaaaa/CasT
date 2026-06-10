"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ClassRow = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  studentCount: number;
  attemptCount: number;
};

export function ClassesHub({ classes: initialClasses }: { classes: ClassRow[] }) {
  const router = useRouter();
  const [classes, setClasses] = useState(initialClasses);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createClass(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/teacher/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          ...(code.trim() ? { code: code.trim() } : {}),
          ...(description.trim() ? { description: description.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create class");
        return;
      }
      setMessage(`Created "${data.class.name}".`);
      setClasses((prev) => [
        ...prev,
        {
          id: data.class.id,
          name: data.class.name,
          code: data.class.code,
          description: data.class.description,
          studentCount: 0,
          attemptCount: 0,
        },
      ]);
      setName("");
      setCode("");
      setDescription("");
      setShowForm(false);
      router.refresh();
    } catch {
      setError("Could not reach server.");
    } finally {
      setBusy(false);
    }
  }

  async function editClass(c: ClassRow) {
    const newName = prompt("Class name", c.name);
    if (!newName?.trim()) return;
    const newCode = prompt("Class code (used in reports)", c.code);
    if (!newCode?.trim()) return;
    const newDesc = prompt("Description (optional)", c.description ?? "");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/classes/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          code: newCode.trim(),
          description: newDesc?.trim() ? newDesc.trim() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Update failed");
        return;
      }
      setClasses((prev) =>
        prev.map((row) =>
          row.id === c.id
            ? {
                ...row,
                name: data.class.name,
                code: data.class.code,
                description: data.class.description,
              }
            : row
        )
      );
      router.refresh();
    } catch {
      setError("Could not reach server.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteClass(c: ClassRow) {
    const ok = confirm(
      `Delete class "${c.name}"?\n\n${c.studentCount} enrolled student(s) will be unlinked from this class. Student accounts and attempt history are kept.`
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/classes/${c.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Delete failed");
        return;
      }
      setClasses((prev) => prev.filter((row) => row.id !== c.id));
      setMessage(data.message ?? "Class deleted.");
      router.refresh();
    } catch {
      setError("Could not reach server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card className="mb-6">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Manage classes
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Create classes, assign students on each class page, and set class-level game items.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setShowForm((v) => !v)}
            disabled={busy}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            {showForm ? "Cancel" : "New class"}
          </Button>
        </CardHeader>
        {showForm && (
          <CardContent>
            <form onSubmit={createClass} className="grid max-w-lg gap-4">
              <div className="space-y-2">
                <Label htmlFor="class-name">Name *</Label>
                <Input
                  id="class-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Computational Thinking — Period 3"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-code">Code (optional)</Label>
                <Input
                  id="class-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Auto-generated if empty"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-desc">Description</Label>
                <Textarea
                  id="class-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Grade, period, notes…"
                />
              </div>
              <Button type="submit" disabled={busy || !name.trim()} className="w-fit gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create class
              </Button>
            </form>
          </CardContent>
        )}
        {(message || error) && (
          <CardContent className="pt-0">
            {message && <p className="text-sm text-emerald-700">{message}</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        )}
      </Card>

      {classes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center text-sm text-muted-foreground">
          No classes assigned to you yet. Ask an admin to assign you in{" "}
          <strong>Admin → Classes</strong>, or click <strong>New class</strong> to create one
          (you will be assigned automatically).
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle>{c.name}</CardTitle>
                <p className="font-mono text-xs text-muted-foreground">{c.code}</p>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {c.description && <p className="text-muted-foreground">{c.description}</p>}
                <p>{c.studentCount} students</p>
                <p>{c.attemptCount} level attempts</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link
                    href={`/teacher/classes/${c.id}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Open class →
                  </Link>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    onClick={() => editClass(c)}
                    disabled={busy}
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-destructive hover:underline"
                    onClick={() => deleteClass(c)}
                    disabled={busy}
                    title="Delete class"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
