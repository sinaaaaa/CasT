import type { LevelGameplayConfig } from "@/lib/level-config";

/** Fields copied when duplicating a level's grid layout onto another level. */
export type GridLayoutCopyMode = "grid-only" | "grid-and-robot" | "full";

export function copyGridLayoutOnto(
  target: LevelGameplayConfig,
  source: LevelGameplayConfig,
  mode: GridLayoutCopyMode
): LevelGameplayConfig {
  const next: LevelGameplayConfig = {
    ...target,
    gridObjects: source.gridObjects.map((o) => ({ ...o, position: { ...o.position } })),
  };

  if (mode === "grid-only") return next;

  next.robotStartPosition = { ...source.robotStartPosition };
  next.robotStartFacing = { ...source.robotStartFacing };
  if (source.goalCell) {
    next.goalCell = { ...source.goalCell };
  } else {
    delete next.goalCell;
  }

  if (mode === "grid-and-robot") return next;

  return {
    ...next,
    showCellBlinkHighlights: source.showCellBlinkHighlights,
    blinkStartCells: source.blinkStartCells,
    blinkEndCells: source.blinkEndCells,
    allowRobotDrag: source.allowRobotDrag,
    allowGridObjectDrag: source.allowGridObjectDrag,
  };
}
