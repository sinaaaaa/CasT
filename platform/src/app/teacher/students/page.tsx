import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TeacherShell } from "@/components/teacher/teacher-shell";
import { StudentsHub, type StudentRow } from "@/components/teacher/students-hub";
import { AttemptStatus } from "@prisma/client";
import { studentScopeWhere, classScopeWhere, resolveTeacherScope, assertClassAccess } from "@/lib/class-access";
import { studentNeedsCheckIn } from "@/lib/analytics";

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
      levelAttempts: {
        orderBy: { startedAt: "desc" },
        take: 3,
        select: { passed: true, status: true, score: true, endedAt: true },
      },
      assignedLevels: { where: { isActive: true }, select: { id: true } },
    },
    orderBy: { displayName: "asc" },
  });

  const classes = await prisma.class.findMany({
    where: classScopeWhere(scope),
    orderBy: { name: "asc" },
  });

  const filteredStudents =
    needsHelp === "1"
      ? students.filter((s) => studentNeedsCheckIn(s.levelAttempts))
      : students;

  const rows: StudentRow[] = filteredStudents.map((s) => {
    const passed = s.levelAttempts.filter((a) => a.passed).length;
    const failed = s.levelAttempts.filter((a) => a.status === AttemptStatus.INCORRECT).length;
    const avg =
      s.levelAttempts.length > 0
        ? Math.round(s.levelAttempts.reduce((sum, a) => sum + (a.score ?? 0), 0) / s.levelAttempts.length)
        : 0;
    return {
      id: s.id,
      displayName: s.displayName,
      externalId: s.externalId,
      email: s.user.email,
      classes: s.classMemberships.map((c) => c.class.name).join(", "),
      passed,
      failed,
      avg,
      assignedLevelCount: s.assignedLevels.length,
      needsHelp: studentNeedsCheckIn(s.levelAttempts),
    };
  });

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
