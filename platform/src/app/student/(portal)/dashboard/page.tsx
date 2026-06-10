import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getStudentProgress } from "@/lib/analytics";
import { StudentShell } from "@/components/student/student-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/status-badge";
import { AttemptStatus } from "@prisma/client";

export default async function StudentDashboardPage() {
  const session = await getServerSession(authOptions);
  const studentProfileId = session!.user.studentProfileId!;
  const progress = await getStudentProgress(studentProfileId);

  return (
    <StudentShell title="Dashboard" userName={session?.user.name}>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Overall Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{progress.summary.completionPercent}%</p>
            <Progress value={progress.summary.completionPercent} className="mt-3" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Passed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-600">{progress.summary.passed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{progress.summary.failed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Incomplete</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-600">{progress.summary.incomplete}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Your Items</CardTitle>
          <Link href="/student/levels" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {progress.levels.slice(0, 5).map((l) => (
            <div key={l.levelId} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">{l.name}</p>
                <p className="text-xs text-muted-foreground">
                  Score: {l.score ?? "—"} · Attempts: {l.attempts}
                </p>
              </div>
              <StatusBadge status={l.status as AttemptStatus} passed={l.passed} />
            </div>
          ))}
        </CardContent>
      </Card>
    </StudentShell>
  );
}
