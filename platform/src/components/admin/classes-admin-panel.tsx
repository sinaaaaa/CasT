"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Pencil, Plus, RefreshCw, Trash2, Users } from "lucide-react";
import { PageHeader } from "@/components/assessment/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type ClassRow = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  studentCount: number;
  teacherCount: number;
  teachers: { id: string; displayName: string; email: string }[];
  students: { id: string; displayName: string; externalId: string | null; email: string }[];
};

type TeacherOption = { id: string; displayName: string; email: string; role: string };
type StudentOption = {
  id: string;
  displayName: string;
  externalId: string | null;
  email: string;
};

function parseError(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "error" in data) {
    const err = (data as { error: unknown }).error;
    if (typeof err === "string") return err;
  }
  return fallback;
}

export function ClassesAdminPanel() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [manageClass, setManageClass] = useState<ClassRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/classes", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(parseError(data, "Failed to load classes"));
      setClasses(data.classes as ClassRow[]);
      setTeachers(data.teachers as TeacherOption[]);
      setStudents(data.students as StudentOption[]);
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Load failed", ok: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function deleteClass(cls: ClassRow) {
    if (!confirm(`Delete class "${cls.name}"? Student accounts are not deleted.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/classes/${cls.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(parseError(data, "Delete failed"));
      setMessage({ text: `Deleted ${cls.name}`, ok: true });
      await load();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Delete failed", ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Class management"
        description="Create classes, assign teachers, and enroll students. Teachers only see students in their assigned classes."
        actions={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void load()}
              disabled={loading || busy}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            <Button type="button" size="sm" className="gap-2" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New class
            </Button>
          </div>
        }
      />

      {message && (
        <div
          className={cn(
            "mb-4 rounded-lg border px-4 py-3 text-sm",
            message.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-destructive/30 bg-destructive/5 text-destructive"
          )}
        >
          {message.text}
        </div>
      )}

      <Card className="mb-6 border-sky-200/80 bg-sky-50/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">How it works</CardTitle>
          <CardDescription>
            Assign one or more <strong>teachers</strong> to each class, then enroll{" "}
            <strong>students</strong>. When a teacher signs in, they only see classes and students
            linked to them. Admins still see everything.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Loading classes…</p>
          ) : classes.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No classes yet. Create one to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Teachers</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.map((cls) => (
                  <TableRow key={cls.id}>
                    <TableCell>
                      <div className="font-medium">{cls.name}</div>
                      {cls.description && (
                        <div className="text-xs text-muted-foreground">{cls.description}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs">{cls.code}</code>
                    </TableCell>
                    <TableCell>
                      {cls.teacherCount === 0 ? (
                        <Badge variant="warning">None assigned</Badge>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {cls.teachers.slice(0, 2).map((t) => (
                            <Badge key={t.id} variant="secondary">
                              {t.displayName}
                            </Badge>
                          ))}
                          {cls.teacherCount > 2 && (
                            <Badge variant="outline">+{cls.teacherCount - 2}</Badge>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-sm">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        {cls.studentCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setManageClass(cls)}
                          disabled={busy}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Manage
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void deleteClass(cls)}
                          disabled={busy}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateClassDialog
        open={createOpen}
        teachers={teachers}
        busy={busy}
        onOpenChange={setCreateOpen}
        setBusy={setBusy}
        onSuccess={async (text) => {
          setCreateOpen(false);
          setMessage({ text, ok: true });
          await load();
        }}
        onError={(text) => setMessage({ text, ok: false })}
      />

      {manageClass && (
        <ManageClassDialog
          cls={manageClass}
          teachers={teachers}
          students={students}
          busy={busy}
          onOpenChange={(open) => !open && setManageClass(null)}
          setBusy={setBusy}
          onSuccess={async (text) => {
            setMessage({ text, ok: true });
            await load();
            setManageClass(null);
          }}
          onError={(text) => setMessage({ text, ok: false })}
        />
      )}
    </div>
  );
}

function CreateClassDialog({
  open,
  teachers,
  busy,
  onOpenChange,
  setBusy,
  onSuccess,
  onError,
}: {
  open: boolean;
  teachers: TeacherOption[];
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  setBusy: (v: boolean) => void;
  onSuccess: (text: string) => void | Promise<void>;
  onError: (text: string) => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTeachers, setSelectedTeachers] = useState<Set<string>>(new Set());
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setCode("");
      setDescription("");
      setSelectedTeachers(new Set());
      setFieldError(null);
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setFieldError("Class name is required.");
    setBusy(true);
    setFieldError(null);
    try {
      const res = await fetch("/api/admin/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          ...(code.trim() ? { code: code.trim() } : {}),
          ...(description.trim() ? { description: description.trim() } : {}),
          teacherProfileIds: [...selectedTeachers],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(parseError(data, "Create failed"));
      await onSuccess(`Created class ${name.trim()}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create class</DialogTitle>
          <DialogDescription>Add a class and optionally assign teachers now.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="class-name">Class name</Label>
            <Input
              id="class-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Computational Thinking — Period 3"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="class-code">Code (optional)</Label>
            <Input
              id="class-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Auto-generated if empty"
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="class-desc">Description (optional)</Label>
            <Input
              id="class-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <CheckboxPicker
            title="Assign teachers"
            emptyLabel="No teachers with profiles yet — create teachers in Users first."
            options={teachers.map((t) => ({
              id: t.id,
              label: t.displayName,
              hint: `${t.email}${t.role === "ADMIN" ? " · Admin" : ""}`,
            }))}
            selected={selectedTeachers}
            onChange={setSelectedTeachers}
          />
          {fieldError && <p className="text-sm text-destructive">{fieldError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Create class
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ManageClassDialog({
  cls,
  teachers,
  students,
  busy,
  onOpenChange,
  setBusy,
  onSuccess,
  onError,
}: {
  cls: ClassRow;
  teachers: TeacherOption[];
  students: StudentOption[];
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  setBusy: (v: boolean) => void;
  onSuccess: (text: string) => void | Promise<void>;
  onError: (text: string) => void;
}) {
  const [name, setName] = useState(cls.name);
  const [code, setCode] = useState(cls.code);
  const [description, setDescription] = useState(cls.description ?? "");
  const [selectedTeachers, setSelectedTeachers] = useState(
    () => new Set(cls.teachers.map((t) => t.id))
  );
  const [selectedStudents, setSelectedStudents] = useState(
    () => new Set(cls.students.map((s) => s.id))
  );
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    setName(cls.name);
    setCode(cls.code);
    setDescription(cls.description ?? "");
    setSelectedTeachers(new Set(cls.teachers.map((t) => t.id)));
    setSelectedStudents(new Set(cls.students.map((s) => s.id)));
    setFieldError(null);
  }, [cls]);

  async function saveDetails() {
    setBusy(true);
    setFieldError(null);
    try {
      const res = await fetch(`/api/admin/classes/${cls.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim(),
          description: description.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(parseError(data, "Update failed"));
      await onSuccess(`Updated ${name.trim()}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveTeachers() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/classes/${cls.id}/teachers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherProfileIds: [...selectedTeachers] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(parseError(data, "Update failed"));
      await onSuccess(`Teachers updated for ${cls.name}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveStudents() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/classes/${cls.id}/students`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentProfileIds: [...selectedStudents] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(parseError(data, "Update failed"));
      await onSuccess(`Students updated for ${cls.name}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {cls.name}
          </DialogTitle>
          <DialogDescription>Assign teachers and enroll students for this class.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="teachers">
          <TabsList className="mb-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="teachers">Teachers ({selectedTeachers.size})</TabsTrigger>
            <TabsTrigger value="students">Students ({selectedStudents.size})</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Class name</Label>
              <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-code">Code</Label>
              <Input
                id="edit-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Input
                id="edit-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            {fieldError && <p className="text-sm text-destructive">{fieldError}</p>}
            <Button type="button" onClick={() => void saveDetails()} disabled={busy}>
              Save details
            </Button>
          </TabsContent>

          <TabsContent value="teachers" className="space-y-4">
            <CheckboxPicker
              title="Teachers who can see this class"
              emptyLabel="No teachers available."
              options={teachers.map((t) => ({
                id: t.id,
                label: t.displayName,
                hint: t.email,
              }))}
              selected={selectedTeachers}
              onChange={setSelectedTeachers}
            />
            <Button type="button" onClick={() => void saveTeachers()} disabled={busy}>
              Save teachers
            </Button>
          </TabsContent>

          <TabsContent value="students" className="space-y-4">
            <CheckboxPicker
              title="Enrolled students"
              emptyLabel="No students in the system yet."
              options={students.map((s) => ({
                id: s.id,
                label: s.displayName,
                hint: [s.externalId, s.email].filter(Boolean).join(" · "),
              }))}
              selected={selectedStudents}
              onChange={setSelectedStudents}
            />
            <Button type="button" onClick={() => void saveStudents()} disabled={busy}>
              Save students
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function CheckboxPicker({
  title,
  emptyLabel,
  options,
  selected,
  onChange,
}: {
  title: string;
  emptyLabel: string;
  options: { id: string; label: string; hint?: string }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.hint?.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q)
    );
  }, [options, filter]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <Label>{title}</Label>
      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search…"
        className="h-9"
      />
      <div className="max-h-64 overflow-y-auto rounded-md border p-2">
        {options.length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">{emptyLabel}</p>
        ) : filtered.length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">No matches.</p>
        ) : (
          filtered.map((o) => (
            <label
              key={o.id}
              className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 hover:bg-muted/60"
            >
              <input
                type="checkbox"
                checked={selected.has(o.id)}
                onChange={() => toggle(o.id)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium">{o.label}</span>
                {o.hint && <span className="block text-xs text-muted-foreground">{o.hint}</span>}
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
