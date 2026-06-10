import { getServerSession } from "next-auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { assertStudentAccess, resolveTeacherScope } from "@/lib/class-access";
import { getStudentProgress } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { formatDuration } from "@/lib/utils";
import { TeacherShell } from "@/components/teacher/teacher-shell";
import { PageHeader } from "@/components/assessment/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/status-badge";
import { AttemptStatus } from "@prisma/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LevelAssignmentEditor } from "@/components/teacher/level-assignment-editor";
import { ExcelExportButton } from "@/components/teacher/excel-export-button";

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  const { id } = await params;
  const scope = await resolveTeacherScope(session!.user);

  if (!(await assertStudentAccess(scope, id))) notFound();

  const student = await prisma.studentProfile.findUnique({
    where: { id },
    include: { user: true, classMemberships: { include: { class: true } } },
  });
  if (!student) notFound();

  const progress = await getStudentProgress(student.id);
  const recentAttempts = await prisma.levelAttempt.findMany({
    where: { studentId: student.id },
    include: { level: true },
    orderBy: { startedAt: "desc" },
    take: 10,
  });

  return (
    <TeacherShell title={student.displayName} userName={session?.user.name}>
      <PageHeader
        title={student.displayName}
        description={`${student.user.email} · ID ${student.externalId ?? "—"}`}
        breadcrumbs={[
          { label: "Students", href: "/teacher/students" },
          { label: student.displayName },
        ]}
        actions={
          <ExcelExportButton
            url={`/api/teacher/students/${student.id}/export`}
            label="Download Excel"
          />
        }
      />

      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <StatCard title="Completion" value={`${progress.summary.completionPercent}%`} />
        <StatCard title="Passed" value={progress.summary.passed} tone="success" />
        <StatCard title="Failed" value={progress.summary.failed} tone="danger" />
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Class progress</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={progress.summary.completionPercent} className="h-2" />
            <p className="mt-2 text-xs text-muted-foreground">
              {student.classMemberships.map((c) => c.class.name).join(", ") || "No class assigned"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-8">
        <LevelAssignmentEditor
          target="student"
          targetId={student.id}
          targetName={student.displayName}
        />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Item Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Final Command</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {progress.levels.map((l) => (
                <TableRow key={l.levelId}>
                  <TableCell>{l.name}</TableCell>
                  <TableCell>
                    <StatusBadge status={l.status as AttemptStatus} passed={l.passed} />
                  </TableCell>
                  <TableCell>{l.attempts}</TableCell>
                  <TableCell>{l.score ?? "—"}</TableCell>
                  <TableCell>{formatDuration(l.totalTimeSeconds)}</TableCell>
                  <TableCell className="max-w-xs truncate font-mono text-xs">{l.finalCommand ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attempt History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>#</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Started</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentAttempts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.level.name}</TableCell>
                  <TableCell>{a.attemptNumber}</TableCell>
                  <TableCell>
                    <StatusBadge status={a.status} passed={a.passed} />
                  </TableCell>
                  <TableCell>{a.score ?? "—"}</TableCell>
                  <TableCell>{new Date(a.startedAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <Link href={`/teacher/attempts/${a.id}`} className="text-primary hover:underline">
                      View evidence
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </TeacherShell>
  );
}
