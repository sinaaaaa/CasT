"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, Pencil, Plus, Trash2, Users, Gamepad2 } from "lucide-react";
import { PageHeader } from "@/components/assessment/page-header";
import { Button } from "@/components/ui/button";
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setCode("");
    setDescription("");
    setShowForm(false);
    setEditingId(null);
  }

  function startEdit(c: ClassRow) {
    setEditingId(c.id);
    setShowForm(false);
    setName(c.name);
    setCode(c.code);
    setDescription(c.description ?? "");
    setError(null);
    setMessage(null);
  }

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
      resetForm();
      router.refresh();
    } catch {
      setError("Could not reach server.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/classes/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim(),
          description: description.trim() ? description.trim() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Update failed");
        return;
      }
      setClasses((prev) =>
        prev.map((row) =>
          row.id === editingId
            ? {
                ...row,
                name: data.class.name,
                code: data.class.code,
                description: data.class.description,
              }
            : row
        )
      );
      setMessage("Class updated.");
      resetForm();
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
      <PageHeader
        eyebrow="People & plans"
        title="Classes"
        description="Group students, assign items, and open a class to see who is playing."
        actions={
          <Button
            type="button"
            className="rounded-xl"
            onClick={() => {
              if (showForm) resetForm();
              else {
                setEditingId(null);
                setName("");
                setCode("");
                setDescription("");
                setShowForm(true);
              }
            }}
            disabled={busy}
          >
            <Plus className="mr-2 h-4 w-4" />
            {showForm ? "Cancel" : "New class"}
          </Button>
        }
      />

      {showForm && (
        <form
          onSubmit={createClass}
          className="mb-8 grid gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:grid-cols-2"
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="class-name">Name</Label>
            <Input
              id="class-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Computational Thinking — Period 3"
              className="h-11 rounded-xl"
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
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="class-desc">Description</Label>
            <Textarea
              id="class-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={1}
              placeholder="Grade, period, notes…"
              className="rounded-xl"
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy || !name.trim()} className="rounded-xl">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create class
            </Button>
          </div>
        </form>
      )}

      {(message || error) && (
        <p className={`mb-6 text-sm ${error ? "text-destructive" : "text-emerald-700"}`}>
          {error ?? message}
        </p>
      )}

      {classes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-[#4F46E5]">
            <GraduationCap className="h-6 w-6" />
          </span>
          <p className="mt-4 text-base font-semibold text-slate-800">No classes yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Create one to group students and assign items. You will be assigned automatically.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((c) => (
            <article
              key={c.id}
              className="flex flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 transition hover:shadow-md"
            >
              {editingId === c.id ? (
                <form onSubmit={saveEdit} className="space-y-3">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-11 rounded-xl"
                    required
                  />
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="h-11 rounded-xl font-mono text-sm"
                    placeholder="Class code"
                  />
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="rounded-xl"
                    placeholder="Description"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={busy} className="rounded-xl">
                      Save
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={resetForm}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{c.name}</h3>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-400">{c.code}</p>
                    </div>
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-[#4F46E5]">
                      <GraduationCap className="h-5 w-5" />
                    </span>
                  </div>
                  {c.description && <p className="mt-3 text-sm text-slate-600">{c.description}</p>}
                  <div className="mt-4 flex gap-3 text-sm text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {c.studentCount} students
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Gamepad2 className="h-3.5 w-3.5" />
                      {c.attemptCount} plays
                    </span>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button asChild size="sm" className="rounded-xl">
                      <Link href={`/teacher/classes/${c.id}`}>Open class</Link>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => startEdit(c)}
                      disabled={busy}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="rounded-xl text-destructive hover:text-destructive"
                      onClick={() => void deleteClass(c)}
                      disabled={busy}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
