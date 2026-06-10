import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { resolveTeacherScope, studentScopeWhere } from "@/lib/class-access";
import { getAllClassesProgress, getTeacherDashboardStats } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { TeacherShell } from "@/components/teacher/teacher-shell";
import { ClassReportsExportButton } from "@/components/teacher/class-reports-export-button";
import { ExcelExportButton } from "@/components/teacher/excel-export-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function TeacherReportsPage() {
  const session = await getServerSession(authOptions);
  const scope = await resolveTeacherScope(session!.user);
  const [stats, students, classReports] = await Promise.all([
    getTeacherDashboardStats({ scopeClassIds: scope.classIds }),
    prisma.studentProfile.findMany({
      where: studentScopeWhere(scope),
      orderBy: { displayName: "asc" },
    }),
    getAllClassesProgress(scope.classIds),
  ]);

  return (
    <TeacherShell title="Reports" userName={session?.user.name}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Download spreadsheets for analysis in Excel or Google Sheets.
        </p>
        <div className="flex flex-wrap gap-2">
          <ExcelExportButton url="/api/teacher/export/analytics" label="Analytics (Excel)" />
          <ExcelExportButton url="/api/teacher/export/items" label="All items (Excel)" />
          <ExcelExportButton
            url="/api/teacher/export/assessment"
            method="POST"
            body={{ allStudents: true }}
            filename="sparc-assessment-export.xlsx"
            label="All attempts detail (Excel)"
          />
        </div>
      </div>

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Gameplay summary (your students)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Total attempts: {stats.totalAttempts}</p>
            <p>Passed attempts: {stats.completedLevels}</p>
            <p>Failed attempts: {stats.failedLevels}</p>
            <p>Average score: {stats.avgScore}%</p>
            <p>Average time per item: {Math.round(stats.avgTimeSeconds)}s</p>
            <p>Students needing help: {stats.needsHelp}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Status breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Correct: {stats.statusCounts.correct}</p>
            <p>Incorrect: {stats.statusCounts.incorrect}</p>
            <p>Incomplete: {stats.statusCounts.incomplete}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle>Class reports</CardTitle>
          {classReports.length > 0 && <ClassReportsExportButton />}
        </CardHeader>
        <CardContent>
          {classReports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No classes yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Passed</TableHead>
                  <TableHead>Failed</TableHead>
                  <TableHead>Not started</TableHead>
                  <TableHead>Completion</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {classReports.map((report) => (
                  <TableRow key={report.class.id}>
                    <TableCell>
                      <span className="font-medium">{report.class.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{report.class.code}</span>
                    </TableCell>
                    <TableCell>{report.studentCount}</TableCell>
                    <TableCell className="text-emerald-700">{report.summary.passed}</TableCell>
                    <TableCell className="text-red-700">{report.summary.failed}</TableCell>
                    <TableCell>{report.summary.incomplete}</TableCell>
                    <TableCell>{report.summary.completionPercent}%</TableCell>
                    <TableCell>{report.summary.totalAttempts}</TableCell>
                    <TableCell>
                      <Link
                        href={`/teacher/classes/${report.class.id}`}
                        className="text-primary hover:underline"
                      >
                        Open report
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Passed / failed counts are student × item totals (same as each student profile). Open a
            class for per-item breakdown.
          </p>
        </CardContent>
      </Card>

      <p className="mb-4 text-sm text-muted-foreground">
        Per-attempt diagnosis (route comparison, repair quality, robot outcome) is available when
        you open a student attempt — not via weighted CT construct profiles.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Students</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {students.map((s) => (
              <p key={s.id}>
                <Link href={`/teacher/students/${s.id}`} className="text-primary hover:underline">
                  {s.displayName}
                </Link>
              </p>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Classes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {classReports.map((report) => (
              <p key={report.class.id}>
                <Link
                  href={`/teacher/classes/${report.class.id}`}
                  className="text-primary hover:underline"
                >
                  {report.class.name}
                </Link>
                <span className="ml-2 text-muted-foreground">
                  {report.summary.completionPercent}% · {report.summary.passed} passed ·{" "}
                  {report.summary.failed} failed
                </span>
              </p>
            ))}
          </CardContent>
        </Card>
      </div>
    </TeacherShell>
  );
}
