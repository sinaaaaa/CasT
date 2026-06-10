import { requireTeacher } from "@/lib/api-auth";
import { requireStudentAccess } from "@/lib/class-access";
import { prisma } from "@/lib/prisma";
import { excelResponse } from "@/lib/export-excel-common";
import { buildStudentProgressWorkbook } from "@/lib/export-student-progress-excel";

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
    select: { id: true, externalId: true },
  });
  if (!student) {
    return Response.json({ error: "Student not found" }, { status: 404 });
  }

  const { buffer, filename } = await buildStudentProgressWorkbook(student.id, student.externalId);
  return excelResponse(buffer, filename);
}
