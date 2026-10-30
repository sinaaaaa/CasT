/**
 * Simulate the authored Geometry Path program into undirected grid edges.
 * Used for DRAW_PATH items: the expected drawing is the path the program actually takes.
 */

import type { LevelGameplayConfig } from "@/lib/level-config";
import { resolveCommandBagProgramTokens } from "@/lib/level-config";
import { expandGuidedActions } from "@/lib/assessment/resolve-program";
import { simulateProgram } from "@/lib/assessment/routeAnalysis";
import { areAdjacent, type PathSegment } from "@/lib/geometry-path";

export function geometryProgramPathSegments(config: LevelGameplayConfig): PathSegment[] {
  const guided = resolveCommandBagProgramTokens(
    config.guidedActions ?? [],
    config.commandBags
  );
  const tokens = expandGuidedActions(guided);
  if (tokens.length === 0) return [];

  const sim = simulateProgram(config, tokens);
  const segs: PathSegment[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < sim.path.length; i++) {
    const from = sim.path[i - 1]!;
    const to = sim.path[i]!;
    if (from.x === to.x && from.y === to.y) continue;
    if (!areAdjacent(from, to)) continue;
    const aFirst = from.x < to.x || (from.x === to.x && from.y <= to.y);
    const key = aFirst
      ? `${from.x},${from.y}|${to.x},${to.y}`
      : `${to.x},${to.y}|${from.x},${from.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    segs.push({ from: { ...from }, to: { ...to } });
  }
  return segs;
}
