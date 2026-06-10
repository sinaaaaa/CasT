import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStudentProgress } from "@/lib/analytics";
import { formatDuration } from "@/lib/utils";
import { StudentShell } from "@/components/student/student-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { AttemptStatus } from "@prisma/client";

export default async function StudentProgressPage() {
  const session = await getServerSession(authOptions);
  const progress = await getStudentProgress(session!.user.studentProfileId!);

  return (
    <StudentShell title="Progress" userName={session?.user.name}>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Course completion</CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={progress.summary.completionPercent} />
          <p className="mt-2 text-sm text-muted-foreground">
            {progress.summary.passed} of {progress.summary.totalLevels} items passed
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Item breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Attempts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {progress.levels.map((l) => (
                <TableRow key={l.levelId}>
                  <TableCell>{l.name}</TableCell>
                  <TableCell>
                    <StatusBadge status={l.status as AttemptStatus} passed={l.passed} />
                  </TableCell>
                  <TableCell>{l.score ?? "—"}</TableCell>
                  <TableCell>{formatDuration(l.totalTimeSeconds)}</TableCell>
                  <TableCell>{l.attempts}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </StudentShell>
  );
}
