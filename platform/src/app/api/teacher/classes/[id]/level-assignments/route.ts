import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/api-auth";
import { requireClassAccess } from "@/lib/class-access";
import { fetchTeacherVisibleLevels } from "@/lib/level-customization";
import { assertLevelsAssignableByTeacher } from "@/lib/level-assignments";
import {
  addStudentLevelAssignments,
  resolveAssignedByTeacherId,
  setStudentLevelAssignments,
} from "@/lib/level-student-assignments";

const putBodySchema = z.object({
  levelIds: z.array(z.string().min(1)),
  /** When true (default), also assign these items to every student currently in the class. */
  applyToStudents: z.boolean().optional().default(true),
  /** add = keep each student's extras; replace = each student gets exactly this set. */
  studentApplyMode: z.enum(["add", "replace"]).optional().default("add"),
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

  const cls = await prisma.class.findUnique({
    where: { id },
    include: { _count: { select: { students: true } } },
  });
  if (!cls) return Response.json({ error: "Class not found" }, { status: 404 });

  const [assignments, levels] = await Promise.all([
    prisma.levelClassAssignment.findMany({
      where: { classId: id },
      select: { levelId: true },
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
  ]);

  const studentCount = cls._count.students;

  return Response.json({
    assignedLevelIds: assignments.map((a) => a.levelId),
    levels,
    class: { id: cls.id, name: cls.name, studentCount },
    explanation:
      studentCount === 0
        ? "Select items for this class, then save. When students join the class, these items will be added to their game list."
        : `Select items and save to assign them to all ${studentCount} student${studentCount === 1 ? "" : "s"} in this class. Their game will show these items. Extra items already assigned to a student are kept.`,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session, scope } = await requireTeacher();
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

  let studentsUpdated = 0;
  if (body.applyToStudents) {
    const members = await prisma.classStudent.findMany({
      where: { classId: id },
      select: { studentId: true },
    });
    const teacherId = await resolveAssignedByTeacherId(
      session!.user.id,
      session!.user.teacherProfileId
    );

    try {
      for (const { studentId } of members) {
        if (body.studentApplyMode === "replace") {
          await setStudentLevelAssignments(studentId, uniqueIds, teacherId);
        } else if (uniqueIds.length > 0) {
          await addStudentLevelAssignments(studentId, uniqueIds, teacherId);
        }
        studentsUpdated += 1;
      }
    } catch (e) {
      console.error("[class level-assignments fan-out]", e);
      const message = e instanceof Error ? e.message : String(e);
      return Response.json(
        {
          error: "Class items saved, but applying to students failed",
          details: message.slice(0, 800),
          assignedLevelIds: uniqueIds,
        },
        { status: 500 }
      );
    }
  }

  return Response.json({
    ok: true,
    assignedLevelIds: uniqueIds,
    studentsUpdated,
    applyToStudents: body.applyToStudents,
    studentApplyMode: body.studentApplyMode,
  });
}
