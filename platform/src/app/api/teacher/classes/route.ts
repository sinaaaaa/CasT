import { NextRequest } from "next/server";
import { z } from "zod";
import { assertClassAccess, classScopeWhere } from "@/lib/class-access";
import { requireTeacher } from "@/lib/api-auth";
import { generateUniqueClassCode } from "@/lib/class-utils";
import { prisma } from "@/lib/prisma";

const createClassSchema = z.object({
  name: z.string().min(1).max(120),
  code: z.string().min(2).max(64).optional(),
  description: z.string().max(500).optional(),
});

export async function GET() {
  const { error, scope } = await requireTeacher();
  if (error) return error;

  const classes = await prisma.class.findMany({
    where: classScopeWhere(scope!),
    orderBy: { name: "asc" },
    include: { _count: { select: { students: true, levelAttempts: true } } },
  });

  return Response.json({
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      description: c.description,
      studentCount: c._count.students,
      attemptCount: c._count.levelAttempts,
      createdAt: c.createdAt,
    })),
  });
}

export async function POST(request: NextRequest) {
  const { error, session, scope } = await requireTeacher();
  if (error) return error;

  let body: z.infer<typeof createClassSchema>;
  try {
    body = createClassSchema.parse(await request.json());
  } catch (e) {
    return Response.json({ error: "Invalid body", details: e }, { status: 400 });
  }

  const code =
    body.code?.trim().toUpperCase() ?? (await generateUniqueClassCode(body.name));

  const existingCode = await prisma.class.findUnique({ where: { code } });
  if (existingCode) {
    return Response.json({ error: "Class code already in use" }, { status: 409 });
  }

  const teacherProfileId = session!.user.teacherProfileId;
  const cls = await prisma.class.create({
    data: {
      name: body.name.trim(),
      code,
      description: body.description?.trim() || null,
      ...(teacherProfileId && !scope!.isAdmin
        ? {
            teachers: {
              create: { teacherId: teacherProfileId },
            },
          }
        : {}),
    },
  });

  return Response.json({ class: cls }, { status: 201 });
}
