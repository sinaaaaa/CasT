import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getStudentProgress } from "@/lib/analytics";
import { StudentShell } from "@/components/student/student-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { AttemptStatus } from "@prisma/client";

export default async function StudentLevelsPage() {
  const session = await getServerSession(authOptions);
  const progress = await getStudentProgress(session!.user.studentProfileId!);

  return (
    <StudentShell title="Items" userName={session?.user.name}>
      <div className="grid gap-4 md:grid-cols-2">
        {progress.levels.map((l) => (
          <Card key={l.levelId}>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>{l.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{l.levelKey}</p>
              </div>
              <StatusBadge status={l.status as AttemptStatus} passed={l.passed} />
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Score: {l.score ?? "—"}</p>
              <p>Attempts: {l.attempts}</p>
              {l.feedback && <p className="text-muted-foreground">{l.feedback}</p>}
              <Link href={`/student/levels/${l.levelId}`} className="text-primary hover:underline">
                View details →
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </StudentShell>
  );
}
