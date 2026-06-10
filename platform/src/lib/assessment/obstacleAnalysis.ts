/**
 * Obstacle collision detection for grid route simulation (not number-line).
 */

import type { LevelGameplayConfig } from "@/lib/level-config";
import type { SimulationResult, Vec2 } from "@/lib/assessment/assessmentTypes";
import { vecKey } from "@/lib/assessment/routeAnalysis";

export type ObstacleCollisionReport = {
  hasObstacle: boolean;
  obstacleAvoided: boolean;
  obstacleCollision: boolean;
  obstacleCollisionCount: number;
  obstacleCollisionSteps: number[];
  attemptedObstacleCells: Vec2[];
  firstObstacleMistakeStep: number | null;
};

/** Blocked cells from level objects (blocksRobot or block type). */
export function extractObstacleCells(config: LevelGameplayConfig): Vec2[] {
  const cells: Vec2[] = [];
  const seen = new Set<string>();
  for (const o of config.gridObjects) {
    if (o.blocksRobot || o.objectType === "block") {
      const k = vecKey(o.position);
      if (!seen.has(k)) {
        seen.add(k);
        cells.push({ x: o.position.x, y: o.position.y });
      }
    }
  }
  return cells;
}

export function levelHasObstacles(config: LevelGameplayConfig): boolean {
  return extractObstacleCells(config).length > 0;
}

/** Derive obstacle report from a grid simulation (steps recorded by simulateProgram). */
export function analyzeObstacleCollisions(
  sim: SimulationResult,
  options?: { hasObstacle?: boolean }
): ObstacleCollisionReport {
  const hasObstacle = options?.hasObstacle ?? sim.hasObstacle ?? false;
  const steps = sim.obstacleCollisionSteps ?? [];
  const cells = sim.attemptedObstacleCells ?? [];
  const count = sim.obstacleCollisionCount ?? steps.length;
  const first = sim.firstObstacleMistakeStep ?? (steps[0] ?? null);

  return {
    hasObstacle,
    obstacleAvoided: hasObstacle && count === 0,
    obstacleCollision: count > 0,
    obstacleCollisionCount: count,
    obstacleCollisionSteps: steps,
    attemptedObstacleCells: cells,
    firstObstacleMistakeStep: first,
  };
}
