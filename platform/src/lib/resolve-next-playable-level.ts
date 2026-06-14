export type PlayableLevelProgress = {
  id: string;
  levelKey: string;
  slot: number;
  passed: boolean;
  attempts: number;
};

/**
 * Next item in assignment order: first not yet passed.
 * Matches "Up next: Item N" on the student home screen.
 */
export function pickNextPlayableLevel(
  orderedLevels: PlayableLevelProgress[]
): PlayableLevelProgress | null {
  if (orderedLevels.length === 0) return null;
  return orderedLevels.find((level) => !level.passed) ?? orderedLevels[orderedLevels.length - 1];
}
