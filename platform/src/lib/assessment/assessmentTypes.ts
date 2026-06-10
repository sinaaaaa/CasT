/**
 * Evidence-Centered Design (ECD) types for stealth CT assessment.
 * Task → evidence → construct inference → teacher interpretation → recommendation.
 */

import type { LevelGameplayConfig } from "@/lib/level-config";
import type { PredictionAnalysisResult } from "@/lib/assessment/predictionAnalysis";
import type { ChoiceActionAnalysisResult } from "@/lib/assessment/choiceActionAnalysis";

/** Task types map to pedagogical emphasis — only weighted constructs are scored. */
/** Playfield geometry for assessment (grid maze vs horizontal number line). */
export type TaskEnvironmentType = "grid" | "number-line";

export type TaskType =
  | "algorithmic-thinking"
  | "debugging"
  | "decomposition"
  | "spatial-reasoning"
  | "correspondence"
  | "optimization"
  | "prediction"
  | "multi-stage-navigation";

/** Slugs align with CTConstruct.slug in the database. */
export type ConstructSlug =
  | "sequencing"
  | "algorithm-design"
  | "debugging"
  | "pattern-recognition"
  | "decomposition"
  | "logical-reasoning"
  | "evaluation"
  | "abstraction"
  | "conditionals"
  | "loops";

export type MasteryBand = "emerging" | "developing" | "proficient" | "advanced";

export type Vec2 = { x: number; y: number };

export type RobotCommand =
  | "forward"
  | "backward"
  | "turn left"
  | "turn right";

/** Level + construct mapping used by the assessment engine. */
export interface TaskAssessmentConfig {
  taskId: string;
  taskType: TaskType;
  primaryConstructs: ConstructSlug[];
  secondaryConstructs: ConstructSlug[];
  constructWeights: Partial<Record<ConstructSlug, number>>;
  goals: AssessmentGoal[];
  requiredGoalOrder: boolean;
  hasObstacle: boolean;
  compareWithOptimalRoute: boolean;
  taskEnvironmentType: TaskEnvironmentType;
  layoutMode: "GRID" | "NUMBER_LINE";
  levelConfig: LevelGameplayConfig;
}

/** One step along the number line (tick before → command → tick after). */
export interface NumberLineMovementStep {
  command: RobotCommand;
  tickBefore: number;
  tickAfter: number;
  /** Command matched expected movement along the line. */
  correspondenceOk: boolean;
  /** Distance to goal decreased (or reached goal). */
  towardGoal: boolean;
}

/** Visit target on a number-line level (tick index + object label). */
export interface NumberLineVisitTarget {
  tick: number;
  label: string;
  reached: boolean;
  /** Step index (0-based) when the robot first reached this tick, if reached. */
  reachedAtStep: number | null;
}

/** Specialized evidence for number-line tasks — no route efficiency / obstacles. */
export interface NumberLineEvidence {
  startTick: number;
  endTick: number;
  goalTick: number | null;
  /** True when level uses visit object 1 then visit object 2. */
  visitObjectSequence: boolean;
  visit1: NumberLineVisitTarget | null;
  visit2: NumberLineVisitTarget | null;
  /** Visited both objects in the required order (visit 1 before visit 2). */
  correctVisitOrder: boolean;
  startFacing: FacingLabel;
  endFacing: FacingLabel;
  commands: RobotCommand[];
  movementSteps: NumberLineMovementStep[];
  /** Recognized spawn tick on the line (0–100). */
  startPositionRecognition: number;
  /** Forward/backward matched facing and line movement (0–100). */
  directionAccuracy: number;
  /** Move count vs minimum ticks to goal (0–100). */
  stepCountingAccuracy: number;
  /** Each arrow produced the expected step (0–100). */
  arrowToMovementCorrespondence: number;
  /** Moves progress toward the goal in order (0–100). */
  movementSequencing: number;
  /** Start facing and direction sense along the line (0–100). */
  orientationUnderstanding: number;
  optimalMoveCount: number;
  studentMoveCount: number;
  passed: boolean;
  teacherNotes: {
    directionConfusion?: string;
    countingErrors?: string;
    movementConsistency?: string;
    orientationUnderstanding?: string;
  };
}

export interface AssessmentGoal {
  id: string;
  label: string;
  position: Vec2;
  order?: number;
  kind: "cell" | "object" | "visit";
  /** When set, robot must face this direction when reaching this goal (final goal uses task default if unset). */
  requiredFacing?: Vec2;
}

export type FacingLabel = "up" | "down" | "left" | "right";

/** Robot pose after each command (position + facing). */
export interface PathState {
  position: Vec2;
  facing: Vec2;
}

export interface SimulationStep {
  command: RobotCommand;
  positionBefore: Vec2;
  positionAfter: Vec2;
  facingBefore: Vec2;
  facingAfter: Vec2;
  collision: boolean;
  wrongTurn: boolean;
  /** Cell the robot tried to enter when a move was blocked. */
  attemptedCell?: Vec2;
  /** True when collision was with a blocked obstacle cell (not grid edge). */
  obstacleCollision?: boolean;
}

export interface SimulationResult {
  commands: RobotCommand[];
  path: Vec2[];
  /** Position and facing after each step (index 0 = start pose). */
  pathStates: PathState[];
  steps: SimulationStep[];
  collisions: Vec2[];
  wrongTurns: number;
  finalPosition: Vec2;
  finalDirection: Vec2;
  reachedGoals: string[];
  goalCompletion: number;
  subgoalCompletion: number;
  correctGoalOrder: boolean;
  commandCount: number;
  turnCount: number;
  passed: boolean;
  /** Level has obstacle/block cells. */
  hasObstacle?: boolean;
  obstacleCollisionCount?: number;
  obstacleCollisionSteps?: number[];
  attemptedObstacleCells?: Vec2[];
  firstObstacleMistakeStep?: number | null;
}

export type OptimalRouteVariant = {
  path: Vec2[];
  pathStates: PathState[];
  commands: RobotCommand[];
  commandCount: number;
};

export type RouteUnreachableReason =
  | "no_goal"
  | "no_path"
  | "required_facing"
  | "out_of_bounds";

export interface OptimalRouteResult {
  path: Vec2[];
  pathStates: PathState[];
  commands: RobotCommand[];
  commandCount: number;
  reachable: boolean;
  unreachableReason?: RouteUnreachableReason;
  /** Other shortest command sequences (same length), when several exist. */
  alternativeRoutes?: OptimalRouteVariant[];
  totalOptimalRouteCount?: number;
}

export interface RouteComparison {
  studentCommandCount: number;
  optimalCommandCount: number;
  efficiencyRatio: number;
  unnecessaryMoves: number;
  routeDeviation: number;
  overlapCells: number;
  extraCells: Vec2[];
  collisionPoints: Vec2[];
  studentPath: Vec2[];
  optimalPath: Vec2[];
  studentPathStates: PathState[];
  optimalPathStates: PathState[];
  /** Full command programs (not grid distance). */
  studentCommands: RobotCommand[];
  optimalCommands: RobotCommand[];
  extraCommands: number;
  extraTurns: number;
  studentTurnCount: number;
  optimalTurnCount: number;
  wrongTurns: number;
  collisions: number;
  startPosition: Vec2;
  startFacing: FacingLabel;
  /** Explicit anchors for maps — robot spawn and level win cell. */
  routeStartPosition: Vec2;
  routeGoalPosition: Vec2;
  endPosition: Vec2;
  studentEndFacing: FacingLabel;
  /** Facing after the last command on the best-route program. */
  optimalEndFacing?: FacingLabel;
  /** Required final facing when the level defines it; otherwise omitted. */
  requiredEndFacing?: FacingLabel;
  goalPositions: Vec2[];
  goalLabels: string[];
  alternativeOptimalRoutes?: OptimalRouteVariant[];
  totalOptimalRouteCount?: number;
  optimalReachable?: boolean;
  unreachableReason?: RouteUnreachableReason;
}

/** Raw gameplay evidence — no scores yet. */
export interface GameplayEvidence {
  commandCount: number;
  optimalCommandCount: number;
  efficiencyRatio: number;
  wrongTurns: number;
  collisions: number;
  unnecessaryMoves: number;
  directionAccuracy: number;
  goalCompletion: number;
  subgoalCompletion: number;
  correctGoalOrder: boolean;
  sequenceCoherence: number;
  obstacleAvoidance: number;
  routeRecovery: number;
  routeDeviation: number;
  predictionAccuracy: number;
  passed: boolean;
  attemptNumber: number;
  hintsUsed: number;
  editCount: number;
  clearCount: number;
  mistakeCount: number;
  robotTouchCount: number;
  robotTouched: boolean;
  resetCount: number;
  totalTimeSeconds: number;
  visitPattern?: string;
  reachedStart?: boolean;
  reachedEnd?: boolean;
  simulation: SimulationResult;
  routeComparison: RouteComparison | null;
  numberLineEvidence: NumberLineEvidence | null;
  taskEnvironmentType: TaskEnvironmentType;
  behaviors: string[];
  /** Flag / prediction tasks — misconception diagnosis (no route comparison). */
  predictionResult?: PredictionAnalysisResult | null;
  /** Choose-action (guided blank) tasks. */
  choiceActionResult?: ChoiceActionAnalysisResult | null;
}

export interface ConstructScore {
  slug: ConstructSlug;
  score: number;
  mastery: MasteryBand;
  weight: number;
  evidenceUsed: string[];
}

export interface TeacherBehaviorItem {
  kind: "behavior" | "interpretation" | "recommendation";
  text: string;
  emphasis?: ConstructSlug;
}

export interface TeacherAssessmentSummary {
  overallScore: number;
  overallMastery: MasteryBand;
  confidence: number;
  taskMastery: string;
  behaviors: string[];
  interpretations: string[];
  recommendations: string[];
  constructScores: ConstructScore[];
  routeComparison: RouteComparison | null;
  numberLineEvidence: NumberLineEvidence | null;
  taskEnvironmentType: TaskEnvironmentType;
  taskType: TaskType;
  predictionResult?: PredictionAnalysisResult | null;
  choiceActionResult?: ChoiceActionAnalysisResult | null;
}

export interface StealthAssessmentOutput {
  assessmentVersion: string;
  taskConfig: TaskAssessmentConfig;
  evidence: GameplayEvidence;
  constructScores: ConstructScore[];
  summary: TeacherAssessmentSummary;
  createdAt: string;
}

/** Attempt payload passed into extractEvidence (decoupled from Prisma). */
export interface AttemptEvidenceInput {
  attemptId: string;
  attemptNumber: number;
  passed: boolean;
  status: string;
  finalCommand: string | null;
  initialCommand?: string | null;
  commandHistory: unknown;
  hintsUsed: number;
  mistakes: unknown;
  totalTimeSeconds: number | null;
  robotTouched?: boolean;
  robotTouchCount: number;
  resetCount?: number;
  firstRobotTouchAt?: Date | null;
  startedAt?: Date;
  commandEvents: { command: string; action: string }[];
}
