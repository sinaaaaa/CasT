/**
 * Direct teacher → student level assignments (soft active flag, history preserved).
 */

import { prisma } from "@/lib/prisma";
import type { TeacherScope } from "@/lib/class-access";
import { levelScopeWhere } from "@/lib/class-access";

/**
 * Resolve TeacherProfile id for assignment FK. Session JWT may carry a stale or
 * wrong teacherProfileId (e.g. User.id); never pass an id that fails the FK.
 */
export async function resolveAssignedByTeacherId(
  userId: string,
  teacherProfileId: string | null | undefined
): Promise<string | null> {
  const candidate = teacherProfileId?.trim();
  if (candidate) {
    const byId = await prisma.teacherProfile.findUnique({
      where: { id: candidate },
      select: { id: true },
    });
    if (byId) return byId.id;
  }

  const byUser = await prisma.teacherProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  return byUser?.id ?? null;
}

/** Active direct assignments only (used for Unity level list restriction). */
export async function getActiveDirectAssignmentLevelIds(
  studentProfileId: string
): Promise<Set<string>> {
  const ordered = await getActiveDirectAssignmentLevelIdsOrdered(studentProfileId);
  return new Set(ordered);
}

/** Active direct assignments in play order (catalog orderIndex). */
export async function getActiveDirectAssignmentLevelIdsOrdered(
  studentProfileId: string
): Promise<string[]> {
  const rows = await prisma.levelStudentAssignment.findMany({
    where: { studentId: studentProfileId, isActive: true },
    select: {
      levelId: true,
      level: { select: { orderIndex: true, levelKey: true } },
    },
  });
  return rows
    .sort(
      (a, b) =>
        a.level.orderIndex - b.level.orderIndex ||
        (a.level.levelKey ?? "").localeCompare(b.level.levelKey ?? "")
    )
    .map((r) => r.levelId);
}

export async function countActiveDirectAssignments(studentProfileId: string): Promise<number> {
  return prisma.levelStudentAssignment.count({
    where: { studentId: studentProfileId, isActive: true },
  });
}

export type StudentAssignmentRow = {
  id: string;
  levelId: string;
  isActive: boolean;
  assignedAt: Date;
  deactivatedAt: Date | null;
};

/** Replace active assignment set: deactivate removed rows, upsert selected (never hard-delete). */
export async function setStudentLevelAssignments(
  studentId: string,
  levelIds: string[],
  assignedByTeacherId: string | null
): Promise<string[]> {
  const uniqueIds = [...new Set(levelIds)];
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    if (uniqueIds.length === 0) {
      await tx.levelStudentAssignment.updateMany({
        where: { studentId, isActive: true },
        data: { isActive: false, deactivatedAt: now },
      });
      return;
    }

    await tx.levelStudentAssignment.updateMany({
      where: {
        studentId,
        isActive: true,
        levelId: { notIn: uniqueIds },
      },
      data: { isActive: false, deactivatedAt: now },
    });

    for (const levelId of uniqueIds) {
      await tx.levelStudentAssignment.upsert({
        where: { levelId_studentId: { levelId, studentId } },
        create: {
          studentId,
          levelId,
          isActive: true,
          assignedByTeacherId,
          assignedAt: now,
        },
        update: {
          isActive: true,
          deactivatedAt: null,
          assignedByTeacherId,
          assignedAt: now,
        },
      });
    }
  });

  return uniqueIds;
}

/** Add levels to existing active set (bulk assign). */
export async function addStudentLevelAssignments(
  studentId: string,
  levelIds: string[],
  assignedByTeacherId: string | null
): Promise<void> {
  const uniqueIds = [...new Set(levelIds)];
  const now = new Date();
  for (const levelId of uniqueIds) {
    await prisma.levelStudentAssignment.upsert({
      where: { levelId_studentId: { levelId, studentId } },
      create: {
        studentId,
        levelId,
        isActive: true,
        assignedByTeacherId,
        assignedAt: now,
      },
      update: {
        isActive: true,
        deactivatedAt: null,
        assignedByTeacherId,
      },
    });
  }
}

/** Soft-remove one assignment. */
export async function deactivateStudentLevelAssignment(
  studentId: string,
  levelId: string
): Promise<void> {
  await prisma.levelStudentAssignment.updateMany({
    where: { studentId, levelId, isActive: true },
    data: { isActive: false, deactivatedAt: new Date() },
  });
}

/** Published non-archived level ids assignable by this teacher (own items + platform shared). */
export async function getAllAssignableLevelIds(scope?: TeacherScope): Promise<string[]> {
  const rows = await prisma.level.findMany({
    where: {
      published: true,
      isArchived: false,
      ...(scope ? levelScopeWhere(scope) : {}),
    },
    orderBy: { orderIndex: "asc" },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
