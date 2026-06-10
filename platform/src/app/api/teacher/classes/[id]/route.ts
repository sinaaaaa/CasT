import { NextRequest } from "next/server";
import { z } from "zod";
import { assertClassAccess } from "@/lib/class-access";
import { requireTeacher } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const updateClassSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  code: z.string().min(2).max(64).optional(),
  description: z.string().max(500).nullable().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { error, scope } = await requireTeacher();
  if (error) return error;

  const { id } = await params;
  if (!assertClassAccess(scope!, id)) {
    return Response.json({ error: "Class not found" }, { status: 404 });
  }
  let body: z.infer<typeof updateClassSchema>;
  try {
    body = updateClassSchema.parse(await request.json());
  } catch (e) {
    return Response.json({ error: "Invalid body", details: e }, { status: 400 });
  }

  const existing = await prisma.class.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Class not found" }, { status: 404 });

  if (body.code) {
    const code = body.code.trim().toUpperCase();
    const clash = await prisma.class.findFirst({
      where: { code, NOT: { id } },
    });
    if (clash) {
      return Response.json({ error: "Class code already in use" }, { status: 409 });
    }
  }

  const cls = await prisma.class.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.code !== undefined ? { code: body.code.trim().toUpperCase() } : {}),
      ...(body.description !== undefined
        ? { description: body.description?.trim() || null }
        : {}),
    },
  });

  return Response.json({ class: cls });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { error, scope } = await requireTeacher();
  if (error) return error;

  const { id } = await params;
  if (!assertClassAccess(scope!, id)) {
    return Response.json({ error: "Class not found" }, { status: 404 });
  }
  const existing = await prisma.class.findUnique({
    where: { id },
    include: { _count: { select: { students: true, levelAttempts: true } } },
  });
  if (!existing) return Response.json({ error: "Class not found" }, { status: 404 });

  await prisma.class.delete({ where: { id } });

  return Response.json({
    ok: true,
    message:
      "Class deleted. Student accounts are unchanged; past attempts keep their scores (class link cleared).",
    removedStudents: existing._count.students,
    affectedAttempts: existing._count.levelAttempts,
  });
}
