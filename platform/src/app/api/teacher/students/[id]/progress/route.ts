import { requireTeacher } from "@/lib/api-auth";
import { requireStudentAccess } from "@/lib/class-access";
import { getStudentProgress } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, scope } = await requireTeacher();
  if (error) return error;

  const { id } = await params;
  const denied = await requireStudentAccess(scope!, id);
  if (denied) return denied;

  const student = await prisma.studentProfile.findUnique({
    where: { id },
    include: { user: { select: { email: true } }, classMemberships: { include: { class: true } } },
  });

  if (!student) return Response.json({ error: "Student not found" }, { status: 404 });

  const progress = await getStudentProgress(student.id);
  return Response.json({
    student: {
      id: student.id,
      displayName: student.displayName,
      externalId: student.externalId,
      email: student.user.email,
      classes: student.classMemberships.map((c) => c.class),
    },
    ...progress,
  });
}
