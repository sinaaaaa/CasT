/**
 * Flag / prediction task assessment — misconception simulation + flag matching.
 * No best route, efficiency, or optimal path.
 */

import type { LevelGameplayConfig } from "@/lib/level-config";
import { LevelType } from "@prisma/client";
import { GRID_COLS, GRID_ROWS } from "@/lib/level-editor-constants";
import {
  buildTaskAssessmentConfig,
  clampScore,
  masteryFromScore,
  resolveRouteStartCell,
} from "@/lib/assessment/assessmentConfig";
import type { FacingLabel, RobotCommand, Vec2 } from "@/lib/assessment/assessmentTypes";
import { facingToLabel, normalizeFacing } from "@/lib/assessment/routeAnalysis";
import { resolveAttemptProgram } from "@/lib/assessment/resolve-program";
import { parseStudentFlagFromMistakes } from "@/lib/assessment/evidenceExtractors";
import type { AttemptEvidenceInput } from "@/lib/assessment/assessmentTypes";

export type PredictionMistakeType =
  | "correct"
  | "oneStepCountingError"
  | "leftRightTurnConfusion"
  | "turnAsMoveError"
  | "ignoredTurnError"
  | "wrongStartDirection"
  | "forwardBackwardConfusion"
  | "oppositeMovementError"
  | "invalidFlagPosition"
  | "unclear";

export type MatchQuality = "strong" | "close" | "possible" | "weak";

export type MisconceptionModelId =
  | "correct"
  | "leftRightSwapped"
  | "turnAsMove"
  | "ignoreTurns"
  | "wrongStartDirection-up"
  | "wrongStartDirection-right"
  | "wrongStartDirection-down"
  | "wrongStartDirection-left"
  | "forwardBackwardSwapped"
  | "oppositeMovement";

export type MisconceptionMatch = {
  modelId: MisconceptionModelId;
  label: string;
  finalPosition: Vec2;
  distance: number;
  exactMatch: boolean;
};

export type PredictionAnalysisInput = {
  startPosition: Vec2;
  startDirection: Vec2;
  givenCommands: RobotCommand[];
  studentFlagPosition: Vec2 | null;
  gridSize?: { cols: number; rows: number };
  obstacles?: Vec2[];
};

export type PredictionAnalysisResult = {
  available: boolean;
  isCorrect: boolean;
  score: number;
  level: ReturnType<typeof masteryFromScore>;
  expectedFinalPosition: Vec2 | null;
  studentFlagPosition: Vec2 | null;
  distanceFromExpected: number;
  detectedMistakeType: PredictionMistakeType;
  matchQuality: MatchQuality;
  teacherExplanation: string;
  recommendation: string;
  misconceptionMatches: MisconceptionMatch[];
  givenCommands: RobotCommand[];
  predictionComplete: boolean;
};

const FACING_UP: Vec2 = { x: 0, y: 1 };
const FACING_RIGHT: Vec2 = { x: 1, y: 0 };
const FACING_DOWN: Vec2 = { x: 0, y: -1 };
const FACING_LEFT: Vec2 = { x: -1, y: 0 };

export const PREDICTION_TEACHER_COPY: Record<PredictionMistakeType, string> = {
  correct: "Student accurately predicted where the robot would end.",
  oneStepCountingError:
    "Student placed the flag close to the correct cell. This may show a small counting or one-step tracking error.",
  leftRightTurnConfusion:
    "Student's flag matches where the robot would land if left and right turns were swapped.",
  turnAsMoveError:
    "Student's flag matches where the robot would land if a turn was treated like moving sideways instead of rotating in place.",
  ignoredTurnError:
    "Student's flag matches a path where the robot did not change direction after turning.",
  wrongStartDirection:
    "Student's flag matches a path that starts from a different facing direction.",
  forwardBackwardConfusion:
    "Student's flag matches a path where forward and backward were reversed.",
  oppositeMovementError:
    "Student's flag suggests the movement direction may have been reversed.",
  invalidFlagPosition: "The flag was placed outside the valid grid area.",
  unclear: "The flag does not match a common mistake pattern.",
};

const RECOMMENDATIONS: Record<PredictionMistakeType, string> = {
  correct: "Assign another prediction task with one turn to extend spatial reasoning.",
  oneStepCountingError:
    "Assign a short prediction task with only forward moves to practice step counting.",
  leftRightTurnConfusion:
    "Assign another prediction task with one turn and discuss left vs right from the robot's view.",
  turnAsMoveError:
    "Review that turn commands rotate the robot in place; then try a one-turn prediction level.",
  ignoredTurnError:
    "Practice predicting how the robot's facing changes after a turn command.",
  wrongStartDirection:
    "Confirm the robot's starting direction before predicting the ending cell.",
  forwardBackwardConfusion:
    "Practice forward vs backward from the robot's current facing direction.",
  oppositeMovementError:
    "Use a guided prediction with arrows showing the robot's facing direction.",
  invalidFlagPosition: "Review valid cells on the grid before placing the flag.",
  unclear: "Assign a simpler prediction task with fewer commands.",
};

function vecEqual(a: Vec2, b: Vec2): boolean {
  return a.x === b.x && a.y === b.y;
}

function manhattan(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function blockedSet(obstacles: Vec2[] | undefined): Set<string> {
  const set = new Set<string>();
  for (const o of obstacles ?? []) set.add(`${o.x},${o.y}`);
  return set;
}

function rotateLeft(f: Vec2): Vec2 {
  return { x: -f.y, y: f.x };
}
function rotateRight(f: Vec2): Vec2 {
  return { x: f.y, y: -f.x };
}

function inGrid(p: Vec2, cols: number, rows: number): boolean {
  return p.x >= 0 && p.x < cols && p.y >= 0 && p.y < rows;
}

function hasTurnCommands(commands: RobotCommand[]): boolean {
  return commands.some((c) => c === "turn left" || c === "turn right");
}

function hasForwardBackwardContrast(commands: RobotCommand[]): boolean {
  return commands.includes("forward") && commands.includes("backward");
}

type SimModel =
  | "correct"
  | "leftRightSwapped"
  | "turnAsMove"
  | "ignoreTurns"
  | "forwardBackwardSwapped"
  | "oppositeMovement";

function simulateWithModel(
  start: Vec2,
  startFacing: Vec2,
  commands: RobotCommand[],
  model: SimModel,
  blocked: Set<string>,
  cols: number,
  rows: number
): Vec2 {
  let pos = { ...start };
  let facing = normalizeFacing(startFacing);

  for (const cmd of commands) {
    if (model === "ignoreTurns" && (cmd === "turn left" || cmd === "turn right")) {
      continue;
    }

    let effective: RobotCommand = cmd;
    if (model === "leftRightSwapped") {
      if (cmd === "turn left") effective = "turn right";
      else if (cmd === "turn right") effective = "turn left";
    }
    if (model === "forwardBackwardSwapped" || model === "oppositeMovement") {
      if (cmd === "forward") effective = "backward";
      else if (cmd === "backward") effective = "forward";
    }

    if (model === "turnAsMove" && cmd === "turn left") {
      const side = rotateLeft(facing);
      const candidate = { x: pos.x + side.x, y: pos.y + side.y };
      if (inGrid(candidate, cols, rows) && !blocked.has(`${candidate.x},${candidate.y}`)) {
        pos = candidate;
      }
      continue;
    }
    if (model === "turnAsMove" && cmd === "turn right") {
      const side = rotateRight(facing);
      const candidate = { x: pos.x + side.x, y: pos.y + side.y };
      if (inGrid(candidate, cols, rows) && !blocked.has(`${candidate.x},${candidate.y}`)) {
        pos = candidate;
      }
      continue;
    }

    if (effective === "turn left") facing = rotateLeft(facing);
    else if (effective === "turn right") facing = rotateRight(facing);
    else if (effective === "forward" || effective === "backward") {
      const delta =
        effective === "forward" ? facing : { x: -facing.x, y: -facing.y };
      const candidate = { x: pos.x + delta.x, y: pos.y + delta.y };
      if (inGrid(candidate, cols, rows) && !blocked.has(`${candidate.x},${candidate.y}`)) {
        pos = candidate;
      }
    }
  }

  return pos;
}

const START_DIRECTIONS: { id: MisconceptionModelId; label: string; facing: Vec2 }[] = [
  { id: "wrongStartDirection-up", label: "Wrong start: facing up", facing: FACING_UP },
  { id: "wrongStartDirection-right", label: "Wrong start: facing right", facing: FACING_RIGHT },
  { id: "wrongStartDirection-down", label: "Wrong start: facing down", facing: FACING_DOWN },
  { id: "wrongStartDirection-left", label: "Wrong start: facing left", facing: FACING_LEFT },
];

function mistakeFromModel(model: SimModel | MisconceptionModelId): PredictionMistakeType {
  if (model === "correct") return "correct";
  if (model === "leftRightSwapped") return "leftRightTurnConfusion";
  if (model === "turnAsMove") return "turnAsMoveError";
  if (model === "ignoreTurns") return "ignoredTurnError";
  if (model.startsWith("wrongStartDirection")) return "wrongStartDirection";
  if (model === "forwardBackwardSwapped") return "forwardBackwardConfusion";
  if (model === "oppositeMovement") return "oppositeMovementError";
  return "unclear";
}

function scoreFromDiagnosis(
  mistake: PredictionMistakeType,
  matchQuality: MatchQuality,
  distance: number
): number {
  if (mistake === "correct") return 100;
  if (mistake === "invalidFlagPosition") return 15;
  if (mistake === "oneStepCountingError") return 75;
  if (matchQuality === "strong") return clampScore(58);
  if (matchQuality === "close" && distance === 1) return clampScore(48);
  if (matchQuality === "possible") return clampScore(42);
  if (mistake === "unclear") return clampScore(Math.max(10, 30 - distance * 8));
  return 40;
}

function buildMisconceptionMatches(params: {
  start: Vec2;
  defaultFacing: Vec2;
  givenCommands: RobotCommand[];
  blocked: Set<string>;
  cols: number;
  rows: number;
  studentFlag?: Vec2 | null;
}): MisconceptionMatch[] {
  const { start, defaultFacing, givenCommands, blocked, cols, rows, studentFlag } = params;
  const misconceptionMatches: MisconceptionMatch[] = [];

  const addMatch = (modelId: MisconceptionModelId, label: string, pos: Vec2) => {
    misconceptionMatches.push({
      modelId,
      label,
      finalPosition: pos,
      distance: studentFlag ? manhattan(studentFlag, pos) : 0,
      exactMatch: studentFlag ? vecEqual(studentFlag, pos) : false,
    });
  };

  const expected = simulateWithModel(
    start,
    defaultFacing,
    givenCommands,
    "correct",
    blocked,
    cols,
    rows
  );
  addMatch("correct", "Correct rules", expected);

  if (hasTurnCommands(givenCommands)) {
    addMatch(
      "leftRightSwapped",
      "Left/right turns swapped",
      simulateWithModel(start, defaultFacing, givenCommands, "leftRightSwapped", blocked, cols, rows)
    );
    addMatch(
      "turnAsMove",
      "Turn treated as sideways move",
      simulateWithModel(start, defaultFacing, givenCommands, "turnAsMove", blocked, cols, rows)
    );
    addMatch(
      "ignoreTurns",
      "Turns ignored",
      simulateWithModel(start, defaultFacing, givenCommands, "ignoreTurns", blocked, cols, rows)
    );
  }

  if (hasForwardBackwardContrast(givenCommands)) {
    addMatch(
      "forwardBackwardSwapped",
      "Forward/backward swapped",
      simulateWithModel(
        start,
        defaultFacing,
        givenCommands,
        "forwardBackwardSwapped",
        blocked,
        cols,
        rows
      )
    );
    addMatch(
      "oppositeMovement",
      "Opposite movement",
      simulateWithModel(
        start,
        defaultFacing,
        givenCommands,
        "oppositeMovement",
        blocked,
        cols,
        rows
      )
    );
  }

  const correctFacingLabel = facingToLabel(defaultFacing);
  for (const sd of START_DIRECTIONS) {
    if (facingToLabel(sd.facing) === correctFacingLabel) continue;
    addMatch(
      sd.id,
      sd.label,
      simulateWithModel(start, sd.facing, givenCommands, "correct", blocked, cols, rows)
    );
  }

  return misconceptionMatches;
}

/** Core diagnosis: given commands + flag → score and mistake type. */
export function analyzePrediction(input: PredictionAnalysisInput): PredictionAnalysisResult {
  const cols = input.gridSize?.cols ?? GRID_COLS;
  const rows = input.gridSize?.rows ?? GRID_ROWS;
  const blocked = blockedSet(input.obstacles);
  const givenCommands = input.givenCommands;
  const start = input.startPosition;
  const defaultFacing = normalizeFacing(input.startDirection);

  const expected = simulateWithModel(start, defaultFacing, givenCommands, "correct", blocked, cols, rows);

  if (!input.studentFlagPosition) {
    const misconceptionMatches = buildMisconceptionMatches({
      start,
      defaultFacing,
      givenCommands,
      blocked,
      cols,
      rows,
    });
    return {
      available: givenCommands.length > 0,
      isCorrect: false,
      score: 0,
      level: masteryFromScore(0),
      expectedFinalPosition: expected,
      studentFlagPosition: null,
      distanceFromExpected: 99,
      detectedMistakeType: "unclear",
      matchQuality: "weak",
      teacherExplanation:
        givenCommands.length > 0
          ? "The student's flag cell was not saved for this attempt (often caused by Unity sending -1,-1). Use the misconception models below to see where the robot would stop under each rule set."
          : PREDICTION_TEACHER_COPY.unclear,
      recommendation: RECOMMENDATIONS.unclear,
      misconceptionMatches,
      givenCommands,
      predictionComplete: false,
    };
  }

  const flag = input.studentFlagPosition;

  if (!inGrid(flag, cols, rows)) {
    const misconceptionMatches = buildMisconceptionMatches({
      start,
      defaultFacing,
      givenCommands,
      blocked,
      cols,
      rows,
      studentFlag: flag,
    });
    return {
      available: givenCommands.length > 0,
      isCorrect: false,
      score: 15,
      level: masteryFromScore(15),
      expectedFinalPosition: expected,
      studentFlagPosition: flag,
      distanceFromExpected: 99,
      detectedMistakeType: "invalidFlagPosition",
      matchQuality: "weak",
      teacherExplanation: PREDICTION_TEACHER_COPY.invalidFlagPosition,
      recommendation: RECOMMENDATIONS.invalidFlagPosition,
      misconceptionMatches,
      givenCommands,
      predictionComplete: false,
    };
  }

  const misconceptionMatches = buildMisconceptionMatches({
    start,
    defaultFacing,
    givenCommands,
    blocked,
    cols,
    rows,
    studentFlag: flag,
  });

  const distCorrect = manhattan(flag, expected);

  if (vecEqual(flag, expected)) {
    return {
      available: true,
      isCorrect: true,
      score: 100,
      level: "advanced",
      expectedFinalPosition: expected,
      studentFlagPosition: flag,
      distanceFromExpected: 0,
      detectedMistakeType: "correct",
      matchQuality: "strong",
      teacherExplanation: PREDICTION_TEACHER_COPY.correct,
      recommendation: RECOMMENDATIONS.correct,
      misconceptionMatches,
      givenCommands,
      predictionComplete: true,
    };
  }

  type Candidate = {
    mistake: PredictionMistakeType;
    modelId: MisconceptionModelId;
    distance: number;
    exact: boolean;
    priority: number;
  };

  const candidates: Candidate[] = [];

  for (const m of misconceptionMatches) {
    if (m.modelId === "correct") continue;
    if (m.modelId.startsWith("wrongStartDirection") && m.exactMatch) {
      const altCount = misconceptionMatches.filter(
        (x) => x.modelId !== "correct" && x.exactMatch && !x.modelId.startsWith("wrongStartDirection")
      ).length;
      if (altCount > 0) continue;
    }
    if (m.modelId === "leftRightSwapped" && !hasTurnCommands(givenCommands)) continue;
    if (
      (m.modelId === "forwardBackwardSwapped" || m.modelId === "oppositeMovement") &&
      !hasForwardBackwardContrast(givenCommands)
    ) {
      continue;
    }

    const mistake = mistakeFromModel(m.modelId);
    let priority = 10;
    if (m.exactMatch) priority = 3;
    else if (m.distance <= 1) priority = 4;
    else priority = 5 + m.distance;

    if (mistake === "leftRightTurnConfusion") priority = 3.1;
    if (mistake === "oneStepCountingError") priority = 2;

    candidates.push({
      mistake,
      modelId: m.modelId,
      distance: m.distance,
      exact: m.exactMatch,
      priority,
    });
  }

  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.distance - b.distance;
  });

  const exactMisconception = candidates.filter((c) => c.exact);
  const bestExact = exactMisconception[0];
  if (bestExact) {
    const matchQuality: MatchQuality = "strong";
    const score = scoreFromDiagnosis(bestExact.mistake, matchQuality, bestExact.distance);
    return {
      available: true,
      isCorrect: false,
      score,
      level: masteryFromScore(score),
      expectedFinalPosition: expected,
      studentFlagPosition: flag,
      distanceFromExpected: distCorrect,
      detectedMistakeType: bestExact.mistake,
      matchQuality,
      teacherExplanation: PREDICTION_TEACHER_COPY[bestExact.mistake],
      recommendation: RECOMMENDATIONS[bestExact.mistake],
      misconceptionMatches,
      givenCommands,
      predictionComplete: false,
    };
  }

  if (distCorrect === 1) {
    return {
      available: true,
      isCorrect: false,
      score: 75,
      level: masteryFromScore(75),
      expectedFinalPosition: expected,
      studentFlagPosition: flag,
      distanceFromExpected: 1,
      detectedMistakeType: "oneStepCountingError",
      matchQuality: "close",
      teacherExplanation: PREDICTION_TEACHER_COPY.oneStepCountingError,
      recommendation: RECOMMENDATIONS.oneStepCountingError,
      misconceptionMatches,
      givenCommands,
      predictionComplete: false,
    };
  }

  const best = candidates[0];
  if (best && best.distance <= 1) {
    const matchQuality: MatchQuality = "possible";
    const score = scoreFromDiagnosis(best.mistake, matchQuality, best.distance);
    return {
      available: true,
      isCorrect: false,
      score,
      level: masteryFromScore(score),
      expectedFinalPosition: expected,
      studentFlagPosition: flag,
      distanceFromExpected: distCorrect,
      detectedMistakeType: best.mistake,
      matchQuality,
      teacherExplanation: PREDICTION_TEACHER_COPY[best.mistake],
      recommendation: RECOMMENDATIONS[best.mistake],
      misconceptionMatches,
      givenCommands,
      predictionComplete: false,
    };
  }

  const weakScore = clampScore(Math.max(10, 28 - distCorrect * 6));
  return {
    available: true,
    isCorrect: false,
    score: weakScore,
    level: masteryFromScore(weakScore),
    expectedFinalPosition: expected,
    studentFlagPosition: flag,
    distanceFromExpected: distCorrect,
    detectedMistakeType: "unclear",
    matchQuality: "weak",
    teacherExplanation: PREDICTION_TEACHER_COPY.unclear,
    recommendation: RECOMMENDATIONS.unclear,
    misconceptionMatches,
    givenCommands,
    predictionComplete: false,
  };
}

export function resolveGivenCommandsForFlagLevel(
  levelConfig: LevelGameplayConfig,
  levelType?: LevelType,
  attempt?: Pick<AttemptEvidenceInput, "finalCommand" | "initialCommand" | "commandEvents">
): RobotCommand[] {
  const fromGuided = resolveAttemptProgram({
    finalCommand: null,
    initialCommand: attempt?.initialCommand,
    levelConfig,
    levelType,
    commandEvents: [],
  });
  if (fromGuided.length > 0) return fromGuided as RobotCommand[];

  if (attempt) {
    const fromAttempt = resolveAttemptProgram({
      finalCommand: attempt.finalCommand,
      initialCommand: attempt.initialCommand,
      levelConfig,
      levelType,
      commandEvents: attempt.commandEvents,
    });
    if (fromAttempt.length > 0) return fromAttempt as RobotCommand[];
  }

  return [];
}

export function buildPredictionFromAttempt(params: {
  levelId: string;
  levelConfig: LevelGameplayConfig;
  levelType?: LevelType;
  attempt: AttemptEvidenceInput;
}): PredictionAnalysisResult {
  const { levelConfig, levelId, levelType, attempt } = params;
  const startAnchor = resolveRouteStartCell(levelConfig);
  const givenCommands = resolveGivenCommandsForFlagLevel(levelConfig, levelType, attempt);

  const flag = parseStudentFlagFromMistakes(attempt.mistakes);

  const obstacles = levelConfig.gridObjects
    .filter((o) => o.blocksRobot || o.objectType === "block")
    .map((o) => o.position);

  return analyzePrediction({
    startPosition: startAnchor.position,
    startDirection: startAnchor.facing,
    givenCommands,
    studentFlagPosition: flag,
    gridSize: { cols: GRID_COLS, rows: GRID_ROWS },
    obstacles,
  });
}

export function predictionResultLabel(result: PredictionAnalysisResult): string {
  if (!result.available) return "Needs practice";
  if (result.isCorrect) return "Correct";
  if (result.detectedMistakeType === "oneStepCountingError") return "Close";
  if (result.matchQuality === "strong" || result.matchQuality === "close") return "Close";
  return "Needs practice";
}

/** Teacher-facing label for pass/fail on flag placement (game outcome). */
export function flagPlacementOutcomeLabel(isCorrect: boolean): string {
  return isCorrect ? "Correct placement" : "Incorrect placement";
}

/** Short caption for the diagnostic % score (misconception match, not game pass). */
export function predictionDiagnosticCaption(result: PredictionAnalysisResult): string {
  if (result.isCorrect) {
    return "Student placed the flag on the cell where the robot would stop.";
  }
  if (result.matchQuality === "strong" || result.matchQuality === "close") {
    return `Diagnostic ${result.score}%: the flag matches a likely mistake pattern (${predictionResultLabel(result).toLowerCase()}), not the correct cell.`;
  }
  return `Diagnostic ${result.score}%: flag was wrong and does not match a clear pattern — focus on step-by-step prediction.`;
}
