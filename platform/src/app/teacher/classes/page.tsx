import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { classScopeWhere, resolveTeacherScope } from "@/lib/class-access";
import { prisma } from "@/lib/prisma";
import { TeacherShell } from "@/components/teacher/teacher-shell";
import { ClassesHub } from "@/components/teacher/classes-hub";

export default async function TeacherClassesPage() {
  const session = await getServerSession(authOptions);
  const scope = await resolveTeacherScope(session!.user);
  const classes = await prisma.class.findMany({
    where: classScopeWhere(scope),
    include: { _count: { select: { students: true, levelAttempts: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <TeacherShell title="Classes" userName={session?.user.name}>
      <ClassesHub
        classes={classes.map((c) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          description: c.description,
          studentCount: c._count.students,
          attemptCount: c._count.levelAttempts,
        }))}
      />
    </TeacherShell>
  );
}
