/** Parsed run metadata stored on LevelAttempt.mistakes (from Unity assessmentExtras). */
export type AttemptRunMeta = {
  inLevelRunNumber: number | null;
  maxLevelRuns: number | null;
};

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
  return { inLevelRunNumber, maxLevelRuns };
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
