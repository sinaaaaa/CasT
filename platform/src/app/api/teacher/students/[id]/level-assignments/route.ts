import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/api-auth";
import { requireStudentAccess } from "@/lib/class-access";
import { fetchTeacherVisibleLevels } from "@/lib/level-customization";
import { assertLevelsAssignableByTeacher } from "@/lib/level-assignments";
import {
  deactivateStudentLevelAssignment,
  resolveAssignedByTeacherId,
  setStudentLevelAssignments,
} from "@/lib/level-student-assignments";
import {
  getStudentReplayLevelIds,
  requestStudentLevelReplay,
} from "@/lib/level-student-replay";

const putBodySchema = z.object({
  levelIds: z.array(z.string().min(1)),
});

const patchBodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("remove"), levelId: z.string().min(1) }),
  z.object({ action: z.literal("clear") }),
  z.object({ action: z.literal("reassign"), levelId: z.string().min(1) }),
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

  const [assignments, levels, classAssignments, historyCount, replayLevelIds] =
    await Promise.all([
      prisma.levelStudentAssignment.findMany({
        where: { studentId: id, isActive: true },
        select: { levelId: true, assignedAt: true, assignedByTeacherId: true },
      }),
      fetchTeacherVisibleLevels(scope!, undefined, { orderIndex: "asc" }).then((rows) =>
        rows.map((l) => ({
          id: l.id,
          levelKey: l.levelKey,
          name: l.name,
          orderIndex: l.orderIndex,
          published: l.published,
          levelType: l.levelType,
        }))
      ),
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
      getStudentReplayLevelIds(id),
    ]);

  const activeIds = assignments.map((a) => a.levelId);
  const hasCustomAssignments = activeIds.length > 0;

  return Response.json({
    assignedLevelIds: activeIds,
    hasCustomAssignments,
    assignmentHistoryCount: historyCount,
    pendingReplayLevelIds: [...replayLevelIds],
    levels,
    fromClasses: classAssignments.map((a) => ({
      levelId: a.levelId,
      levelKey: a.level.levelKey,
      levelName: a.level.name,
      className: a.class.name,
    })),
    explanation:
      "Assigned items let you personalize practice. Students with no assigned items will continue to see all items. Use Reassign on Item progress to send a completed item back for practice.",
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
    const message = e instanceof Error ? e.message : String(e);
    const prismaCode =
      e && typeof e === "object" && "code" in e ? String((e as { code?: unknown }).code) : undefined;
    return Response.json(
      {
        error: "Failed to save assignments",
        details: message.slice(0, 800),
        prismaCode,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

  let body: z.infer<typeof patchBodySchema>;
  try {
    body = patchBodySchema.parse(await request.json());
  } catch (e) {
    return Response.json({ error: "Invalid body", details: e }, { status: 400 });
  }

  let replay: { replayRequestedAt: Date; assignmentEnsured: boolean } | null = null;

  if (body.action === "remove") {
    await deactivateStudentLevelAssignment(id, body.levelId);
  } else if (body.action === "clear") {
    await setStudentLevelAssignments(id, [], null);
  } else if (body.action === "reassign") {
    if (!(await assertLevelsAssignableByTeacher(scope!, [body.levelId]))) {
      return Response.json(
        { error: "This item is not available to assign" },
        { status: 403 }
      );
    }
    const teacherId = await resolveAssignedByTeacherId(
      session!.user.id,
      session!.user.teacherProfileId
    );
    replay = await requestStudentLevelReplay(id, body.levelId, teacherId);
  }

  const [active, replayLevelIds] = await Promise.all([
    prisma.levelStudentAssignment.findMany({
      where: { studentId: id, isActive: true },
      select: { levelId: true },
    }),
    getStudentReplayLevelIds(id),
  ]);

  return Response.json({
    ok: true,
    assignedLevelIds: active.map((a) => a.levelId),
    hasCustomAssignments: active.length > 0,
    pendingReplayLevelIds: [...replayLevelIds],
    ...(replay
      ? {
          replayRequestedAt: replay.replayRequestedAt.toISOString(),
          assignmentEnsured: replay.assignmentEnsured,
        }
      : {}),
  });
}
