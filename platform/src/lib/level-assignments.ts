import { prisma } from "@/lib/prisma";
import { normalizeExternalStudentId } from "@/lib/game-service";
import { levelGameplayConfigSchema } from "@/lib/level-config";
import {
  getStudentTeacherProfileIds,
  studentLevelOwnershipWhere,
  type TeacherScope,
  levelScopeWhere,
} from "@/lib/class-access";
import { getActiveDirectAssignmentLevelIds } from "@/lib/level-student-assignments";
import type { Prisma } from "@prisma/client";

function isLevelVisibleInGame(config: unknown): boolean {
  const parsed = levelGameplayConfigSchema.safeParse(config);
  if (!parsed.success) return true;
  return parsed.data.visible ?? true;
}

/** Level ids from direct assignments + class enrollment (informational; not used for game filter). */
export async function getAssignedLevelIdsForStudent(studentProfileId: string): Promise<Set<string>> {
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentProfileId },
    include: {
      classMemberships: { select: { classId: true } },
      assignedLevels: { where: { isActive: true }, select: { levelId: true } },
    },
  });
  if (!student) return new Set();

  const ids = new Set(student.assignedLevels.map((a) => a.levelId));

  const classIds = student.classMemberships.map((m) => m.classId);
  if (classIds.length > 0) {
    const fromClasses = await prisma.levelClassAssignment.findMany({
      where: { classId: { in: classIds } },
      select: { levelId: true },
    });
    for (const row of fromClasses) ids.add(row.levelId);
  }

  return ids;
}

export async function resolveStudentProfileId(studentIdOrExternal: string): Promise<string | null> {
  const normalized = normalizeExternalStudentId(studentIdOrExternal);
  const student = await prisma.studentProfile.findFirst({
    where: {
      OR: [
        { id: studentIdOrExternal },
        { externalId: studentIdOrExternal },
        { externalId: normalized },
      ],
    },
    select: { id: true },
  });
  return student?.id ?? null;
}

/** All published + visible levels (admin / legacy — no student filter). */
export async function getPublishedLevelsForGame() {
  const rows = await prisma.level.findMany({
    where: { published: true, isArchived: false },
    orderBy: { orderIndex: "asc" },
  });
  return rows.filter((l) => isLevelVisibleInGame(l.config));
}

/**
 * Levels a student may play in Unity.
 * Scoped to platform-shared levels + items owned by teachers in the student's classes.
 * If they have active direct assignments → only those levels (still ownership-filtered).
 */
export async function getPlayableLevelsForStudent(studentIdOrExternal?: string | null) {
  const fetchVisible = async (extraWhere: Prisma.LevelWhereInput = {}) => {
    const rows = await prisma.level.findMany({
      where: { published: true, isArchived: false, ...extraWhere },
      orderBy: { orderIndex: "asc" },
    });
    return rows.filter((l) => isLevelVisibleInGame(l.config));
  };

  if (!studentIdOrExternal?.trim()) {
    return fetchVisible({ ownerTeacherId: null });
  }

  const profileId = await resolveStudentProfileId(studentIdOrExternal);
  if (!profileId) {
    return fetchVisible({ ownerTeacherId: null });
  }

  const teacherIds = await getStudentTeacherProfileIds(profileId);
  const ownershipWhere = studentLevelOwnershipWhere(teacherIds);

  const directActive = await getActiveDirectAssignmentLevelIds(profileId);
  if (directActive.size === 0) {
    return fetchVisible(ownershipWhere);
  }

  return fetchVisible({
    ...ownershipWhere,
    id: { in: Array.from(directActive) },
  });
}

export async function studentHasLevelAccess(
  studentProfileId: string,
  levelId: string
): Promise<boolean> {
  const level = await prisma.level.findUnique({
    where: { id: levelId },
    select: { id: true, ownerTeacherId: true, published: true, isArchived: true },
  });
  if (!level || !level.published || level.isArchived) return false;

  const teacherIds = await getStudentTeacherProfileIds(studentProfileId);
  const allowed =
    level.ownerTeacherId === null || teacherIds.includes(level.ownerTeacherId);
  if (!allowed) return false;

  const directActive = await getActiveDirectAssignmentLevelIds(studentProfileId);
  if (directActive.size === 0) return true;
  return directActive.has(levelId);
}

/** Validate that all level ids are assignable by this teacher. */
export async function assertLevelsAssignableByTeacher(
  scope: TeacherScope,
  levelIds: string[]
): Promise<boolean> {
  if (levelIds.length === 0) return true;
  if (scope.classIds === null) return true;

  const found = await prisma.level.count({
    where: {
      id: { in: levelIds },
      ...levelScopeWhere(scope),
    },
  });
  return found === levelIds.length;
}
