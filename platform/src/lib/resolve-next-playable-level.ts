export type PlayableLevelProgress = {
  id: string;
  levelKey: string;
  slot: number;
  passed: boolean;
  /** Item is done for playlist advance: passed or used all attempts (then Continue). */
  finished: boolean;
  attempts: number;
};

/**
 * Next item in assignment order: first not yet finished.
 * Finished = passed OR exhausted attempts (student already moved on after fail).
 * Matches sequential Play next after item 23 → item 24 even if an earlier item was never passed.
 */
export function pickNextPlayableLevel(
  orderedLevels: PlayableLevelProgress[]
): PlayableLevelProgress | null {
  if (orderedLevels.length === 0) return null;
  return (
    orderedLevels.find((level) => !level.finished) ??
    orderedLevels[orderedLevels.length - 1]
  );
}
