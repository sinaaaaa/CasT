import { prisma } from "@/lib/prisma";
import {
  pickNextPlayableLevel,
  type PlayableLevelProgress,
} from "@/lib/resolve-next-playable-level";
import {
  getStudentReplayLevelIds,
  pickReplayTarget,
} from "@/lib/level-student-replay";
import {
  getStoredStudentResumeCursor,
  loadEndedAttemptCountsByLevel,
  maxAttemptsFromLevelConfig,
} from "@/lib/student-resume-cursor";

type PlayableLevelRef = {
  id: string;
  levelKey: string;
  config?: unknown;
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

  const [passedRows, endedCounts, replayLevelIds] = await Promise.all([
    prisma.levelAttempt.findMany({
      where: { studentId: studentProfileId, passed: true },
      select: { levelId: true },
      distinct: ["levelId"],
    }),
    loadEndedAttemptCountsByLevel(studentProfileId),
    getStudentReplayLevelIds(studentProfileId),
  ]);
  const passedLevelIds = new Set(passedRows.map((row) => row.levelId));

  return orderedLevels.map((level, index) => {
    const historicallyPassed = passedLevelIds.has(level.id);
    const queuedReplay = replayLevelIds.has(level.id);
    // Pending teacher replay → treat as not passed / not finished for resume.
    const passed = historicallyPassed && !queuedReplay;
    const endedAttempts = endedCounts.get(level.id) ?? 0;
    const maxAttempts = maxAttemptsFromLevelConfig(level.config);
    const exhausted = endedAttempts >= maxAttempts;
    const finished = queuedReplay ? false : passed || exhausted;

    return {
      id: level.id,
      levelKey: level.levelKey,
      slot: index + 1,
      attempts: endedAttempts,
      passed,
      finished,
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

  // Explicit bookmark from Unity Continue / level-end (survives closing the tab).
  const stored = await getStoredStudentResumeCursor(studentProfileId);
  if (stored) {
    const byKey = orderedLevels.find((l) => l.levelKey === stored.resumeLevelKey);
    if (byKey) {
      const slot = orderedLevels.findIndex((l) => l.id === byKey.id) + 1;
      return { resumeLevelKey: byKey.levelKey, resumeSlot: slot };
    }
    if (stored.resumeSlot >= 1 && stored.resumeSlot <= orderedLevels.length) {
      const bySlot = orderedLevels[stored.resumeSlot - 1]!;
      return { resumeLevelKey: bySlot.levelKey, resumeSlot: stored.resumeSlot };
    }
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
  if (level.passed || level.finished) return true;
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
