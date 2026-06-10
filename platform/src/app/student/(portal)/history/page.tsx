import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStudentProgress } from "@/lib/analytics";
import { formatDuration } from "@/lib/utils";
import { StudentShell } from "@/components/student/student-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { AttemptStatus } from "@prisma/client";

export default async function StudentHistoryPage() {
  const session = await getServerSession(authOptions);
  const progress = await getStudentProgress(session!.user.studentProfileId!);

  return (
    <StudentShell title="History" userName={session?.user.name}>
      <Card>
        <CardHeader>
          <CardTitle>All attempts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {progress.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attempts yet.</p>
          ) : (
            progress.history.map((h) => (
              <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <div>
                  <p className="font-medium">{h.level}</p>
                  <p className="text-muted-foreground">
                    {new Date(h.startedAt).toLocaleString()} · Attempt #{h.attemptNumber}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <StatusBadge status={h.status as AttemptStatus} passed={h.passed} />
                  <span>Score: {h.score ?? "—"}</span>
                  <span>{formatDuration(h.totalTimeSeconds)}</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </StudentShell>
  );
}
