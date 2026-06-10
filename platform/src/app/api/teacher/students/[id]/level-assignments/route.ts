import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/api-auth";
import { requireStudentAccess, levelScopeWhere } from "@/lib/class-access";
import { assertLevelsAssignableByTeacher } from "@/lib/level-assignments";
import {
  deactivateStudentLevelAssignment,
  resolveAssignedByTeacherId,
  setStudentLevelAssignments,
} from "@/lib/level-student-assignments";

const putBodySchema = z.object({
  levelIds: z.array(z.string().min(1)),
});

const patchBodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("remove"), levelId: z.string().min(1) }),
  z.object({ action: z.literal("clear") }),
]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, scope } = await requireTeacher();
  if (error) return error;

  const { id } = await params;
  const denied = await requireStudentAccess(scope!, id);
  if (denied) return denied;

  const student = await prisma.studentProfile.findUnique({ where: { id } });
  if (!student) return Response.json({ error: "Student not found" }, { status: 404 });

  const [assignments, levels, classAssignments, historyCount] = await Promise.all([
    prisma.levelStudentAssignment.findMany({
      where: { studentId: id, isActive: true },
      select: { levelId: true, assignedAt: true, assignedByTeacherId: true },
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
    prisma.levelClassAssignment.findMany({
      where: {
        class: { students: { some: { studentId: id } } },
      },
      include: {
        level: { select: { id: true, levelKey: true, name: true } },
        class: { select: { name: true } },
      },
    }),
    prisma.levelStudentAssignment.count({ where: { studentId: id } }),
  ]);

  const activeIds = assignments.map((a) => a.levelId);
  const hasCustomAssignments = activeIds.length > 0;

  return Response.json({
    assignedLevelIds: activeIds,
    hasCustomAssignments,
    assignmentHistoryCount: historyCount,
    levels,
    fromClasses: classAssignments.map((a) => ({
      levelId: a.levelId,
      levelKey: a.level.levelKey,
      levelName: a.level.name,
      className: a.class.name,
    })),
    explanation:
      "Assigned items let you personalize practice. Students with no assigned items will continue to see all items.",
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session, scope } = await requireTeacher();
  if (error) return error;

  const { id } = await params;
  const denied = await requireStudentAccess(scope!, id);
  if (denied) return denied;

  const student = await prisma.studentProfile.findUnique({ where: { id } });
  if (!student) return Response.json({ error: "Student not found" }, { status: 404 });

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

  const teacherId = await resolveAssignedByTeacherId(
    session!.user.id,
    session!.user.teacherProfileId
  );

  try {
    const assignedLevelIds = await setStudentLevelAssignments(id, uniqueIds, teacherId);
    return Response.json({
      ok: true,
      assignedLevelIds,
      hasCustomAssignments: assignedLevelIds.length > 0,
    });
  } catch (e) {
    console.error("[level-assignments PUT]", e);
    return Response.json({ error: "Failed to save assignments" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, scope } = await requireTeacher();
  if (error) return error;

  const { id } = await params;
  const denied = await requireStudentAccess(scope!, id);
  if (denied) return denied;

  const student = await prisma.studentProfile.findUnique({ where: { id } });
  if (!student) return Response.json({ error: "Student not found" }, { status: 404 });

  let body: z.infer<typeof patchBodySchema>;
  try {
    body = patchBodySchema.parse(await request.json());
  } catch (e) {
    return Response.json({ error: "Invalid body", details: e }, { status: 400 });
  }

  if (body.action === "remove") {
    await deactivateStudentLevelAssignment(id, body.levelId);
  } else {
    await setStudentLevelAssignments(id, [], null);
  }

  const active = await prisma.levelStudentAssignment.findMany({
    where: { studentId: id, isActive: true },
    select: { levelId: true },
  });

  return Response.json({
    ok: true,
    assignedLevelIds: active.map((a) => a.levelId),
    hasCustomAssignments: active.length > 0,
  });
}
