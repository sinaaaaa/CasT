/**
 * Drag Action Blocks / path-building assessment — route diagnosis from scratch.
 */

import type { LevelGameplayConfig } from "@/lib/level-config";
import { LevelType } from "@prisma/client";
import {
  clampScore,
  masteryFromScore,
  resolveRouteMapAnchors,
  resolveRouteWinCell,
} from "@/lib/assessment/assessmentConfig";
import type { GridObjectMarker } from "@/lib/assessment/assessmentConfig";
import type {
  AttemptEvidenceInput,
  MasteryBand,
  PathState,
  RobotCommand,
  SimulationResult,
  TaskAssessmentConfig,
  Vec2,
} from "@/lib/assessment/assessmentTypes";
import {
  alignProgramsForDiff,
  buildFirstMistakeMessages,
  classifyStepCommandMismatch,
  resolveFirstMistakeStep,
} from "@/lib/assessment/program-diff-visual";
import {
  interpretSemanticIssue,
  defaultSemanticInterpretation,
  type SemanticInterpretation,
} from "@/lib/assessment/semanticInterpretation";
import {
  chooseComparisonTarget,
  type ComparisonTargetType,
} from "@/lib/assessment/comparison-target";
import {
  analyzeGoalRelationship,
  findOptimalRoute,
  programStopsOnGoalStrict,
  resolveStrictGoalPosition,
  simulateProgram,
  taskRequiredFinalFacing,
} from "@/lib/assessment/routeAnalysis";
import { resolveAttemptProgram } from "@/lib/assessment/resolve-program";
import {
  analyzeObstacleCollisions,
  type ObstacleCollisionReport,
} from "@/lib/assessment/obstacleAnalysis";
import type { CommandToken } from "@/lib/command-icons";

export type PathMistakeType =
  | "wrongRotation"
  | "turnInsteadOfForward"
  | "forwardInsteadOfTurn"
  | "extraForward"
  | "missingForward"
  | "wrongCommandOrder"
  | "goalOrderError"
  | "skippedSubgoal"
  | "obstacleCollision"
  | "boundaryCollision"
  | "oppositeDirection"
  | "unclearRoute"
  | "none";

export type RouteQualityLevel =
  | "Exact Route"
  | "Valid Route"
  | "Valid but Extra Commands"
  | "Close Route"
  | "Partial Route"
  | "Incorrect Route"
  | "Goal Order Error"
  | "Obstacle Collision";

export type PathStageAnalysis = {
  stage: number;
  from: string;
  to: string;
  reached: boolean;
  firstMistakeStep: number | null;
  exactIssue: string | null;
};

export type PathBuildingAnalysisResult = {
  available: boolean;
  reachedGoal: boolean;
  reachedAllGoals: boolean;
  correctGoalOrder: boolean;
  stoppedOnFinalGoal: boolean;
  passedThroughGoal: boolean;
  finalPosition: Vec2;
  finalDirection: Vec2;
  studentCommands: CommandToken[];
  studentPath: Vec2[];
  studentPathStates?: PathState[];
  closestValidRoute: CommandToken[];
  closestValidPath: Vec2[];
  shortestRoute: CommandToken[];
  shortestPath: Vec2[];
  selectedReferenceRoute: CommandToken[];
  selectedReferencePath: Vec2[];
  comparisonUsed: ComparisonTargetType;
  comparisonReason: string;
  comparisonClarityScore: number;
  firstMistakeStep: number | null;
  firstMistakeLabel: string | null;
  exactIssue: string;
  mistakeType: PathMistakeType;
  robotOutcome: string;
  likelyUnderstanding: string;
  recommendation: string;
  whatHappened: string;
  commandCount: number;
  shortestCommandCount: number;
  extraCommands: number;
  collisions: number;
  obstacleAvoided: boolean;
  stageAnalysis: PathStageAnalysis[];
  routeQuality: RouteQualityLevel;
  score: number;
  level: MasteryBand;
  routeStartPosition: Vec2;
  routeGoalPosition: Vec2;
  goalLabel: string;
  studentEndPosition: Vec2 | null;
  objectMarkers: GridObjectMarker[];
  hasMultipleGoals: boolean;
  hasObstacle: boolean;
  compareWithOptimalRoute: boolean;
  teacherExplanation: string;
  obstacleCollision: boolean;
  obstacleCollisionCount: number;
  obstacleCollisionSteps: number[];
  attemptedObstacleCells: Vec2[];
  firstObstacleMistakeStep: number | null;
  programDisplayMissingSummary: string | null;
  semanticIssue: SemanticInterpretation;
};

const COMMAND_LABEL: Record<CommandToken, string> = {
  forward: "Forward",
  backward: "Backward",
  "turn left": "Turn Left",
  "turn right": "Turn Right",
};

function toTokens(cmds: RobotCommand[]): CommandToken[] {
  return cmds.filter((c): c is CommandToken =>
    ["forward", "backward", "turn left", "turn right"].includes(c)
  );
}

function programSimilarity(a: CommandToken[], b: CommandToken[]): number {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const lcs = dp[n][m];
  return lcs / Math.max(n, m, 1);
}

function pickClosestValidRoute(
  student: CommandToken[],
  candidates: { commands: RobotCommand[]; path: Vec2[] }[]
): { commands: CommandToken[]; path: Vec2[] } {
  if (candidates.length === 0) return { commands: [], path: [] };
  let best = candidates[0];
  let bestSim = -1;
  for (const c of candidates) {
    const tokens = toTokens(c.commands);
    const sim = programSimilarity(student, tokens);
    if (sim > bestSim) {
      bestSim = sim;
      best = c;
    }
  }
  return { commands: toTokens(best.commands), path: best.path };
}

function collectValidRoutes(task: TaskAssessmentConfig): {
  shortest: { commands: CommandToken[]; path: Vec2[] };
  alternatives: { commands: CommandToken[]; path: Vec2[] }[];
} {
  const optimal = findOptimalRoute(task);
  const shortest = {
    commands: toTokens(optimal.commands),
    path: optimal.path,
  };
  const alternatives = (optimal.alternativeRoutes ?? []).map((a) => ({
    commands: toTokens(a.commands),
    path: a.path,
  }));
  return { shortest, alternatives };
}

function detectMistake(params: {
  student: CommandToken[];
  closest: CommandToken[];
  studentSim: SimulationResult;
  closestSim: SimulationResult;
  task: TaskAssessmentConfig;
  firstMistakeStep: number | null;
  goalRel: ReturnType<typeof analyzeGoalRelationship>;
  orderedGoalIds: string[];
}): {
  mistakeType: PathMistakeType;
  exactIssue: string;
  robotOutcome: string;
} {
  const {
    student,
    closest,
    studentSim,
    closestSim,
    task,
    firstMistakeStep,
    goalRel,
    orderedGoalIds,
  } = params;

  if (studentSim.obstacleCollisionCount && studentSim.obstacleCollisionCount > 0) {
    const step = studentSim.firstObstacleMistakeStep ?? firstMistakeStep ?? 1;
    return {
      mistakeType: "obstacleCollision",
      exactIssue: `Student tried to move through the obstacle at Step ${step}.`,
      robotOutcome: "This command tried to move the robot into a blocked space.",
    };
  }

  if (studentSim.collisions.length > 0) {
    const boundary = studentSim.steps.some(
      (s) => s.collision && !s.obstacleCollision
    );
    if (boundary) {
      return {
        mistakeType: "boundaryCollision",
        exactIssue: "Student moved the robot outside the grid.",
        robotOutcome: "Robot hit the edge of the grid.",
      };
    }
  }

  const ordered = [...task.goals].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  if (ordered.length >= 2 && task.requiredGoalOrder) {
    const reached = studentSim.reachedGoals;
    if (reached.length >= 2 && reached[0] !== ordered[0]?.id) {
      return {
        mistakeType: "goalOrderError",
        exactIssue: "Student reached the goals in the wrong order.",
        robotOutcome: `Robot visited ${ordered.find((g) => g.id === reached[0])?.label ?? "second goal"} before the first goal.`,
      };
    }
    if (
      reached.includes(ordered[ordered.length - 1]?.id ?? "") &&
      !reached.includes(ordered[0]?.id ?? "")
    ) {
      return {
        mistakeType: "skippedSubgoal",
        exactIssue: "Student skipped the first required goal.",
        robotOutcome: "Robot reached the final goal without visiting the first goal.",
      };
    }
  }

  const diff = alignProgramsForDiff(closest, student, {
    markDivergenceFromStep: firstMistakeStep,
  });
  const addedSlots = diff.slots.filter((s) => s.status === "added");
  const missingSlots = diff.slots.filter((s) => s.status === "missing");
  const changedSlots = diff.slots.filter((s) => s.status === "changed");

  if (goalRel.goalTouched && !goalRel.finalStoppedOnGoal && goalRel.movedAfterGoal) {
    const extraStep = goalRel.firstExtraAfterGoalStep ?? firstMistakeStep ?? 1;
    const beyond = goalRel.passedGoalDistance || goalRel.distanceFromGoal;
    return {
      mistakeType: "extraForward",
      exactIssue: "Program continued after the robot reached the goal.",
      robotOutcome:
        beyond === 1
          ? "Robot passed the goal by 1 cell."
          : beyond > 0
            ? `Robot passed the goal and stopped ${beyond} square(s) beyond it.`
            : "Robot passed the goal but did not stop on it.",
    };
  }

  const step = firstMistakeStep ?? 1;
  if (
    firstMistakeStep != null &&
    firstMistakeStep <= student.length &&
    firstMistakeStep <= closest.length
  ) {
    const cmd = student[firstMistakeStep - 1];
    const ref = closest[firstMistakeStep - 1];
    if (cmd && ref) {
      const mismatch = classifyStepCommandMismatch(cmd, ref);
      if (mismatch === "wrong_turn") {
        return {
          mistakeType: "wrongRotation",
          exactIssue: `Student turned the wrong direction at Step ${firstMistakeStep}.`,
          robotOutcome: `Student used ${COMMAND_LABEL[cmd]} instead of ${COMMAND_LABEL[ref]}.`,
        };
      }
      if (mismatch === "turn_instead_of_forward") {
        return {
          mistakeType: "turnInsteadOfForward",
          exactIssue: `Student used ${COMMAND_LABEL[cmd]} at Step ${firstMistakeStep} when ${COMMAND_LABEL[ref]} was needed.`,
          robotOutcome: `Robot needed to move forward, but the student turned instead.`,
        };
      }
      if (mismatch === "forward_instead_of_turn") {
        return {
          mistakeType: "forwardInsteadOfTurn",
          exactIssue: `Student used ${COMMAND_LABEL[cmd]} at Step ${firstMistakeStep} when ${COMMAND_LABEL[ref]} was needed.`,
          robotOutcome: `Robot needed to turn, but the student moved forward instead.`,
        };
      }
    }
  }

  if (!goalRel.goalTouched && (goalRel.stoppedBeforeGoal || goalRel.undershotGoal)) {
    const missing = missingSlots.filter((s) => s.command === "forward").length;
    return {
      mistakeType: "missingForward",
      exactIssue:
        missing >= 1
          ? `Student needed ${missing} more Forward command${missing === 1 ? "" : "s"} to reach the goal.`
          : "Student stopped before the goal.",
      robotOutcome: `Robot stopped ${goalRel.distanceFromGoal} step(s) before the goal.`,
    };
  }

  for (const ch of changedSlots) {
    if (ch.from && ch.to) {
      const isTurn =
        (ch.from === "turn left" || ch.from === "turn right") &&
        (ch.to === "turn left" || ch.to === "turn right");
      if (isTurn) {
        return {
          mistakeType: "wrongRotation",
          exactIssue: `Student turned the wrong direction at Step ${step}.`,
          robotOutcome: `Student used ${COMMAND_LABEL[ch.to]} instead of ${COMMAND_LABEL[ch.from]}.`,
        };
      }
    }
  }

  if (
    diff.changedCount > 0 &&
    diff.addedCount === 0 &&
    diff.removedCount === 0 &&
    student.length === closest.length
  ) {
    return {
      mistakeType: "wrongCommandOrder",
      exactIssue: "Student used the needed commands but placed one command in the wrong order.",
      robotOutcome: "Robot ended on the wrong cell.",
    };
  }

  const addedTurns = addedSlots.filter(
    (s) => s.command === "turn left" || s.command === "turn right"
  ).length;
  const removedForward = missingSlots.filter((s) => s.command === "forward").length;
  if (addedTurns > 0 && removedForward === 0 && closest.length > 0) {
    const closestTurn = closest.filter(
      (c) => c === "turn left" || c === "turn right"
    ).length;
    if (addedTurns >= closestTurn) {
      return {
        mistakeType: "turnInsteadOfForward",
        exactIssue: `Student turned at Step ${step} when the robot needed to move forward.`,
        robotOutcome: "Robot did not move toward the goal on that step.",
      };
    }
  }

  if (missingSlots.some((s) => s.command === "turn left" || s.command === "turn right")) {
    return {
      mistakeType: "forwardInsteadOfTurn",
      exactIssue: `Student moved forward at Step ${step} when the robot needed to turn.`,
      robotOutcome: "Robot moved in the wrong direction for that turn.",
    };
  }

  if (firstMistakeStep != null && studentSim.path.length > closestSim.path.length) {
    return {
      mistakeType: "oppositeDirection",
      exactIssue: `Student moved away from the goal at Step ${step}.`,
      robotOutcome: "Robot path turned away from the working route.",
    };
  }

  if (!programStopsOnGoalStrict(task, studentSim)) {
    return {
      mistakeType: "unclearRoute",
      exactIssue: "The route does not match a common mistake pattern.",
      robotOutcome: "Robot did not finish correctly on the goal.",
    };
  }

  return {
    mistakeType: "none",
    exactIssue: "Student used a valid route.",
    robotOutcome: "Robot stopped on the goal.",
  };
}

function resolveRouteQuality(params: {
  success: boolean;
  student: CommandToken[];
  shortest: CommandToken[];
  extraCommands: number;
  mistakeType: PathMistakeType;
  correctGoalOrder: boolean;
  reachedAllGoals: boolean;
  goalsReachedCount: number;
  totalGoals: number;
}): RouteQualityLevel {
  const { success, student, shortest, extraCommands, mistakeType, correctGoalOrder } =
    params;

  if (mistakeType === "obstacleCollision") return "Obstacle Collision";
  if (mistakeType === "goalOrderError" || mistakeType === "skippedSubgoal") {
    return "Goal Order Error";
  }
  if (!correctGoalOrder && params.reachedAllGoals) return "Goal Order Error";

  if (success) {
    if (
      programsEqual(student, shortest) &&
      student.length === shortest.length
    ) {
      return "Exact Route";
    }
    if (extraCommands > 0 || student.length > shortest.length) {
      return "Valid but Extra Commands";
    }
    return "Valid Route";
  }

  if (
    mistakeType === "extraForward" ||
    mistakeType === "missingForward" ||
    mistakeType === "wrongRotation" ||
    mistakeType === "wrongCommandOrder"
  ) {
    return "Close Route";
  }

  if (mistakeType === "turnInsteadOfForward" || mistakeType === "forwardInsteadOfTurn") {
    return "Close Route";
  }

  if (
    params.goalsReachedCount > 0 &&
    params.goalsReachedCount < Math.max(1, params.totalGoals) &&
    params.mistakeType !== "goalOrderError"
  ) {
    return "Partial Route";
  }

  return "Incorrect Route";
}

function programsEqual(a: CommandToken[], b: CommandToken[]): boolean {
  return a.length === b.length && a.every((c, i) => c === b[i]);
}

function scoreForQuality(
  quality: RouteQualityLevel,
  progress: number
): number {
  switch (quality) {
    case "Exact Route":
      return clampScore(95 + progress * 5);
    case "Valid Route":
      return clampScore(88 + progress * 7);
    case "Valid but Extra Commands":
      return clampScore(72 + progress * 10);
    case "Close Route":
      return clampScore(55 + progress * 15);
    case "Partial Route":
      return clampScore(38 + progress * 17);
    case "Goal Order Error":
      return clampScore(35 + progress * 20);
    case "Obstacle Collision":
      return clampScore(25 + progress * 15);
    case "Incorrect Route":
    default:
      return clampScore(12 + progress * 18);
  }
}

function buildStageAnalysis(
  task: TaskAssessmentConfig,
  studentSim: SimulationResult
): PathStageAnalysis[] {
  const ordered = [...task.goals].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  if (ordered.length < 2) return [];

  const stages: PathStageAnalysis[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const g = ordered[i];
    const fromLabel = i === 0 ? "start" : ordered[i - 1].label;
    const reached = studentSim.reachedGoals.includes(g.id);
    stages.push({
      stage: i + 1,
      from: fromLabel,
      to: g.label,
      reached,
      firstMistakeStep: reached ? null : null,
      exactIssue: reached ? null : `Did not reach ${g.label}`,
    });
  }
  return stages;
}

function buildWhatHappened(
  task: TaskAssessmentConfig,
  studentSim: SimulationResult,
  success: boolean,
  obstacle: ObstacleCollisionReport
): string {
  if (obstacle.obstacleCollision && obstacle.firstObstacleMistakeStep != null) {
    return `Student tried to move through the obstacle at Step ${obstacle.firstObstacleMistakeStep}.`;
  }
  if (success && obstacle.obstacleAvoided && task.hasObstacle) {
    return "Student planned around the obstacle and reached the goal.";
  }
  const ordered = [...task.goals].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  const win = resolveRouteWinCell(task.levelConfig);
  if (ordered.length >= 2) {
    const r1 = studentSim.reachedGoals.includes(ordered[0]?.id ?? "");
    const r2 = studentSim.reachedGoals.includes(ordered[1]?.id ?? "");
    if (r1 && r2 && success) {
      return `Robot visited ${ordered[0].label} and ${ordered[1].label} in the correct order.`;
    }
    if (r2 && !r1) {
      return `Robot reached ${ordered[1].label} before ${ordered[0].label}.`;
    }
    if (r1 && !r2) {
      return `Robot reached ${ordered[0].label} but did not reach ${ordered[1].label}.`;
    }
    return `Robot did not complete both goals.`;
  }
  if (success && win) {
    return `Robot stopped on the ${win.label}.`;
  }
  if (win) {
    return `Robot did not stop on the ${win.label}.`;
  }
  return "Robot did not complete the path.";
}

const RECOMMENDATIONS: Partial<Record<PathMistakeType, string>> = {
  wrongRotation: "Practice left and right turns on a short path with one turn.",
  turnInsteadOfForward: "Practice counting forward steps before adding turns.",
  forwardInsteadOfTurn: "Practice turning at corners before moving forward again.",
  extraForward: "Practice checking where the robot stops after each command.",
  missingForward: "Practice adding the last forward needed to reach the goal.",
  wrongCommandOrder: "Practice putting turns before or after the forwards that need them.",
  goalOrderError: "Practice visiting the first goal before the second goal.",
  skippedSubgoal: "Practice stopping at the first goal before going to the second.",
  obstacleCollision: "Practice planning a path around blocked cells.",
  boundaryCollision: "Practice staying inside the grid when building a route.",
  unclearRoute: "Try a one-goal path level with only forward and turn commands.",
};

export function analyzePathBuilding(input: {
  task: TaskAssessmentConfig;
  studentCommands: CommandToken[];
}): PathBuildingAnalysisResult {
  const { task, studentCommands } = input;
  const student = [...studentCommands];
  const empty: PathBuildingAnalysisResult = {
    available: false,
    reachedGoal: false,
    reachedAllGoals: false,
    correctGoalOrder: false,
    stoppedOnFinalGoal: false,
    passedThroughGoal: false,
    finalPosition: { ...task.levelConfig.robotStartPosition },
    finalDirection: { x: 0, y: 1 },
    studentCommands: student,
    studentPath: [],
    closestValidRoute: [],
    closestValidPath: [],
    shortestRoute: [],
    shortestPath: [],
    selectedReferenceRoute: [],
    selectedReferencePath: [],
    comparisonUsed: "shortestValidRoute",
    comparisonReason: "",
    comparisonClarityScore: 0,
    firstMistakeStep: null,
    firstMistakeLabel: null,
    exactIssue: "No commands recorded.",
    mistakeType: "unclearRoute",
    robotOutcome: "No program to simulate.",
    likelyUnderstanding: "No route was built.",
    recommendation: "Ask the student to drag blocks and press RUN.",
    whatHappened: "No commands were recorded.",
    commandCount: 0,
    shortestCommandCount: 0,
    extraCommands: 0,
    collisions: 0,
    obstacleAvoided: true,
    obstacleCollision: false,
    obstacleCollisionCount: 0,
    obstacleCollisionSteps: [],
    attemptedObstacleCells: [],
    firstObstacleMistakeStep: null,
    stageAnalysis: [],
    routeQuality: "Incorrect Route",
    score: 0,
    level: masteryFromScore(0),
    routeStartPosition: { x: 0, y: 0 },
    routeGoalPosition: { x: 0, y: 0 },
    goalLabel: "goal",
    studentEndPosition: null,
    objectMarkers: [],
    hasMultipleGoals: task.goals.length >= 2,
    hasObstacle: task.hasObstacle,
    compareWithOptimalRoute: task.compareWithOptimalRoute,
    teacherExplanation: "No program recorded.",
    programDisplayMissingSummary: null,
    semanticIssue: defaultSemanticInterpretation(),
  };

  if (student.length === 0) return empty;

  const studentSim = simulateProgram(task, student);
  const { shortest, alternatives } = collectValidRoutes(task);
  const candidates = [
    { commands: shortest.commands as RobotCommand[], path: shortest.path },
    ...alternatives.map((a) => ({
      commands: a.commands as RobotCommand[],
      path: a.path,
    })),
  ];
  const closest = pickClosestValidRoute(student, candidates);
  const closestSim = simulateProgram(task, closest.commands);

  const comparison = chooseComparisonTarget({
    studentProgram: student,
    shortestValidRoute: shortest.commands,
    closestValidRoute: closest.commands,
    alternateValidRoutes: alternatives.map((a) => a.commands),
    taskSettings: {
      compareWithOptimalRoute: task.compareWithOptimalRoute,
      hasObstacle: task.hasObstacle,
      hasMultipleGoals: task.goals.length >= 2,
    },
  });

  const selectedCommands = comparison.selectedTargetProgram;
  const selectedSim = simulateProgram(task, selectedCommands);
  const selectedPath =
    selectedSim.path.length > 1 ? selectedSim.path : closest.path;

  const success = programStopsOnGoalStrict(task, studentSim);
  const goalPos = resolveStrictGoalPosition(task);
  const goalRel = goalPos
    ? analyzeGoalRelationship({
        pathVisited: studentSim.path,
        finalPosition: studentSim.finalPosition,
        goalPosition: goalPos,
        finalDirection: studentSim.finalDirection,
        requiredFinalDirection: taskRequiredFinalFacing(task),
      })
    : {
        stoppedOnGoal: false,
        passedThroughGoal: false,
        stoppedBeforeGoal: true,
        overshotGoal: false,
        undershotGoal: true,
        distanceFromGoal: 99,
        finalDirectionCorrect: true,
        goalTouched: false,
        firstGoalTouchStep: null,
        finalStoppedOnGoal: false,
        movedAfterGoal: false,
        firstExtraAfterGoalStep: null,
        passedGoalDistance: 0,
      };

  const obstacleReport = analyzeObstacleCollisions(studentSim, {
    hasObstacle: task.hasObstacle,
  });

  const goalLabel = resolveRouteWinCell(task.levelConfig)?.label ?? "goal";

  const referencePath =
    selectedPath.length > 1 ? selectedPath : shortest.path;
  let firstMistakeStep = resolveFirstMistakeStep({
    student,
    reference: selectedCommands,
    studentPath: studentSim.path,
    referencePath,
    firstObstacleMistakeStep: obstacleReport.firstObstacleMistakeStep,
  });

  const diffAlign = alignProgramsForDiff(selectedCommands, student, {
    markDivergenceFromStep: firstMistakeStep,
  });
  const forwardMissingCount = diffAlign.slots.filter(
    (s) => s.status === "missing" && s.command === "forward"
  ).length;
  const forwardExtraCount = diffAlign.slots.filter(
    (s) => s.status === "added" && s.command === "forward"
  ).length;

  const semanticIssue = interpretSemanticIssue({
    goalRel,
    studentSim,
    goalLabel,
    firstObstacleStep: obstacleReport.firstObstacleMistakeStep,
    firstCommandMistakeStep: firstMistakeStep,
    forwardMissingCount,
    forwardExtraCount,
    studentCmdAtFirstMistake:
      firstMistakeStep != null ? student[firstMistakeStep - 1] : undefined,
    referenceCmdAtFirstMistake:
      firstMistakeStep != null ? selectedCommands[firstMistakeStep - 1] : undefined,
  });

  if (semanticIssue.firstIncorrectStep != null) {
    firstMistakeStep = semanticIssue.firstIncorrectStep;
  }

  const mistakeMessages = buildFirstMistakeMessages(firstMistakeStep, {
    passedGoal: semanticIssue.issueType === "passed_goal",
    suppressMissingAfterStep: semanticIssue.suppressMissingSummary,
  });

  const ordered = [...task.goals].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  const reachedAllGoals =
    ordered.length === 0
      ? success
      : ordered.every((g) => studentSim.reachedGoals.includes(g.id));

  const diagnosis = detectMistake({
    student,
    closest: selectedCommands,
    studentSim,
    closestSim: selectedSim,
    task,
    firstMistakeStep,
    goalRel,
    orderedGoalIds: ordered.map((g) => g.id),
  });

  const exactIssue =
    semanticIssue.issueType !== "unknown" && semanticIssue.issueType !== "correct"
      ? semanticIssue.teacherMessage
      : diagnosis.exactIssue;
  const robotOutcome =
    semanticIssue.issueType !== "unknown" && semanticIssue.issueType !== "correct"
      ? semanticIssue.robotOutcomeMessage
      : diagnosis.robotOutcome;

  const extraCommands = Math.max(0, student.length - shortest.commands.length);
  const routeQuality = resolveRouteQuality({
    success,
    student,
    shortest: shortest.commands,
    extraCommands,
    mistakeType: diagnosis.mistakeType,
    correctGoalOrder: studentSim.correctGoalOrder,
    reachedAllGoals,
    goalsReachedCount: studentSim.reachedGoals.length,
    totalGoals: Math.max(ordered.length, 1),
  });

  const progress =
    ordered.length > 0
      ? studentSim.reachedGoals.length / ordered.length
      : success
        ? 1
        : 0;
  const score = scoreForQuality(routeQuality, progress);

  const anchors = resolveRouteMapAnchors(task.levelConfig, {
    studentEnd: studentSim.finalPosition,
  });

  // When the robot reached the goal but kept moving (passed goal / extra forward),
  // compare against the student's OWN route trimmed to the goal instead of an unrelated
  // alternate route. This makes "Step N reached the goal, the rest is extra" obvious.
  let selectedReferenceRoute = selectedCommands;
  let selectedReferencePath = selectedPath;
  let comparisonUsedType = comparison.selectedTargetType;
  let comparisonReasonText = comparison.reasonForSelection;

  const passedGoalExtra =
    goalRel.goalTouched &&
    !goalRel.finalStoppedOnGoal &&
    goalRel.movedAfterGoal &&
    goalRel.firstGoalTouchStep != null &&
    goalRel.firstGoalTouchStep > 0;

  if (passedGoalExtra) {
    const routeToGoal = student.slice(0, goalRel.firstGoalTouchStep!);
    const routeToGoalSim = simulateProgram(task, routeToGoal);
    if (routeToGoal.length > 0 && programStopsOnGoalStrict(task, routeToGoalSim)) {
      const extraCount = student.length - routeToGoal.length;
      selectedReferenceRoute = routeToGoal;
      selectedReferencePath =
        routeToGoalSim.path.length > 1 ? routeToGoalSim.path : selectedPath;
      comparisonUsedType = "studentRouteToGoal";
      comparisonReasonText =
        extraCount === 1
          ? `Robot reached the ${goalLabel} at Step ${routeToGoal.length}. The command after it is extra and should be removed.`
          : `Robot reached the ${goalLabel} at Step ${routeToGoal.length}. The ${extraCount} commands after it are extra and should be removed.`;
    }
  }

  const whatHappened = buildWhatHappened(task, studentSim, success, obstacleReport);
  const likelyUnderstanding =
    routeQuality === "Exact Route" || routeQuality === "Valid Route"
      ? obstacleReport.obstacleAvoided && task.hasObstacle
        ? "Student planned around the obstacle successfully."
        : "Student built a working path to the goal."
      : obstacleReport.obstacleCollision
        ? exactIssue
        : routeQuality === "Valid but Extra Commands" && obstacleReport.obstacleAvoided
          ? "Student avoided the obstacle but used extra commands."
          : exactIssue;

  return {
    available: true,
    reachedGoal: success,
    reachedAllGoals,
    correctGoalOrder: studentSim.correctGoalOrder,
    stoppedOnFinalGoal: goalRel.stoppedOnGoal,
    passedThroughGoal: goalRel.passedThroughGoal,
    finalPosition: studentSim.finalPosition,
    finalDirection: studentSim.finalDirection,
    studentCommands: student,
    studentPath: studentSim.path,
    studentPathStates: studentSim.pathStates,
    closestValidRoute: closest.commands,
    closestValidPath: closestSim.path,
    shortestRoute: shortest.commands,
    shortestPath: shortest.path,
    selectedReferenceRoute,
    selectedReferencePath,
    comparisonUsed: comparisonUsedType,
    comparisonReason: comparisonReasonText,
    comparisonClarityScore: comparison.diagnosisClarityScore,
    firstMistakeStep,
    firstMistakeLabel: mistakeMessages?.label ?? null,
    exactIssue,
    mistakeType: diagnosis.mistakeType,
    robotOutcome,
    likelyUnderstanding,
    recommendation:
      RECOMMENDATIONS[diagnosis.mistakeType] ??
      (success
        ? "Try a path with two goals or an obstacle."
        : "Try a shorter one-goal path level."),
    whatHappened,
    commandCount: student.length,
    shortestCommandCount: shortest.commands.length,
    extraCommands,
    collisions: studentSim.collisions.length,
    obstacleAvoided: obstacleReport.obstacleAvoided,
    obstacleCollision: obstacleReport.obstacleCollision,
    obstacleCollisionCount: obstacleReport.obstacleCollisionCount,
    obstacleCollisionSteps: obstacleReport.obstacleCollisionSteps,
    attemptedObstacleCells: obstacleReport.attemptedObstacleCells,
    firstObstacleMistakeStep: obstacleReport.firstObstacleMistakeStep,
    programDisplayMissingSummary: null,
    semanticIssue,
    stageAnalysis: buildStageAnalysis(task, studentSim),
    routeQuality,
    score,
    level: masteryFromScore(score),
    routeStartPosition: anchors.routeStartPosition,
    routeGoalPosition: anchors.routeGoalPosition,
    goalLabel: anchors.goalLabel,
    studentEndPosition: anchors.studentEndPosition,
    objectMarkers: anchors.objects,
    hasMultipleGoals: task.goals.length >= 2,
    hasObstacle: task.hasObstacle,
    compareWithOptimalRoute: task.compareWithOptimalRoute,
    teacherExplanation: likelyUnderstanding,
  };
}

export function buildPathBuildingFromAttempt(params: {
  levelConfig: LevelGameplayConfig;
  levelType?: LevelType;
  attempt: AttemptEvidenceInput;
  task: TaskAssessmentConfig;
}): PathBuildingAnalysisResult {
  const studentCommands = resolveAttemptProgram({
    finalCommand: params.attempt.finalCommand,
    initialCommand: params.attempt.initialCommand,
    levelConfig: params.levelConfig,
    levelType: params.levelType,
    commandEvents: params.attempt.commandEvents,
    commandHistory: params.attempt.commandHistory,
  }) as CommandToken[];

  return analyzePathBuilding({
    task: params.task,
    studentCommands,
  });
}
