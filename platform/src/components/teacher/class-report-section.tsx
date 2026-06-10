import Link from "next/link";
import type { ClassProgressReport } from "@/lib/analytics";
import { formatDuration } from "@/lib/utils";
import { PageHeader } from "@/components/assessment/page-header";
import { StatCard } from "@/components/stat-card";
import { ClassReportExportButton } from "@/components/teacher/class-report-export-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function ClassReportSection({ report }: { report: ClassProgressReport }) {
  const { summary, items, students, studentCount } = report;

  return (
    <section className="mb-8">
      <PageHeader
        title="Class report"
        description={`${studentCount} student${studentCount === 1 ? "" : "s"} · ${summary.totalItems} item${summary.totalItems === 1 ? "" : "s"} · Code ${report.class.code}`}
        breadcrumbs={[
          { label: "Classes", href: "/teacher/classes" },
          { label: report.class.name },
        ]}
        actions={
          <ClassReportExportButton classId={report.class.id} className={report.class.name} />
        }
      />

      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Completion" value={`${summary.completionPercent}%`} />
        <StatCard title="Passed" value={summary.passed} tone="success" subtitle="student × item" />
        <StatCard title="Failed" value={summary.failed} tone="danger" subtitle="student × item" />
        <StatCard
          title="Not started"
          value={summary.incomplete}
          tone="warning"
          subtitle="student × item"
        />
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Class progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={summary.completionPercent} className="h-2" />
            <p className="mt-2 text-xs text-muted-foreground">
              {summary.passed} of {summary.passed + summary.failed + summary.incomplete} student–item
              combinations passed
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Attempt totals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Total attempts: {summary.totalAttempts}</p>
            <p className="text-emerald-700">Passed attempts: {summary.passedAttempts}</p>
            <p className="text-red-700">Failed attempts: {summary.failedAttempts}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Item summary</CardTitle>
        </CardHeader>
        <CardContent>
          {studentCount === 0 ? (
            <p className="text-sm text-muted-foreground">Add students to this class to see item results.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Passed</TableHead>
                  <TableHead>Failed</TableHead>
                  <TableHead>Not started</TableHead>
                  <TableHead>Pass rate</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Avg score</TableHead>
                  <TableHead>Avg time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.levelId}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="text-emerald-700">{item.studentsPassed}</TableCell>
                    <TableCell className="text-red-700">{item.studentsFailed}</TableCell>
                    <TableCell>{item.studentsIncomplete}</TableCell>
                    <TableCell>{item.passRate}%</TableCell>
                    <TableCell>{item.totalAttempts}</TableCell>
                    <TableCell>{item.avgScore ?? "—"}</TableCell>
                    <TableCell>{formatDuration(item.avgTimeSeconds)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Students</CardTitle>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="text-sm text-muted-foreground">No students enrolled yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Passed</TableHead>
                  <TableHead>Failed</TableHead>
                  <TableHead>Not started</TableHead>
                  <TableHead>Completion</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s) => (
                  <TableRow key={s.studentId}>
                    <TableCell>{s.displayName}</TableCell>
                    <TableCell className="text-emerald-700">{s.passed}</TableCell>
                    <TableCell className="text-red-700">{s.failed}</TableCell>
                    <TableCell>{s.incomplete}</TableCell>
                    <TableCell>{s.completionPercent}%</TableCell>
                    <TableCell>
                      <Link
                        href={`/teacher/students/${s.studentId}`}
                        className="text-primary hover:underline"
                      >
                        View student
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
