import type { Prisma } from "@prisma/client";
import { UserRole } from "@prisma/client";
import { isAdminRole } from "@/lib/auth";
import { INTRO_LEVEL_KEY } from "@/lib/level-config";
import { prisma } from "@/lib/prisma";

export type TeacherScope = {
  isAdmin: boolean;
  teacherProfileId: string | null;
  /** null = all classes (admin). Empty = no assigned classes. */
  classIds: string[] | null;
};

export async function resolveTeacherScope(user: {
  role: UserRole;
  teacherProfileId: string | null;
}): Promise<TeacherScope> {
  if (isAdminRole(user.role)) {
    return {
      isAdmin: true,
      teacherProfileId: user.teacherProfileId,
      classIds: null,
    };
  }

  if (!user.teacherProfileId) {
    return { isAdmin: false, teacherProfileId: null, classIds: [] };
  }

  const memberships = await prisma.classTeacher.findMany({
    where: { teacherId: user.teacherProfileId },
    select: { classId: true },
  });

  return {
    isAdmin: false,
    teacherProfileId: user.teacherProfileId,
    classIds: memberships.map((m) => m.classId),
  };
}

export function classScopeWhere(scope: TeacherScope): Prisma.ClassWhereInput {
  if (scope.classIds === null) return {};
  if (scope.classIds.length === 0) return { id: { in: [] } };
  return { id: { in: scope.classIds } };
}

export function studentScopeWhere(scope: TeacherScope): Prisma.StudentProfileWhereInput {
  if (scope.classIds === null) return { isArchived: false };
  if (scope.classIds.length === 0) return { id: { in: [] } };
  return {
    isArchived: false,
    classMemberships: { some: { classId: { in: scope.classIds } } },
  };
}

export function assertClassAccess(scope: TeacherScope, classId: string): boolean {
  if (scope.classIds === null) return true;
  return scope.classIds.includes(classId);
}

export async function getScopedStudentIds(scope: TeacherScope): Promise<string[] | null> {
  if (scope.classIds === null) return null;
  if (scope.classIds.length === 0) return [];

  const members = await prisma.classStudent.findMany({
    where: { classId: { in: scope.classIds } },
    select: { studentId: true },
  });

  return [...new Set(members.map((m) => m.studentId))];
}

export async function assertStudentAccess(
  scope: TeacherScope,
  studentProfileId: string
): Promise<boolean> {
  if (scope.classIds === null) return true;
  if (scope.classIds.length === 0) return false;

  const membership = await prisma.classStudent.findFirst({
    where: {
      studentId: studentProfileId,
      classId: { in: scope.classIds },
    },
    select: { id: true },
  });
  return membership != null;
}

export function forbiddenResponse(message = "Forbidden") {
  return Response.json({ error: message }, { status: 403 });
}

export function requireClassAccess(scope: TeacherScope, classId: string): Response | null {
  if (!assertClassAccess(scope, classId)) {
    return forbiddenResponse("You do not have access to this class");
  }
  return null;
}

export async function requireStudentAccess(
  scope: TeacherScope,
  studentProfileId: string
): Promise<Response | null> {
  if (!(await assertStudentAccess(scope, studentProfileId))) {
    return forbiddenResponse("You do not have access to this student");
  }
  return null;
}

export type ScopeFilterOptions = {
  classId?: string;
  studentIds?: string[];
};

/** Student IDs visible to this teacher. null = all (admin). */
export async function resolveStudentIdsForScope(
  scope: TeacherScope,
  opts?: ScopeFilterOptions
): Promise<string[] | null> {
  if (opts?.classId) {
    if (!assertClassAccess(scope, opts.classId)) return [];
    const members = await prisma.classStudent.findMany({
      where: { classId: opts.classId },
      select: { studentId: true },
    });
    return members.map((m) => m.studentId);
  }

  if (opts?.studentIds?.length) {
    const allowed = await getScopedStudentIds(scope);
    if (allowed === null) return opts.studentIds;
    const set = new Set(allowed);
    return opts.studentIds.filter((id) => set.has(id));
  }

  return getScopedStudentIds(scope);
}

/** Attempt counts per level, limited to students in teacher scope. */
export async function getScopedAttemptCountsByLevel(
  scope: TeacherScope
): Promise<Map<string, number>> {
  const studentIds = await getScopedStudentIds(scope);
  const where =
    studentIds === null
      ? {}
      : studentIds.length === 0
        ? { studentId: { in: [] as string[] } }
        : { studentId: { in: studentIds } };

  const groups = await prisma.levelAttempt.groupBy({
    by: ["levelId"],
    where,
    _count: { id: true },
  });

  return new Map(groups.map((g) => [g.levelId, g._count.id]));
}

/** Levels a teacher may list, assign, and view analytics for. */
export function levelScopeWhere(scope: TeacherScope): Prisma.LevelWhereInput {
  if (scope.classIds === null) return {};
  if (!scope.teacherProfileId) return { id: { in: [] } };
  return {
    OR: [{ ownerTeacherId: scope.teacherProfileId }, { ownerTeacherId: null }],
  };
}

export function assertLevelReadAccess(
  scope: TeacherScope,
  level: { ownerTeacherId: string | null }
): boolean {
  if (scope.classIds === null) return true;
  if (level.ownerTeacherId === null) return true;
  return level.ownerTeacherId === scope.teacherProfileId;
}

export function assertLevelEditAccess(
  scope: TeacherScope,
  level: { ownerTeacherId: string | null; levelKey?: string }
): boolean {
  if (scope.classIds === null) return true;
  if (level.ownerTeacherId === scope.teacherProfileId) return true;
  if (level.ownerTeacherId === null && level.levelKey === INTRO_LEVEL_KEY) return true;
  return false;
}

export function requireLevelReadAccess(
  scope: TeacherScope,
  level: { ownerTeacherId: string | null }
): Response | null {
  if (!assertLevelReadAccess(scope, level)) {
    return forbiddenResponse("You do not have access to this item");
  }
  return null;
}

export function requireLevelEditAccess(
  scope: TeacherScope,
  level: { ownerTeacherId: string | null; levelKey?: string }
): Response | null {
  if (!assertLevelEditAccess(scope, level)) {
    return forbiddenResponse("You can only edit items you created");
  }
  return null;
}

/** TeacherProfile ids for classes this student is enrolled in. */
export async function getStudentTeacherProfileIds(studentProfileId: string): Promise<string[]> {
  const memberships = await prisma.classStudent.findMany({
    where: { studentId: studentProfileId },
    select: { class: { select: { teachers: { select: { teacherId: true } } } } },
  });
  return [
    ...new Set(memberships.flatMap((m) => m.class.teachers.map((t) => t.teacherId))),
  ];
}

/** Levels a student may see in game (platform shared + their teachers' items). */
export function studentLevelOwnershipWhere(teacherProfileIds: string[]): Prisma.LevelWhereInput {
  if (teacherProfileIds.length === 0) {
    return { ownerTeacherId: null };
  }
  return {
    OR: [{ ownerTeacherId: null }, { ownerTeacherId: { in: teacherProfileIds } }],
  };
}

/** Teacher ids assigned to a class (for class-scoped level lists). */
export async function getClassTeacherProfileIds(classId: string): Promise<string[]> {
  const rows = await prisma.classTeacher.findMany({
    where: { classId },
    select: { teacherId: true },
  });
  return rows.map((r) => r.teacherId);
}

export function levelsForTeachersWhere(teacherProfileIds: string[]): Prisma.LevelWhereInput {
  if (teacherProfileIds.length === 0) {
    return { ownerTeacherId: null };
  }
  return {
    OR: [{ ownerTeacherId: null }, { ownerTeacherId: { in: teacherProfileIds } }],
  };
}
