import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDuration } from "@/lib/utils";
import { StudentShell } from "@/components/student/student-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";

export default async function StudentLevelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  const { id } = await params;
  const studentId = session!.user.studentProfileId!;

  const level = await prisma.level.findFirst({
    where: { OR: [{ id }, { levelKey: id }] },
  });
  if (!level) notFound();

  const attempts = await prisma.levelAttempt.findMany({
    where: { studentId, levelId: level.id },
    orderBy: { startedAt: "desc" },
  });

  const best = attempts.find((a) => a.passed) ?? attempts[0];

  return (
    <StudentShell title={level.name} userName={session?.user.name}>
      {best ? (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <StatusBadge status={best.status} passed={best.passed} />
            <span className="text-sm text-muted-foreground">Best score: {best.score ?? "—"}</span>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Final submitted command</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap rounded-lg bg-muted p-4 font-mono text-sm">
                {best.finalCommand ?? "—"}
              </pre>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Attempt history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {attempts.map((a) => (
                <div key={a.id} className="flex justify-between rounded border p-3">
                  <span>Attempt #{a.attemptNumber}</span>
                  <span>{formatDuration(a.totalTimeSeconds)}</span>
                  <StatusBadge status={a.status} passed={a.passed} />
                </div>
              ))}
            </CardContent>
          </Card>
          {best.feedback && (
            <Card>
              <CardHeader>
                <CardTitle>Feedback</CardTitle>
              </CardHeader>
              <CardContent>{best.feedback}</CardContent>
            </Card>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground">You have not attempted this level yet.</p>
      )}
    </StudentShell>
  );
}
