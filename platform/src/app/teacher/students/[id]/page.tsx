import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { assertStudentAccess, resolveTeacherScope } from "@/lib/class-access";
import { getStudentProgress } from "@/lib/analytics";
import { formatStudentAttemptItemLabelFromAttempt } from "@/lib/student-item-label";
import { getPlayableLevelsForStudent } from "@/lib/level-assignments";
import { parseAttemptRunMeta, formatAttemptRunLabel } from "@/lib/attempt-mistakes";
import { prisma } from "@/lib/prisma";
import { TeacherShell } from "@/components/teacher/teacher-shell";
import { StudentProfileView } from "@/components/teacher/student-profile-view";

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
  const studentCode = student.externalId ?? student.id;
  const playableLevels = await getPlayableLevelsForStudent(studentCode);
  const playableRefs = playableLevels.map((l) => ({
    id: l.id,
    name: l.name,
    levelKey: l.levelKey,
    levelType: l.levelType,
  }));

  const recentAttempts = await prisma.levelAttempt.findMany({
    where: { studentId: student.id },
    include: { level: true },
    orderBy: { startedAt: "desc" },
    take: 50,
  });

  return (
    <TeacherShell title={student.displayName} userName={session?.user.name}>
      <StudentProfileView
        student={{
          id: student.id,
          displayName: student.displayName,
          email: student.user.email,
          externalId: student.externalId,
          classes: student.classMemberships.map((c) => c.class.name),
        }}
        summary={progress.summary}
        levels={progress.levels.map((l) => ({
          levelId: l.levelId,
          name: l.name,
          status: l.status,
          passed: l.passed,
          attempts: l.attempts,
          score: l.score,
          totalTimeSeconds: l.totalTimeSeconds,
          finalCommand: l.finalCommand,
          lastAttemptAt: l.lastAttemptAt?.toISOString() ?? null,
        }))}
        attempts={recentAttempts.map((a) => {
          const runMeta = parseAttemptRunMeta(a.mistakes);
          return {
            id: a.id,
            levelId: a.levelId,
            levelName: formatStudentAttemptItemLabelFromAttempt(playableRefs, {
              levelId: a.levelId,
              levelName: a.level.name,
              mistakes: a.mistakes,
            }),
            attemptNumber: a.attemptNumber,
            attemptLabel: formatAttemptRunLabel(a.attemptNumber, runMeta),
            status: a.status,
            passed: a.passed,
            score: a.score,
            startedAt: a.startedAt.toISOString(),
            totalTimeSeconds: a.totalTimeSeconds,
          };
        })}
      />
    </TeacherShell>
  );
}
