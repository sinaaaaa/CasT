import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/api-auth";
import {
  assertStudentAccess,
  levelScopeWhere,
  studentScopeWhere,
} from "@/lib/class-access";
import { assertLevelsAssignableByTeacher } from "@/lib/level-assignments";
import {
  addStudentLevelAssignments,
  getAllAssignableLevelIds,
  resolveAssignedByTeacherId,
  setStudentLevelAssignments,
} from "@/lib/level-student-assignments";

const postBodySchema = z.object({
  studentIds: z.array(z.string().min(1)).min(1),
  levelIds: z.array(z.string().min(1)).optional(),
  mode: z.enum(["replace", "add", "assignAll", "clear"]).default("replace"),
});

/** Bulk assign levels to one or more students. */
export async function POST(request: NextRequest) {
  const { error, session, scope } = await requireTeacher();
  if (error) return error;

  let body: z.infer<typeof postBodySchema>;
  try {
    body = postBodySchema.parse(await request.json());
  } catch (e) {
    return Response.json({ error: "Invalid body", details: e }, { status: 400 });
  }

  const studentIds = [...new Set(body.studentIds)];

  for (const studentId of studentIds) {
    if (!(await assertStudentAccess(scope!, studentId))) {
      return Response.json(
        { error: "One or more students are not in your classes" },
        { status: 403 }
      );
    }
  }

  const students = await prisma.studentProfile.findMany({
    where: { id: { in: studentIds }, isArchived: false },
    select: { id: true },
  });
  if (students.length !== studentIds.length) {
    return Response.json({ error: "One or more students not found" }, { status: 400 });
  }

  let levelIds: string[] = body.levelIds ?? [];
  if (body.mode === "assignAll") {
    levelIds = await getAllAssignableLevelIds(scope!);
  }

  if (body.mode !== "clear" && body.mode !== "assignAll" && levelIds.length === 0) {
    return Response.json({ error: "levelIds required for this mode" }, { status: 400 });
  }

  if (levelIds.length > 0 && !(await assertLevelsAssignableByTeacher(scope!, levelIds))) {
    return Response.json(
      { error: "One or more items are not available to assign" },
      { status: 403 }
    );
  }

  const teacherId = await resolveAssignedByTeacherId(
    session!.user.id,
    session!.user.teacherProfileId
  );

  for (const studentId of studentIds) {
    if (body.mode === "add") {
      await addStudentLevelAssignments(studentId, levelIds, teacherId);
    } else if (body.mode === "clear") {
      await setStudentLevelAssignments(studentId, [], teacherId);
    } else {
      await setStudentLevelAssignments(studentId, levelIds, teacherId);
    }
  }

  return Response.json({
    ok: true,
    studentCount: studentIds.length,
    levelCount: levelIds.length,
    mode: body.mode,
  });
}

/** List levels with assignment summary for teacher filters. */
export async function GET() {
  const { error, scope } = await requireTeacher();
  if (error) return error;

  const levels = await prisma.level.findMany({
    where: { isArchived: false, ...levelScopeWhere(scope!) },
    orderBy: { orderIndex: "asc" },
    select: {
      id: true,
      levelKey: true,
      name: true,
      orderIndex: true,
      published: true,
      levelType: true,
      ownerTeacherId: true,
      _count: {
        select: {
          studentAssignments: {
            where: {
              isActive: true,
              student: studentScopeWhere(scope!),
            },
          },
        },
      },
    },
  });

  const scopedStudentWhere = studentScopeWhere(scope!);

  const studentsWithCustom = await prisma.studentProfile.count({
    where: {
      ...scopedStudentWhere,
      assignedLevels: { some: { isActive: true } },
    },
  });
  const studentsWithoutCustom = await prisma.studentProfile.count({
    where: {
      ...scopedStudentWhere,
      assignedLevels: { none: { isActive: true } },
    },
  });

  return Response.json({
    levels: levels.map((l) => ({
      id: l.id,
      levelKey: l.levelKey,
      name: l.name,
      orderIndex: l.orderIndex,
      published: l.published,
      levelType: l.levelType,
      assignedStudentCount: l._count.studentAssignments,
    })),
    studentsWithCustomAssignments: studentsWithCustom,
    studentsWithoutCustomAssignments: studentsWithoutCustom,
    explanation:
      "Assigned items let you personalize practice. Students with no assigned items see platform items plus items from their teachers.",
  });
}
