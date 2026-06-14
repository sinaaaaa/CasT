import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TeacherShell } from "@/components/teacher/teacher-shell";
import { StudentsHub, type StudentRow } from "@/components/teacher/students-hub";
import { studentScopeWhere, classScopeWhere, resolveTeacherScope } from "@/lib/class-access";
import { getStudentsListSummaries, studentNeedsCheckIn } from "@/lib/analytics";

export default async function TeacherStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; classId?: string; assignment?: string; needsHelp?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const { q, classId, assignment, needsHelp } = await searchParams;
  const scope = await resolveTeacherScope(session!.user);

  const students = await prisma.studentProfile.findMany({
    where: {
      ...studentScopeWhere(scope),
      ...(q
        ? {
            OR: [
              { displayName: { contains: q, mode: "insensitive" } },
              { externalId: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(classId ? { classMemberships: { some: { classId } } } : {}),
      ...(assignment === "custom"
        ? { assignedLevels: { some: { isActive: true } } }
        : assignment === "none"
          ? { assignedLevels: { none: { isActive: true } } }
          : {}),
    },
    include: {
      user: { select: { email: true } },
      classMemberships: { include: { class: true } },
      assignedLevels: { where: { isActive: true }, select: { id: true } },
    },
    orderBy: { displayName: "asc" },
  });

  const studentIds = students.map((s) => s.id);
  const [summaries, recentAttemptsByStudent] = await Promise.all([
    getStudentsListSummaries(studentIds),
    prisma.levelAttempt.findMany({
      where: { studentId: { in: studentIds } },
      select: { studentId: true, passed: true, endedAt: true, startedAt: true },
      orderBy: { startedAt: "desc" },
    }),
  ]);

  const checkInAttemptsByStudent = new Map<
    string,
    { passed: boolean; endedAt: Date | null; startedAt: Date }[]
  >();
  for (const attempt of recentAttemptsByStudent) {
    const list = checkInAttemptsByStudent.get(attempt.studentId) ?? [];
    if (list.length < 3) list.push(attempt);
    checkInAttemptsByStudent.set(attempt.studentId, list);
  }

  const classes = await prisma.class.findMany({
    where: classScopeWhere(scope),
    orderBy: { name: "asc" },
  });

  const rows: StudentRow[] = students
    .map((s) => {
      const summary = summaries.get(s.id) ?? {
        passed: 0,
        failed: 0,
        incomplete: 0,
        totalLevels: 0,
        completionPercent: 0,
        avgScore: 0,
      };
      const checkInAttempts = checkInAttemptsByStudent.get(s.id) ?? [];
      return {
        id: s.id,
        displayName: s.displayName,
        externalId: s.externalId,
        email: s.user.email,
        classes: s.classMemberships.map((c) => c.class.name).join(", "),
        passed: summary.passed,
        failed: summary.failed,
        avg: summary.avgScore,
        completionPercent: summary.completionPercent,
        assignedLevelCount: s.assignedLevels.length,
        needsHelp: studentNeedsCheckIn(checkInAttempts),
      };
    })
    .filter((row) => (needsHelp === "1" ? row.needsHelp : true));

  return (
    <TeacherShell title="Students" userName={session?.user.name}>
      <StudentsHub
        students={rows}
        classes={classes.map((c) => ({ id: c.id, name: c.name }))}
        initialQ={q}
        initialClassId={classId}
        initialAssignment={assignment}
        initialNeedsHelp={needsHelp === "1"}
      />
    </TeacherShell>
  );
}
