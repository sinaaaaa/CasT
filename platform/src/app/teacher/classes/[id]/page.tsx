import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getClassProgress } from "@/lib/analytics";
import {
  assertClassAccess,
  resolveTeacherScope,
  studentScopeWhere,
} from "@/lib/class-access";
import { prisma } from "@/lib/prisma";
import { TeacherShell } from "@/components/teacher/teacher-shell";
import { LevelAssignmentEditor } from "@/components/teacher/level-assignment-editor";
import { ClassDetailActions } from "@/components/teacher/class-detail-actions";
import { ClassStudentsPanel } from "@/components/teacher/class-students-panel";
import { ClassReportSection } from "@/components/teacher/class-report-section";

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const { id } = await params;
  const scope = await resolveTeacherScope(session!.user);

  if (!assertClassAccess(scope, id)) notFound();

  const [cls, scopedStudents, classReport] = await Promise.all([
    prisma.class.findUnique({
      where: { id },
      include: {
        students: {
          include: {
            student: {
              include: { _count: { select: { levelAttempts: true } } },
            },
          },
        },
      },
    }),
    prisma.studentProfile.findMany({
      where: studentScopeWhere(scope),
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, externalId: true },
    }),
    getClassProgress(id),
  ]);

  if (!cls || !classReport) notFound();

  const memberIds = new Set(cls.students.map((m) => m.studentId));
  const members = cls.students.map(({ student }) => ({
    id: student.id,
    displayName: student.displayName,
    externalId: student.externalId,
    attemptCount: student._count.levelAttempts,
  }));
  const candidates = scopedStudents.filter((s) => !memberIds.has(s.id));

  return (
    <TeacherShell title={cls.name} userName={session?.user.name}>
      <ClassDetailActions classId={cls.id} className={cls.name} classCode={cls.code} />

      <ClassReportSection report={classReport} />

      <div className="mb-8">
        <LevelAssignmentEditor target="class" targetId={cls.id} targetName={cls.name} />
      </div>

      <ClassStudentsPanel
        classId={cls.id}
        className={cls.name}
        description={cls.description}
        members={members}
        candidates={candidates}
      />
    </TeacherShell>
  );
}
