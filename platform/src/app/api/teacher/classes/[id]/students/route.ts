import { NextRequest } from "next/server";
import { z } from "zod";
import { assertClassAccess } from "@/lib/class-access";
import { requireTeacher } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const enrollSchema = z.object({
  studentId: z.string().min(1),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { error, scope } = await requireTeacher();
  if (error) return error;

  const { id: classId } = await params;
  if (!assertClassAccess(scope!, classId)) {
    return Response.json({ error: "Class not found" }, { status: 404 });
  }
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls) return Response.json({ error: "Class not found" }, { status: 404 });

  let body: z.infer<typeof enrollSchema>;
  try {
    body = enrollSchema.parse(await request.json());
  } catch (e) {
    return Response.json({ error: "Invalid body", details: e }, { status: 400 });
  }

  const student = await prisma.studentProfile.findUnique({
    where: { id: body.studentId, isArchived: false },
  });
  if (!student) return Response.json({ error: "Student not found" }, { status: 404 });

  await prisma.classStudent.upsert({
    where: { classId_studentId: { classId, studentId: body.studentId } },
    create: { classId, studentId: body.studentId },
    update: {},
  });

  return Response.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { error, scope } = await requireTeacher();
  if (error) return error;

  const { id: classId } = await params;
  if (!assertClassAccess(scope!, classId)) {
    return Response.json({ error: "Class not found" }, { status: 404 });
  }
  const studentId = new URL(request.url).searchParams.get("studentId")?.trim();
  if (!studentId) {
    return Response.json({ error: "studentId query param required" }, { status: 400 });
  }

  await prisma.classStudent.deleteMany({
    where: { classId, studentId },
  });

  return Response.json({ ok: true });
}
