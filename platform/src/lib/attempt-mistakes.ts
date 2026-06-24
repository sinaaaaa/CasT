/** Parsed run metadata stored on LevelAttempt.mistakes (from Unity assessmentExtras). */
export type AttemptRunMeta = {
  inLevelRunNumber: number | null;
  maxLevelRuns: number | null;
  playSlot: number | null;
};

export function parsePlaySlot(mistakes: unknown): number | null {
  const o = readMistakesObject(mistakes);
  return typeof o?.playSlot === "number" && o.playSlot >= 1 ? o.playSlot : null;
}

function readMistakesObject(mistakes: unknown): Record<string, unknown> | null {
  if (!mistakes || typeof mistakes !== "object" || Array.isArray(mistakes)) return null;
  return mistakes as Record<string, unknown>;
}

export function parseAttemptRunMeta(mistakes: unknown): AttemptRunMeta {
  const o = readMistakesObject(mistakes);
  const inLevelRunNumber =
    typeof o?.inLevelRunNumber === "number" && o.inLevelRunNumber >= 1
      ? o.inLevelRunNumber
      : null;
  const maxLevelRuns =
    typeof o?.maxLevelRuns === "number" && o.maxLevelRuns >= 1 ? o.maxLevelRuns : null;
  const playSlot = parsePlaySlot(mistakes);
  return { inLevelRunNumber, maxLevelRuns, playSlot };
}

type AttemptDisplayRow = {
  levelId: string;
  startedAt: Date | string;
  endedAt: Date | string | null;
  status: string;
};

/** Hide orphan INCOMPLETE rows superseded by a later ended run on the same item. */
export function filterSupersededIncompleteAttempts<T extends AttemptDisplayRow>(
  attempts: T[]
): T[] {
  return attempts.filter((attempt) => {
    if (attempt.endedAt != null) return true;
    if (attempt.status !== "INCOMPLETE") return true;

    const startedMs = new Date(attempt.startedAt).getTime();
    const superseded = attempts.some(
      (other) =>
        other.levelId === attempt.levelId &&
        other.endedAt != null &&
        new Date(other.startedAt).getTime() > startedMs
    );
    return !superseded;
  });
}

/** Label for dashboard tables, e.g. "Try 1 of 2" or "Session #3". */
export function formatAttemptRunLabel(
  attemptNumber: number,
  meta: AttemptRunMeta
): string {
  if (meta.inLevelRunNumber != null) {
    if (meta.maxLevelRuns != null) {
      return `Try ${meta.inLevelRunNumber} of ${meta.maxLevelRuns}`;
    }
    return `Try ${meta.inLevelRunNumber}`;
  }
  return `#${attemptNumber}`;
}
