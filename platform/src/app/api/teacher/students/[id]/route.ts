import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { requireStudentAccess } from "@/lib/class-access";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  externalId: z.string().min(1).max(64).optional(),
  isArchived: z.boolean().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { error, scope } = await requireTeacher();
  if (error) return error;

  const { id } = await params;
  const denied = await requireStudentAccess(scope!, id);
  if (denied) return denied;

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const student = await prisma.studentProfile.update({
    where: { id },
    data: parsed.data,
  });

  return Response.json({ student });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { error, scope } = await requireTeacher();
  if (error) return error;

  const { id } = await params;
  const denied = await requireStudentAccess(scope!, id);
  if (denied) return denied;

  const existing = await prisma.studentProfile.findUnique({
    where: { id },
    include: { _count: { select: { levelAttempts: true } } },
  });
  if (!existing) return Response.json({ error: "Student not found" }, { status: 404 });

  if (existing._count.levelAttempts > 0) {
    const student = await prisma.studentProfile.update({
      where: { id },
      data: { isArchived: true },
    });
    return Response.json({
      ok: true,
      softDeleted: true,
      message: "Student archived. Historical reports are preserved.",
      student,
    });
  }

  await prisma.studentProfile.delete({ where: { id } });
  return Response.json({ ok: true, softDeleted: false });
}
