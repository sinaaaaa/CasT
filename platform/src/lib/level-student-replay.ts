/**
 * Teacher-requested practice replay for items a student already completed.
 * Keeps attempt history; only steers resume / "up next" until they pass again.
 */

import { prisma } from "@/lib/prisma";
import {
  addStudentLevelAssignments,
  countActiveDirectAssignments,
} from "@/lib/level-student-assignments";

export type ReplayRequestRow = {
  levelId: string;
  requestedAt: Date;
};

/** Active replay requests for a student (newest first). */
export async function getStudentReplayRequests(
  studentId: string
): Promise<ReplayRequestRow[]> {
  const rows = await prisma.levelStudentReplayRequest.findMany({
    where: { studentId },
    select: { levelId: true, requestedAt: true },
    orderBy: { requestedAt: "desc" },
  });
  return rows;
}

export async function getStudentReplayLevelIds(studentId: string): Promise<Set<string>> {
  const rows = await getStudentReplayRequests(studentId);
  return new Set(rows.map((r) => r.levelId));
}

/**
 * Queue an item for practice again. If the student already has a custom
 * assignment list, the item is added/reactivated so they can play it.
 * Students with no custom list stay unrestricted (all catalog items).
 */
export async function requestStudentLevelReplay(
  studentId: string,
  levelId: string,
  requestedByTeacherId: string | null
): Promise<{ replayRequestedAt: Date; assignmentEnsured: boolean }> {
  const now = new Date();
  const activeCount = await countActiveDirectAssignments(studentId);
  let assignmentEnsured = false;

  if (activeCount > 0) {
    await addStudentLevelAssignments(studentId, [levelId], requestedByTeacherId);
    assignmentEnsured = true;
  }

  const row = await prisma.levelStudentReplayRequest.upsert({
    where: { levelId_studentId: { levelId, studentId } },
    create: {
      studentId,
      levelId,
      requestedByTeacherId,
      requestedAt: now,
    },
    update: {
      requestedByTeacherId,
      requestedAt: now,
    },
    select: { requestedAt: true },
  });

  return { replayRequestedAt: row.requestedAt, assignmentEnsured };
}

/** Clear replay after a new pass (or when teacher cancels). */
export async function clearStudentLevelReplay(
  studentId: string,
  levelId: string
): Promise<void> {
  await prisma.levelStudentReplayRequest.deleteMany({
    where: { studentId, levelId },
  });
}

/**
 * Among ordered playable levels, pick the preferred replay target
 * (earliest in play order among pending requests).
 */
export function pickReplayTarget<T extends { id: string }>(
  orderedLevels: T[],
  replayLevelIds: Set<string>
): T | null {
  if (replayLevelIds.size === 0 || orderedLevels.length === 0) return null;
  return orderedLevels.find((level) => replayLevelIds.has(level.id)) ?? null;
}
