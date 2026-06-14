import { prisma } from "@/lib/prisma";
import {
  pickNextPlayableLevel,
  type PlayableLevelProgress,
} from "@/lib/resolve-next-playable-level";

type PlayableLevelRef = {
  id: string;
  levelKey: string;
};

export type GameResumeLevel = {
  resumeLevelKey: string;
  resumeSlot: number;
};

export async function buildPlayableLevelProgress(
  studentProfileId: string,
  orderedLevels: PlayableLevelRef[]
): Promise<PlayableLevelProgress[]> {
  if (orderedLevels.length === 0) return [];

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

  return orderedLevels.map((level, index) => ({
    id: level.id,
    levelKey: level.levelKey,
    slot: index + 1,
    attempts: attemptsByLevelId.get(level.id) ?? 0,
    passed: passedLevelIds.has(level.id),
  }));
}

export async function resolveGameResumeLevel(
  studentProfileId: string,
  orderedLevels: PlayableLevelRef[]
): Promise<GameResumeLevel | null> {
  const progress = await buildPlayableLevelProgress(studentProfileId, orderedLevels);
  const next = pickNextPlayableLevel(progress);
  if (!next) return null;

  return {
    resumeLevelKey: next.levelKey,
    resumeSlot: next.slot,
  };
}
