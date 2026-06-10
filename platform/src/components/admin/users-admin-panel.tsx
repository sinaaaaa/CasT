"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  Gamepad2,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  UserPlus,
} from "lucide-react";
import { UserRole } from "@prisma/client";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminAccountSource } from "@/lib/user-admin";
import { cn } from "@/lib/utils";

function normalizeSearchStudentId(raw: string): string {
  const id = raw.trim();
  if (!id) return id;
  return id.toUpperCase().startsWith("STU-") ? id.toUpperCase() : `STU-${id}`;
}

function matchesStudentSearch(user: AdminUser, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const normalizedId = normalizeSearchStudentId(query).toLowerCase();
  const bareId = normalizedId.replace(/^stu-/, "");
  return (
    user.displayName.toLowerCase().includes(q) ||
    user.email.toLowerCase().includes(q) ||
    (user.externalId?.toLowerCase().includes(q) ?? false) ||
    user.externalId?.toLowerCase() === normalizedId ||
    (bareId.length > 0 && (user.externalId?.toLowerCase().includes(bareId) ?? false))
  );
}

type AdminUser = {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  displayName: string;
  profileId: string | null;
  externalId: string | null;
  isArchived: boolean;
  createdAt: string;
  accountSource: AdminAccountSource;
  isPlaceholderEmail: boolean;
  isPlaceholderName: boolean;
};

type StudentFilter = "all" | "unity" | "needs-email" | "needs-name";

type DialogMode =
  | { type: "create-teacher" }
  | { type: "create-student" }
  | { type: "edit"; user: AdminUser }
  | { type: "reset-password"; user: AdminUser };

function parseApiError(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "error" in data) {
    const err = (data as { error: unknown }).error;
    if (typeof err === "string") return err;
    if (err && typeof err === "object" && "fieldErrors" in err) {
      const fieldErrors = (err as { fieldErrors?: Record<string, string[]> }).fieldErrors;
      if (fieldErrors) {
        const first = Object.values(fieldErrors).flat()[0];
        if (first) return first;
      }
    }
  }
  return fallback;
}

function passwordsMatch(a: string, b: string): boolean {
  return a.length > 0 && a === b;
}

export function UsersAdminPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [tab, setTab] = useState<"teachers" | "students">("teachers");
  const [search, setSearch] = useState("");
  const [studentFilter, setStudentFilter] = useState<StudentFilter>("all");
  const [dialog, setDialog] = useState<DialogMode | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(parseApiError(data, "Failed to load users"));
      setUsers(data.users as AdminUser[]);
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Load failed", ok: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onFocus() {
      void load();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const teachers = useMemo(
    () => users.filter((u) => u.role === UserRole.TEACHER || u.role === UserRole.ADMIN),
    [users]
  );
  const students = useMemo(
    () => users.filter((u) => u.role === UserRole.STUDENT),
    [users]
  );

  const filteredStudents = useMemo(() => {
    return students.filter((u) => {
      if (studentFilter === "unity" && u.accountSource !== "unity") return false;
      if (studentFilter === "needs-email" && !u.isPlaceholderEmail) return false;
      if (studentFilter === "needs-name" && !u.isPlaceholderName) return false;
      return matchesStudentSearch(u, search);
    });
  }, [students, search, studentFilter]);

  const filteredTeachers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [teachers, search]);

  async function patchUser(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(parseApiError(data, "Update failed"));
  }

  async function toggleActive(user: AdminUser) {
    setBusy(true);
    setMessage(null);
    try {
      await patchUser(user.id, { isActive: !user.isActive });
      setMessage({
        text: user.isActive ? `Deactivated ${user.email}` : `Activated ${user.email}`,
        ok: true,
      });
      await load();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Update failed", ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function toggleArchive(user: AdminUser) {
    setBusy(true);
    setMessage(null);
    try {
      await patchUser(user.id, { isArchived: !user.isArchived });
      await load();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Update failed", ok: false });
    } finally {
      setBusy(false);
    }
  }

  const refreshButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => void load()}
      disabled={loading || busy}
      aria-label="Refresh users"
    >
      <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
    </Button>
  );

  return (
    <div>
      <PageHeader
        title="User management"
        description="Create accounts, manage Unity auto-created students, set real emails for dashboard login, and reset passwords."
        actions={refreshButton}
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

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card className="border-sky-200/80 bg-sky-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Web dashboard login</CardTitle>
            <CardDescription>
              Teachers and students sign in with <strong>email + password</strong>. Use a real address
              (Gmail, school email, etc.) when creating accounts so users can log in on the website.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-violet-200/80 bg-violet-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gamepad2 className="h-4 w-4" />
              Unity game login
            </CardTitle>
            <CardDescription>
              Students can enter an ID in Unity — a profile is created automatically (placeholder name
              and email). Edit those students here and add a real email + password for web access.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card className="mb-6 border-amber-200/80 bg-amber-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Password reset</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>
            Users with a <strong>real email</strong> can use{" "}
            <Link href="/forgot-password" className="text-primary hover:underline">
              Forgot password
            </Link>{" "}
            on the login page. Admins can also reset passwords from the table below.
          </p>
          <p>
            Unity-only accounts (auto email) must get a real email added via <strong>Edit</strong>{" "}
            before they can use self-service reset.
          </p>
          <p>
            Production email: set <code className="text-xs">RESEND_API_KEY</code> and{" "}
            <code className="text-xs">EMAIL_FROM</code> (e.g.{" "}
            <code className="text-xs">SPARC &lt;noreply@yourdomain.com&gt;</code>).
          </p>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "teachers" | "students")}>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TabsList>
            <TabsTrigger value="teachers">Teachers & admins ({teachers.length})</TabsTrigger>
            <TabsTrigger value="students">Students ({students.length})</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, ID…"
                className="pl-9"
              />
            </div>
            {tab === "students" && (
              <Select
                value={studentFilter}
                onValueChange={(v) => setStudentFilter(v as StudentFilter)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All students</SelectItem>
                  <SelectItem value="unity">Unity-created</SelectItem>
                  <SelectItem value="needs-email">Needs real email</SelectItem>
                  <SelectItem value="needs-name">Needs name</SelectItem>
                </SelectContent>
              </Select>
            )}
            {tab === "teachers" ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setDialog({ type: "create-teacher" })}
                disabled={busy}
                className="gap-2"
              >
                <UserPlus className="h-4 w-4" />
                New teacher
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => setDialog({ type: "create-student" })}
                disabled={busy}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                New student
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="teachers">
          <UserTable
            users={filteredTeachers}
            loading={loading}
            busy={busy}
            onEdit={(u) => setDialog({ type: "edit", user: u })}
            onResetPassword={(u) => setDialog({ type: "reset-password", user: u })}
            onToggleActive={(u) => void toggleActive(u)}
          />
        </TabsContent>
        <TabsContent value="students">
          <UserTable
            users={filteredStudents}
            loading={loading}
            busy={busy}
            showStudentColumns
            onEdit={(u) => setDialog({ type: "edit", user: u })}
            onResetPassword={(u) => setDialog({ type: "reset-password", user: u })}
            onToggleActive={(u) => void toggleActive(u)}
            onToggleArchive={(u) => void toggleArchive(u)}
          />
        </TabsContent>
      </Tabs>

      <CreateTeacherDialog
        open={dialog?.type === "create-teacher"}
        busy={busy}
        onOpenChange={(open) => !open && setDialog(null)}
        onSuccess={async (text) => {
          setDialog(null);
          setMessage({ text, ok: true });
          await load();
        }}
        onError={(text) => setMessage({ text, ok: false })}
        setBusy={setBusy}
      />
      <CreateStudentDialog
        open={dialog?.type === "create-student"}
        busy={busy}
        onOpenChange={(open) => !open && setDialog(null)}
        onSuccess={async (text) => {
          setDialog(null);
          setMessage({ text, ok: true });
          await load();
        }}
        onError={(text) => setMessage({ text, ok: false })}
        setBusy={setBusy}
      />
      {dialog?.type === "edit" && (
        <EditUserDialog
          user={dialog.user}
          busy={busy}
          onOpenChange={(open) => !open && setDialog(null)}
          onSuccess={async (text) => {
            setDialog(null);
            setMessage({ text, ok: true });
            await load();
          }}
          onError={(text) => setMessage({ text, ok: false })}
          setBusy={setBusy}
        />
      )}
      {dialog?.type === "reset-password" && (
        <ResetPasswordDialog
          user={dialog.user}
          busy={busy}
          onOpenChange={(open) => !open && setDialog(null)}
          onSuccess={(text) => {
            setDialog(null);
            setMessage({ text, ok: true });
          }}
          onError={(text) => setMessage({ text, ok: false })}
          setBusy={setBusy}
        />
      )}
    </div>
  );
}

function UserTable({
  users,
  loading,
  busy,
  showStudentColumns,
  onEdit,
  onResetPassword,
  onToggleActive,
  onToggleArchive,
}: {
  users: AdminUser[];
  loading: boolean;
  busy: boolean;
  showStudentColumns?: boolean;
  onEdit: (u: AdminUser) => void;
  onResetPassword: (u: AdminUser) => void;
  onToggleActive: (u: AdminUser) => void;
  onToggleArchive?: (u: AdminUser) => void;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Loading users…
        </CardContent>
      </Card>
    );
  }
  if (users.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No users match your search.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              {showStudentColumns ? (
                <>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Source</TableHead>
                </>
              ) : (
                <TableHead>Role</TableHead>
              )}
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{u.displayName || "—"}</span>
                    {u.isPlaceholderName && (
                      <Badge variant="warning" className="w-fit text-[10px]">
                        Placeholder name
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="break-all text-sm">{u.email}</span>
                    {u.isPlaceholderEmail && (
                      <Badge variant="secondary" className="w-fit text-[10px]">
                        Auto email
                      </Badge>
                    )}
                  </div>
                </TableCell>
                {showStudentColumns ? (
                  <>
                    <TableCell>
                      <span className="font-mono text-xs">{u.externalId ?? "—"}</span>
                    </TableCell>
                    <TableCell>
                      {u.accountSource === "unity" ? (
                        <Badge variant="secondary" className="gap-1">
                          <Gamepad2 className="h-3 w-3" />
                          Unity
                        </Badge>
                      ) : (
                        <Badge variant="outline">Admin</Badge>
                      )}
                    </TableCell>
                  </>
                ) : (
                  <TableCell>
                    <Badge variant={u.role === UserRole.ADMIN ? "default" : "secondary"}>
                      {u.role}
                    </Badge>
                  </TableCell>
                )}
                <TableCell>
                  {!u.isActive ? (
                    <Badge variant="danger">Inactive</Badge>
                  ) : u.isArchived ? (
                    <Badge variant="warning">Archived</Badge>
                  ) : (
                    <Badge variant="success">Active</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {showStudentColumns && u.profileId && (
                      <Button type="button" variant="outline" size="sm" asChild>
                        <Link href={`/teacher/students/${u.profileId}`}>
                          <ExternalLink className="h-3.5 w-3.5" />
                          Profile
                        </Link>
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(u)}
                      disabled={busy}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onResetPassword(u)}
                      disabled={busy}
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      Reset
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onToggleActive(u)}
                      disabled={busy}
                    >
                      {u.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    {onToggleArchive && u.role === UserRole.STUDENT && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onToggleArchive(u)}
                        disabled={busy}
                      >
                        {u.isArchived ? "Unarchive" : "Archive"}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function FormField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function CreateTeacherDialog({
  open,
  busy,
  onOpenChange,
  onSuccess,
  onError,
  setBusy,
}: {
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (text: string) => void | Promise<void>;
  onError: (text: string) => void;
  setBusy: (v: boolean) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<"TEACHER" | "ADMIN">("TEACHER");
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDisplayName("");
      setEmail("");
      setPassword("");
      setConfirm("");
      setRole("TEACHER");
      setFieldError(null);
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(null);
    if (!displayName.trim()) return setFieldError("Display name is required.");
    if (!email.trim()) return setFieldError("Email is required.");
    if (password.length < 8) return setFieldError("Password must be at least 8 characters.");
    if (!passwordsMatch(password, confirm)) return setFieldError("Passwords do not match.");

    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "teacher",
          displayName: displayName.trim(),
          email: email.trim(),
          password,
          role,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(parseApiError(data, "Create failed"));
      await onSuccess(`Created ${role === "ADMIN" ? "admin" : "teacher"}: ${email.trim()}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create teacher account</DialogTitle>
          <DialogDescription>
            Use a real email (Gmail, school domain, etc.) — this is the web login username.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <FormField id="teacher-name" label="Display name">
            <Input
              id="teacher-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Jane Smith"
              autoComplete="name"
            />
          </FormField>
          <FormField id="teacher-email" label="Email" hint="Used to sign in to the dashboard">
            <Input
              id="teacher-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teacher@school.edu"
              autoComplete="email"
            />
          </FormField>
          <FormField id="teacher-role" label="Role">
            <Select value={role} onValueChange={(v) => setRole(v as "TEACHER" | "ADMIN")}>
              <SelectTrigger id="teacher-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TEACHER">Teacher</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField id="teacher-password" label="Password">
            <Input
              id="teacher-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </FormField>
          <FormField id="teacher-confirm" label="Confirm password">
            <Input
              id="teacher-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </FormField>
          {fieldError && <p className="text-sm text-destructive">{fieldError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Create account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateStudentDialog({
  open,
  busy,
  onOpenChange,
  onSuccess,
  onError,
  setBusy,
}: {
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (text: string) => void | Promise<void>;
  onError: (text: string) => void;
  setBusy: (v: boolean) => void;
}) {
  const [externalId, setExternalId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("ChangeMe123!");
  const [confirm, setConfirm] = useState("ChangeMe123!");
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setExternalId("");
      setDisplayName("");
      setEmail("");
      setPassword("ChangeMe123!");
      setConfirm("ChangeMe123!");
      setFieldError(null);
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(null);
    if (!externalId.trim()) return setFieldError("Student ID is required.");
    if (password.length < 8) return setFieldError("Password must be at least 8 characters.");
    if (!passwordsMatch(password, confirm)) return setFieldError("Passwords do not match.");

    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "student",
          externalId: externalId.trim(),
          ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
          ...(email.trim() ? { email: email.trim() } : {}),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(parseApiError(data, "Create failed"));
      await onSuccess(`Created student ${externalId.trim()}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create student account</DialogTitle>
          <DialogDescription>
            Student ID is used in Unity. Add a real email so the student can also log into the web
            dashboard.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <FormField
            id="student-id"
            label="Student ID"
            hint="Game login — e.g. 1001 or STU-1001"
          >
            <Input
              id="student-id"
              value={externalId}
              onChange={(e) => setExternalId(e.target.value)}
              placeholder="STU-1001"
              className="font-mono"
            />
          </FormField>
          <FormField
            id="student-name"
            label="Display name (optional)"
            hint="Leave blank to use “Student {ID}”"
          >
            <Input
              id="student-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Alex Johnson"
            />
          </FormField>
          <FormField
            id="student-email"
            label="Email (optional)"
            hint="Recommended: Gmail or school email for web login. Auto-generated if empty."
          >
            <Input
              id="student-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@gmail.com"
              autoComplete="email"
            />
          </FormField>
          <FormField id="student-password" label="Password">
            <Input
              id="student-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </FormField>
          <FormField id="student-confirm" label="Confirm password">
            <Input
              id="student-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </FormField>
          {fieldError && <p className="text-sm text-destructive">{fieldError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Create student
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  user,
  busy,
  onOpenChange,
  onSuccess,
  onError,
  setBusy,
}: {
  user: AdminUser;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (text: string) => void | Promise<void>;
  onError: (text: string) => void;
  setBusy: (v: boolean) => void;
}) {
  const isStudent = user.role === UserRole.STUDENT;
  const [displayName, setDisplayName] = useState(user.displayName);
  const [email, setEmail] = useState(user.email);
  const [externalId, setExternalId] = useState(user.externalId ?? "");
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(user.displayName);
    setEmail(user.email);
    setExternalId(user.externalId ?? "");
    setFieldError(null);
  }, [user]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(null);
    if (!displayName.trim()) return setFieldError("Display name is required.");
    if (!email.trim()) return setFieldError("Email is required.");
    if (isStudent && !externalId.trim()) return setFieldError("Student ID is required.");

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          email: email.trim(),
          ...(isStudent ? { externalId: externalId.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(parseApiError(data, "Update failed"));
      await onSuccess(`Updated ${email.trim()}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {isStudent ? "student" : "teacher"}</DialogTitle>
          <DialogDescription>
            {isStudent && user.isPlaceholderEmail
              ? "Set a real email so this student can log into the web dashboard with email + password."
              : "Update account details."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <FormField id="edit-name" label="Display name">
            <Input
              id="edit-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </FormField>
          <FormField
            id="edit-email"
            label="Email"
            hint="Any valid email — Gmail, Outlook, school domain, etc."
          >
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>
          {isStudent && (
            <FormField id="edit-id" label="Student ID (Unity login)">
              <Input
                id="edit-id"
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
                className="font-mono"
              />
            </FormField>
          )}
          {fieldError && <p className="text-sm text-destructive">{fieldError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  user,
  busy,
  onOpenChange,
  onSuccess,
  onError,
  setBusy,
}: {
  user: AdminUser;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (text: string) => void;
  onError: (text: string) => void;
  setBusy: (v: boolean) => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    setPassword("");
    setConfirm("");
    setFieldError(null);
  }, [user.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(null);
    if (password.length < 8) return setFieldError("Password must be at least 8 characters.");
    if (!passwordsMatch(password, confirm)) return setFieldError("Passwords do not match.");

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(parseApiError(data, "Reset failed"));
      onSuccess(`Password updated for ${user.email}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Set a new password for <strong>{user.email}</strong>. The user signs in on the web with
            email + this password. Share it securely — automated email reset is not configured yet.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <FormField id="reset-password" label="New password">
            <Input
              id="reset-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </FormField>
          <FormField id="reset-confirm" label="Confirm password">
            <Input
              id="reset-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </FormField>
          {fieldError && <p className="text-sm text-destructive">{fieldError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Update password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
