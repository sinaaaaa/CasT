import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  assertLevelReadAccess,
  getScopedStudentIds,
  resolveTeacherScope,
} from "@/lib/class-access";
import { prisma } from "@/lib/prisma";
import { formatDuration, formatPercent } from "@/lib/utils";
import { TeacherShell } from "@/components/teacher/teacher-shell";
import {
  LevelDetailTabs,
  type LevelDetailPayload,
} from "@/components/teacher/level-detail-tabs";
import { type LevelAttemptRow } from "@/components/assessment/level-attempts-table";
import { LEVEL_TYPE_LABELS } from "@/lib/level-config";
import { AttemptStatus } from "@prisma/client";

async function LevelDetailContent({ id }: { id: string }) {
  const session = await getServerSession(authOptions);
  const scope = await resolveTeacherScope(session!.user);
  const scopedStudentIds = await getScopedStudentIds(scope);

  const level = await prisma.level.findFirst({
    where: { OR: [{ id }, { levelKey: id }] },
  });
  if (!level) notFound();
  if (!assertLevelReadAccess(scope, level)) notFound();

  const attempts = await prisma.levelAttempt.findMany({
    where: {
      levelId: level.id,
      ...(scopedStudentIds === null
        ? {}
        : scopedStudentIds.length
          ? { studentId: { in: scopedStudentIds } }
          : { studentId: { in: [] as string[] } }),
    },
    include: { student: true },
    orderBy: { startedAt: "desc" },
  });

  const passed = attempts.filter((a) => a.passed).length;
  const passRate = attempts.length > 0 ? Math.round((passed / attempts.length) * 100) : 0;
  const scored = attempts.filter((a) => a.score != null);
  const avgScore =
    scored.length > 0
      ? Math.round(scored.reduce((s, a) => s + (a.score ?? 0), 0) / scored.length)
      : null;
  const avgTime =
    attempts.length > 0
      ? attempts.reduce((s, a) => s + (a.totalTimeSeconds ?? 0), 0) / attempts.length
      : 0;

  const chartData = [
    { name: "Correct", value: attempts.filter((a) => a.status === AttemptStatus.CORRECT || a.passed).length },
    { name: "Incorrect", value: attempts.filter((a) => a.status === AttemptStatus.INCORRECT).length },
    { name: "Incomplete", value: attempts.filter((a) => a.status === AttemptStatus.INCOMPLETE).length },
  ];

  const rows: LevelAttemptRow[] = attempts.map((a) => ({
    id: a.id,
    studentId: a.studentId,
    studentName: a.student.displayName,
    attemptNumber: a.attemptNumber,
    status: a.status,
    passed: a.passed,
    score: a.score,
    totalTimeSeconds: a.totalTimeSeconds,
    robotTouched: a.robotTouched,
    robotTouchCount: a.robotTouchCount,
    startedAt: a.startedAt.toISOString(),
  }));

  const payload: LevelDetailPayload = {
    id: level.id,
    levelKey: level.levelKey,
    name: level.name,
    description: level.description,
    orderIndex: level.orderIndex,
    difficulty: level.difficulty,
    levelTypeLabel: LEVEL_TYPE_LABELS[level.levelType],
    published: level.published,
    metrics: {
      attemptCount: attempts.length,
      passRate,
      passLabel: formatPercent(passed, attempts.length),
      avgScore,
      uniqueStudents: new Set(attempts.map((a) => a.studentId)).size,
      avgTimeLabel: `Avg time ${formatDuration(avgTime)}`,
    },
    chartData,
    attempts: rows,
  };

  return <LevelDetailTabs level={payload} />;
}

export default async function LevelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const { id } = await params;

  return (
    <TeacherShell title="Item" userName={session?.user.name}>
      <Suspense
        fallback={
          <p className="py-12 text-center text-sm text-muted-foreground">Loading item…</p>
        }
      >
        <LevelDetailContent id={id} />
      </Suspense>
    </TeacherShell>
  );
}
