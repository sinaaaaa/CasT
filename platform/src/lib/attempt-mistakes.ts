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
  mistakes?: unknown;
};

export function attemptItemGroupKey(attempt: {
  levelId: string;
  mistakes?: unknown;
}): string {
  const slot = parsePlaySlot(attempt.mistakes);
  return slot != null ? `slot:${slot}` : `level:${attempt.levelId}`;
}

/** Hide orphan INCOMPLETE rows when the same item already has a scored ended run. */
export function filterSupersededIncompleteAttempts<T extends AttemptDisplayRow>(
  attempts: T[]
): T[] {
  const completedKeys = new Set<string>();
  for (const attempt of attempts) {
    if (
      attempt.endedAt != null &&
      attempt.status !== "INCOMPLETE"
    ) {
      completedKeys.add(attemptItemGroupKey(attempt));
    }
  }

  return attempts.filter((attempt) => {
    if (attempt.endedAt != null) return true;
    if (attempt.status !== "INCOMPLETE") return true;
    return !completedKeys.has(attemptItemGroupKey(attempt));
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
