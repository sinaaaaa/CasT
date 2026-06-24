import { LevelType } from "@prisma/client";
import { formatItemDisplayName } from "@/lib/item-display";
import { parsePlaySlot } from "@/lib/attempt-mistakes";

export type PlayableItemRef = {
  id: string;
  name: string;
  levelKey?: string;
  levelType?: LevelType;
};

/** Label for a student's attempt — uses play slot + assignment order, not raw DB orderIndex alone. */
export function formatStudentAttemptItemLabel(
  playableLevels: PlayableItemRef[],
  levelId: string,
  fallbackName: string,
  playSlot?: number | null
): string {
  if (playSlot != null && playSlot >= 1 && playSlot <= playableLevels.length) {
    return formatItemDisplayName(playableLevels[playSlot - 1].name);
  }

  const idx = playableLevels.findIndex((l) => l.id === levelId);
  if (idx >= 0) {
    return formatItemDisplayName(playableLevels[idx].name);
  }

  return formatItemDisplayName(fallbackName);
}

export function formatStudentAttemptItemLabelFromAttempt(
  playableLevels: PlayableItemRef[],
  attempt: {
    levelId: string;
    levelName: string;
    mistakes?: unknown;
  }
): string {
  return formatStudentAttemptItemLabel(
    playableLevels,
    attempt.levelId,
    attempt.levelName,
    parsePlaySlot(attempt.mistakes)
  );
}
