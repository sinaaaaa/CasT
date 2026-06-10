import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/api-auth";
import { requireClassAccess, levelScopeWhere } from "@/lib/class-access";
import { assertLevelsAssignableByTeacher } from "@/lib/level-assignments";

const putBodySchema = z.object({
  levelIds: z.array(z.string().min(1)),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, scope } = await requireTeacher();
  if (error) return error;

  const { id } = await params;
  const denied = requireClassAccess(scope!, id);
  if (denied) return denied;

  const cls = await prisma.class.findUnique({ where: { id } });
  if (!cls) return Response.json({ error: "Class not found" }, { status: 404 });

  const [assignments, levels] = await Promise.all([
    prisma.levelClassAssignment.findMany({
      where: { classId: id },
      select: { levelId: true },
    }),
    prisma.level.findMany({
      where: { isArchived: false, ...levelScopeWhere(scope!) },
      orderBy: { orderIndex: "asc" },
      select: {
        id: true,
        levelKey: true,
        name: true,
        orderIndex: true,
        published: true,
        levelType: true,
      },
    }),
  ]);

  return Response.json({
    assignedLevelIds: assignments.map((a) => a.levelId),
    levels,
    class: { id: cls.id, name: cls.name },
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, scope } = await requireTeacher();
  if (error) return error;

  const { id } = await params;
  const denied = requireClassAccess(scope!, id);
  if (denied) return denied;

  const cls = await prisma.class.findUnique({ where: { id } });
  if (!cls) return Response.json({ error: "Class not found" }, { status: 404 });

  let body: z.infer<typeof putBodySchema>;
  try {
    body = putBodySchema.parse(await request.json());
  } catch (e) {
    return Response.json({ error: "Invalid body", details: e }, { status: 400 });
  }

  const uniqueIds = [...new Set(body.levelIds)];
  if (uniqueIds.length > 0 && !(await assertLevelsAssignableByTeacher(scope!, uniqueIds))) {
    return Response.json(
      { error: "One or more items are not available to assign" },
      { status: 403 }
    );
  }

  await prisma.$transaction([
    prisma.levelClassAssignment.deleteMany({ where: { classId: id } }),
    ...(uniqueIds.length > 0
      ? [
          prisma.levelClassAssignment.createMany({
            data: uniqueIds.map((levelId) => ({ classId: id, levelId })),
          }),
        ]
      : []),
  ]);

  return Response.json({ ok: true, assignedLevelIds: uniqueIds });
}
