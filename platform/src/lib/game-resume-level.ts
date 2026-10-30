import { prisma } from "@/lib/prisma";
import {
  pickNextPlayableLevel,
  type PlayableLevelProgress,
} from "@/lib/resolve-next-playable-level";
import {
  getStudentReplayLevelIds,
  pickReplayTarget,
} from "@/lib/level-student-replay";

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

  const [passedRows, attemptCounts, replayLevelIds] = await Promise.all([
    prisma.levelAttempt.findMany({
      where: { studentId: studentProfileId, passed: true },
      select: { levelId: true },
      distinct: ["levelId"],
    }),
    prisma.levelAttempt.groupBy({
      by: ["levelId"],
      where: { studentId: studentProfileId },
      _count: { _all: true },
    }),
    getStudentReplayLevelIds(studentProfileId),
  ]);
  const passedLevelIds = new Set(passedRows.map((row) => row.levelId));

  const attemptsByLevelId = new Map(
    attemptCounts.map((row) => [row.levelId, row._count._all])
  );

  return orderedLevels.map((level, index) => {
    const historicallyPassed = passedLevelIds.has(level.id);
    // Pending teacher replay → treat as not passed for resume / "up next" only.
    const passed = historicallyPassed && !replayLevelIds.has(level.id);
    return {
      id: level.id,
      levelKey: level.levelKey,
      slot: index + 1,
      attempts: attemptsByLevelId.get(level.id) ?? 0,
      passed,
    };
  });
}

export async function resolveGameResumeLevel(
  studentProfileId: string,
  orderedLevels: PlayableLevelRef[]
): Promise<GameResumeLevel | null> {
  if (orderedLevels.length === 0) return null;

  const replayLevelIds = await getStudentReplayLevelIds(studentProfileId);
  const replayTarget = pickReplayTarget(orderedLevels, replayLevelIds);
  if (replayTarget) {
    const slot = orderedLevels.findIndex((l) => l.id === replayTarget.id) + 1;
    return {
      resumeLevelKey: replayTarget.levelKey,
      resumeSlot: slot,
    };
  }

  const progress = await buildPlayableLevelProgress(studentProfileId, orderedLevels);
  const next = pickNextPlayableLevel(progress);
  if (!next) return null;

  return {
    resumeLevelKey: next.levelKey,
    resumeSlot: next.slot,
  };
}

export function isLevelOpenForStudent(
  level: PlayableLevelProgress,
  nextLevelKey: string | null,
  replayLevelIds: Set<string>
): boolean {
  if (replayLevelIds.has(level.id)) return true;
  if (level.passed) return true;
  if (level.attempts > 0) return true;
  if (nextLevelKey && level.levelKey === nextLevelKey) return true;
  return false;
}

/** Honor a clicked item when the student is allowed to open it. Otherwise return null. */
export async function resolveRequestedPlayLevel(
  studentProfileId: string,
  orderedLevels: PlayableLevelRef[],
  requestedKey: string | null | undefined
): Promise<GameResumeLevel | null> {
  const key = requestedKey?.trim();
  if (!key || orderedLevels.length === 0) return null;

  const [replayLevelIds, progress] = await Promise.all([
    getStudentReplayLevelIds(studentProfileId),
    buildPlayableLevelProgress(studentProfileId, orderedLevels),
  ]);
  const next = pickNextPlayableLevel(progress);
  const match = progress.find((level) => level.levelKey === key);
  if (!match) return null;
  if (!isLevelOpenForStudent(match, next?.levelKey ?? null, replayLevelIds)) return null;

  return {
    resumeLevelKey: match.levelKey,
    resumeSlot: match.slot,
  };
}
