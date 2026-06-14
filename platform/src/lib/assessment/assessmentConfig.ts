/**
 * Configurable scoring thresholds and task-type → construct emphasis.
 * Formulas stay here so pedagogical tuning does not require engine changes.
 */

import type { LevelGameplayConfig } from "@/lib/level-config";
import type { LevelCTConstruct, CTConstruct } from "@prisma/client";
import type {
  AssessmentGoal,
  ConstructSlug,
  MasteryBand,
  TaskAssessmentConfig,
  TaskEnvironmentType,
  TaskType,
  Vec2,
} from "@/lib/assessment/assessmentTypes";
import { GRID_COLS, GRID_ROWS } from "@/lib/level-editor-constants";
import { programSupportsRouteAnalysis } from "@/lib/assessment/resolve-program";
import { LevelType } from "@prisma/client";

/** Grid flag-placement / predict-end-cell levels (no route efficiency). */
export function isFlagPredictionLevel(
  config: LevelGameplayConfig,
  levelType?: LevelType
): boolean {
  if (levelType === LevelType.FLAG_PLACEMENT) return true;
  if (config.useFlagPlacement || config.playerPicksEndCellWithFlag) return true;
  const explicit = (
    config as LevelGameplayConfig & { assessment?: { taskType?: string } }
  ).assessment?.taskType;
  return explicit === "prediction";
}

type AssessmentMeta = {
  taskType?: string;
  teacherCategory?: string;
  compareWithOptimalRoute?: boolean;
  minimalFixExpected?: boolean;
};

function levelAssessmentMeta(config: LevelGameplayConfig): AssessmentMeta | undefined {
  return (config as LevelGameplayConfig & { assessment?: AssessmentMeta }).assessment;
}

/** Edit starter program (drag & drop yellow strip) — repair assessment, never path-building. */
export function isEditStarterProgramLevel(
  config: LevelGameplayConfig,
  levelType?: LevelType
): boolean {
  if (levelType === LevelType.DRAG_EDIT_PROGRAM) return true;
  const meta = levelAssessmentMeta(config);
  return meta?.teacherCategory === "Fixing a Program" || meta?.taskType === "debugging";
}

/** Fixing a broken starter program (repair process, not route-vs-best as main report). */
export function isDebuggingLevel(
  config: LevelGameplayConfig,
  levelType?: LevelType
): boolean {
  if (isPathBuildingLevel(config, levelType)) return false;
  return isEditStarterProgramLevel(config, levelType);
}

/** Drag action blocks only — build a route from scratch (never edit-starter). */
export function isPathBuildingLevel(
  config: LevelGameplayConfig,
  levelType?: LevelType
): boolean {
  if (config.layoutMode === "NUMBER_LINE") return false;
  return levelType === LevelType.DRAG_ACTIONS;
}

/**
 * @deprecated Use isEditStarterProgramLevel / isDebuggingLevel. Kept for imports;
 * never overlaps path-building (DRAG_ACTIONS).
 */
export function isDragEditProgramLevel(
  config: LevelGameplayConfig,
  levelType?: LevelType
): boolean {
  if (isPathBuildingLevel(config, levelType)) return false;
  return isEditStarterProgramLevel(config, levelType);
}

/** Guided blank / choose-action button levels. */
export function isChooseActionLevel(
  config: LevelGameplayConfig,
  levelType?: LevelType
): boolean {
  if (levelType === LevelType.CHOOSE_BUTTONS) return true;
  const explicit = (
    config as LevelGameplayConfig & { assessment?: { taskType?: string } }
  ).assessment?.taskType;
  return typeof explicit === "string" && explicit === "choice-action";
}

export const ASSESSMENT_VERSION = "v1";

/** ECD mastery bands (0–100). */
export const MASTERY_THRESHOLDS = {
  emerging: { min: 0, max: 39 },
  developing: { min: 40, max: 64 },
  proficient: { min: 65, max: 84 },
  advanced: { min: 85, max: 100 },
} as const;

export function masteryFromScore(score: number): MasteryBand {
  const s = clampScore(score);
  if (s >= MASTERY_THRESHOLDS.advanced.min) return "advanced";
  if (s >= MASTERY_THRESHOLDS.proficient.min) return "proficient";
  if (s >= MASTERY_THRESHOLDS.developing.min) return "developing";
  return "emerging";
}

export function masteryLabel(band: MasteryBand): string {
  return band.charAt(0).toUpperCase() + band.slice(1);
}

export function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Which constructs each task type is designed to measure (primary = full weight, secondary = partial). */
export const TASK_TYPE_CONSTRUCT_EMPHASIS: Record<
  TaskType,
  { primary: ConstructSlug[]; secondary: ConstructSlug[] }
> = {
  "algorithmic-thinking": {
    primary: ["algorithm-design", "sequencing", "logical-reasoning"],
    secondary: ["evaluation"],
  },
  debugging: {
    primary: ["debugging", "logical-reasoning"],
    secondary: ["sequencing", "evaluation"],
  },
  decomposition: {
    primary: ["decomposition", "sequencing"],
    secondary: ["algorithm-design"],
  },
  "spatial-reasoning": {
    primary: ["conditionals", "logical-reasoning"],
    secondary: ["sequencing"],
  },
  correspondence: {
    primary: ["sequencing", "logical-reasoning"],
    secondary: ["abstraction"],
  },
  optimization: {
    primary: ["evaluation", "algorithm-design"],
    secondary: ["sequencing"],
  },
  prediction: {
    primary: ["logical-reasoning", "conditionals"],
    secondary: ["sequencing"],
  },
  "multi-stage-navigation": {
    primary: ["decomposition", "sequencing", "algorithm-design"],
    secondary: ["logical-reasoning"],
  },
};

/** Metric → construct contribution weights inside score formulas (sum ≤ 1 per construct). */
export const CONSTRUCT_METRIC_WEIGHTS: Record<
  ConstructSlug,
  Partial<Record<string, number>>
> = {
  sequencing: {
    sequenceCoherence: 0.35,
    correctGoalOrder: 0.25,
    goalCompletion: 0.25,
    directionAccuracy: 0.15,
  },
  "algorithm-design": {
    goalCompletion: 0.3,
    obstacleAvoidance: 0.25,
    subgoalCompletion: 0.25,
    routeDeviation: 0.2,
  },
  debugging: {
    routeRecovery: 0.35,
    editCount: 0.25,
    collisions: 0.2,
    attemptNumber: 0.2,
  },
  decomposition: {
    subgoalCompletion: 0.4,
    correctGoalOrder: 0.3,
    goalCompletion: 0.3,
  },
  "logical-reasoning": {
    predictionAccuracy: 0.35,
    directionAccuracy: 0.3,
    goalCompletion: 0.35,
  },
  evaluation: {
    efficiencyRatio: 0.45,
    unnecessaryMoves: 0.3,
    passed: 0.25,
  },
  conditionals: {
    directionAccuracy: 0.4,
    wrongTurns: 0.3,
    predictionAccuracy: 0.3,
  },
  abstraction: {
    robotTouchCount: 0.4,
    hintsUsed: 0.3,
    editCount: 0.3,
  },
  "pattern-recognition": {
    sequenceCoherence: 0.5,
    efficiencyRatio: 0.5,
  },
  loops: {},
};

export const GRID_BOUNDS = { cols: GRID_COLS, rows: GRID_ROWS };

type MappingWithConstruct = LevelCTConstruct & { construct: CTConstruct };

const VALID_SLUGS = new Set<string>(Object.keys(CONSTRUCT_METRIC_WEIGHTS));

function slugOrNull(s: string): ConstructSlug | null {
  return VALID_SLUGS.has(s) ? (s as ConstructSlug) : null;
}

/** Grid maze vs horizontal number line (drives evidence model). */
export function resolveTaskEnvironmentType(
  config: LevelGameplayConfig
): TaskEnvironmentType {
  const explicit = (
    config as LevelGameplayConfig & {
      assessment?: { taskEnvironmentType?: TaskEnvironmentType };
    }
  ).assessment?.taskEnvironmentType;
  if (explicit) return explicit;
  return config.layoutMode === "NUMBER_LINE" ? "number-line" : "grid";
}

/** Infer task type from level design when not set in config.assessment.taskType */
export function inferTaskType(config: LevelGameplayConfig): TaskType {
  const explicit = (config as LevelGameplayConfig & { assessment?: { taskType?: TaskType } })
    .assessment?.taskType;
  if (explicit) return explicit;

  if (config.visitObjectSequence) return "multi-stage-navigation";
  if (isPathBuildingLevel(config, undefined)) return "algorithmic-thinking";
  if (isDebuggingLevel(config, undefined)) return "debugging";
  if (isFlagPredictionLevel(config, undefined)) return "prediction";
  if (isChooseActionLevel(config, undefined)) return "correspondence";
  if (config.layoutMode === "NUMBER_LINE") return "prediction";
  const hasBlock = config.gridObjects.some(
    (o) => o.blocksRobot || o.objectType === "block"
  );
  if (hasBlock) return "algorithmic-thinking";
  if ((config.guidedActions?.length ?? 0) > 0) return "correspondence";
  return "algorithmic-thinking";
}

/** Build ECD task config from level JSON + DB construct mappings. */
export function buildTaskAssessmentConfig(
  taskId: string,
  levelConfig: LevelGameplayConfig,
  mappings: MappingWithConstruct[],
  levelType?: LevelType
): TaskAssessmentConfig {
  const taskType = inferTaskType(levelConfig);
  const emphasis = TASK_TYPE_CONSTRUCT_EMPHASIS[taskType];

  const constructWeights: Partial<Record<ConstructSlug, number>> = {};
  for (const m of mappings) {
    const slug = slugOrNull(m.construct.slug);
    if (slug) constructWeights[slug] = m.weightPercent;
  }

  const mappedSlugs = Object.keys(constructWeights) as ConstructSlug[];
  const primaryConstructs =
    mappedSlugs.filter((s) => emphasis.primary.includes(s)).length > 0
      ? mappedSlugs.filter((s) => emphasis.primary.includes(s))
      : emphasis.primary.filter((s) => mappedSlugs.length === 0 || mappedSlugs.includes(s));

  const secondaryConstructs = emphasis.secondary.filter(
    (s) => !primaryConstructs.includes(s) && (mappedSlugs.length === 0 || mappedSlugs.includes(s))
  );

  const goals = extractRouteGoalsFromLevel(levelConfig);
  const hasObstacle = levelConfig.gridObjects.some(
    (o) => o.blocksRobot || o.objectType === "block"
  );

  const assessmentMeta = (levelConfig as LevelGameplayConfig & {
    assessment?: {
      compareWithOptimalRoute?: boolean;
      requiredGoalOrder?: boolean;
      taskEnvironmentType?: TaskEnvironmentType;
    };
  }).assessment;

  const taskEnvironmentType = resolveTaskEnvironmentType(levelConfig);
  const flagPrediction = isFlagPredictionLevel(levelConfig, levelType);
  const chooseAction = isChooseActionLevel(levelConfig, levelType);
  const debugging = isDebuggingLevel(levelConfig, levelType);
  const pathBuilding = isPathBuildingLevel(levelConfig, levelType);
  const gridRouteDefault =
    !flagPrediction &&
    !chooseAction &&
    !debugging &&
    (pathBuilding || (assessmentMeta?.compareWithOptimalRoute ??
      programSupportsRouteAnalysis(levelConfig, levelType)));

  return {
    taskId,
    taskType,
    primaryConstructs,
    secondaryConstructs,
    constructWeights,
    goals,
    requiredGoalOrder:
      assessmentMeta?.requiredGoalOrder ?? levelConfig.visitObjectSequence,
    hasObstacle: taskEnvironmentType === "grid" && hasObstacle,
    compareWithOptimalRoute:
      taskEnvironmentType === "grid" && gridRouteDefault,
    taskEnvironmentType,
    layoutMode: levelConfig.layoutMode ?? "GRID",
    levelConfig,
  };
}

function sameCell(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return a.x === b.x && a.y === b.y;
}

function objectGoalCell(o: {
  position: { x: number; y: number };
  guidedEndPosition?: { x: number; y: number };
}): { x: number; y: number } {
  const g = o.guidedEndPosition;
  if (g && g.x >= 0 && g.y >= 0) return { x: g.x, y: g.y };
  return { x: o.position.x, y: o.position.y };
}

/** End object / visit step 2 — never the start visit or robot spawn. */
export function resolveRouteEndObject(
  config: LevelGameplayConfig
): { position: { x: number; y: number }; label: string } | null {
  const objs = config.gridObjects ?? [];
  const visit2 = objs.find((o) => o.visitOrder === 2);
  if (visit2) {
    const pos = objectGoalCell(visit2);
    return { position: pos, label: visit2.objectType };
  }
  const endObj = objs.find((o) => o.isEndObject);
  if (endObj) {
    const pos = objectGoalCell(endObj);
    return { position: pos, label: endObj.objectType };
  }
  return null;
}

/**
 * Win cell for route / BFS.
 * Visit-sequence levels: always the end object (step 2), not goalCell on the start/robo cell.
 * Other levels: goalCell if set, else isEndObject.
 */
export function resolveRouteWinCell(
  config: LevelGameplayConfig
): { position: { x: number; y: number }; label: string } | null {
  const endObject = resolveRouteEndObject(config);

  const goalCellValid =
    config.goalCell != null && config.goalCell.x >= 0 && config.goalCell.y >= 0;

  if (config.visitObjectSequence) {
    if (endObject) return endObject;
    if (goalCellValid) {
      return {
        position: { x: config.goalCell!.x, y: config.goalCell!.y },
        label: "goal",
      };
    }
    return null;
  }

  if (goalCellValid && endObject) {
    return {
      position: { x: config.goalCell!.x, y: config.goalCell!.y },
      label: endObject.label,
    };
  }

  if (goalCellValid) {
    return {
      position: { x: config.goalCell!.x, y: config.goalCell!.y },
      label: "goal",
    };
  }

  return endObject;
}

export type GridObjectMarkerRole = "start" | "end" | "prop" | "block";

export type GridObjectMarker = {
  position: Vec2;
  label: string;
  role: GridObjectMarkerRole;
};

/** Start, win cell, and props for assessment maps (never the student's last path cell). */
export function resolveRouteMapAnchors(
  config: LevelGameplayConfig,
  options?: { studentEnd?: Vec2 | null }
): {
  routeStartPosition: Vec2;
  routeGoalPosition: Vec2;
  goalLabel: string;
  studentEndPosition: Vec2 | null;
  objects: GridObjectMarker[];
} {
  const start = resolveRouteStartCell(config);
  const win = resolveRouteWinCell(config);
  const objects: GridObjectMarker[] = (config.gridObjects ?? []).map((o) => ({
    position: { x: o.position.x, y: o.position.y },
    label: o.objectType,
    role: o.isEndObject
      ? "end"
      : o.isStartObject
        ? "start"
        : o.blocksRobot
          ? "block"
          : "prop",
  }));

  const goalPos = win?.position ?? { ...start.position };

  return {
    routeStartPosition: { ...start.position },
    routeGoalPosition: { ...goalPos },
    goalLabel: win?.label ?? "goal",
    studentEndPosition: options?.studentEnd ?? null,
    objects,
  };
}

/** Robot spawn — always the BFS/simulation start (never the win cell). */
export function resolveRouteStartCell(config: LevelGameplayConfig): {
  position: { x: number; y: number };
  facing: { x: number; y: number };
} {
  return {
    position: { x: config.robotStartPosition.x, y: config.robotStartPosition.y },
    facing: { x: config.robotStartFacing.x, y: config.robotStartFacing.y },
  };
}

/** First visit object (visit order 1) for visit-sequence levels. */
export function resolveRouteStartVisitObject(
  config: LevelGameplayConfig
): { position: { x: number; y: number }; label: string } | null {
  const objs = config.gridObjects ?? [];
  const visit1 = objs.find((o) => o.visitOrder === 1);
  if (visit1) {
    const pos = objectGoalCell(visit1);
    return { position: pos, label: visit1.objectType };
  }
  const startObj = objs.find((o) => o.isStartObject);
  if (startObj) {
    const pos = objectGoalCell(startObj);
    return { position: pos, label: startObj.objectType };
  }
  return null;
}

/**
 * Goals for simulation / BFS.
 * Visit-sequence levels: visit object 1 then visit object 2 (both required).
 * Other levels: single win cell from resolveRouteWinCell().
 */
export function extractRouteGoalsFromLevel(config: LevelGameplayConfig): AssessmentGoal[] {
  if (config.visitObjectSequence) {
    const visit1 = resolveRouteStartVisitObject(config);
    const visit2 = resolveRouteEndObject(config);
    const goals: AssessmentGoal[] = [];
    if (visit1) {
      goals.push({
        id: "visit-1",
        label: visit1.label,
        position: { ...visit1.position },
        order: 1,
        kind: "visit",
      });
    }
    if (visit2) {
      goals.push({
        id: "visit-2",
        label: visit2.label,
        position: { ...visit2.position },
        order: 2,
        kind: "visit",
      });
    }
    if (goals.length > 0) return goals;
  }

  const win = resolveRouteWinCell(config);
  if (win) {
    return [
      {
        id: "route-win",
        label: win.label,
        position: { ...win.position },
        order: 1,
        kind: "cell",
      },
    ];
  }

  if (config.gridObjects.length > 0) {
    const fallback =
      config.gridObjects.find((o) => o.isEndObject) ??
      config.gridObjects[config.gridObjects.length - 1];
    return [
      {
        id: "implicit-goal",
        label: fallback.objectType,
        position: { x: fallback.position.x, y: fallback.position.y },
        kind: "object",
        order: 1,
      },
    ];
  }

  return [];
}
