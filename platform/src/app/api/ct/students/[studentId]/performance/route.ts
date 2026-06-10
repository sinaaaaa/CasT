import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { requireStudentAccess } from "@/lib/class-access";
import { getStudentCTPerformance } from "@/lib/ct/analytics";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { error, scope } = await requireTeacher();
  if (error) return error;

  const { studentId } = await params;
  const denied = await requireStudentAccess(scope!, studentId);
  if (denied) return denied;

  const student = await prisma.studentProfile.findUnique({ where: { id: studentId } });
  if (!student) return Response.json({ error: "Student not found" }, { status: 404 });

  const data = await getStudentCTPerformance(studentId);
  return Response.json(data);
}
