import { prisma } from "@/lib/prisma";

type PlayableLevelRef = {
  id: string;
  levelKey: string;
};

export type GameResumeLevel = {
  resumeLevelKey: string;
  resumeSlot: number;
};

/**
 * First assigned item the student should play next (1-based slot in the ordered list).
 * Matches the student dashboard "up next" logic: in-progress, then new, then first item.
 */
export async function resolveGameResumeLevel(
  studentProfileId: string,
  orderedLevels: PlayableLevelRef[]
): Promise<GameResumeLevel | null> {
  if (orderedLevels.length === 0) return null;

  const passedRows = await prisma.levelAttempt.findMany({
    where: { studentId: studentProfileId, passed: true },
    select: { levelId: true },
    distinct: ["levelId"],
  });
  const passedLevelIds = new Set(passedRows.map((row) => row.levelId));

  const attemptCounts = await prisma.levelAttempt.groupBy({
    by: ["levelId"],
    where: { studentId: studentProfileId },
    _count: { _all: true },
  });
  const attemptsByLevelId = new Map(
    attemptCounts.map((row) => [row.levelId, row._count._all])
  );

  const levels = orderedLevels.map((level, index) => {
    const attempts = attemptsByLevelId.get(level.id) ?? 0;
    const passed = passedLevelIds.has(level.id);
    return {
      ...level,
      slot: index + 1,
      attempts,
      passed,
      status: passed ? ("completed" as const) : attempts > 0 ? ("in_progress" as const) : ("new" as const),
    };
  });

  const next =
    levels.find((level) => level.status === "in_progress") ??
    levels.find((level) => level.status === "new") ??
    levels[0];

  return {
    resumeLevelKey: next.levelKey,
    resumeSlot: next.slot,
  };
}
