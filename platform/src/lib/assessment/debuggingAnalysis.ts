/**
 * Debugging (fix broken program) assessment — repair process, not route-vs-best as primary.
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
import { analyzeObstacleCollisions } from "@/lib/assessment/obstacleAnalysis";
import {
  findOptimalRoute,
  programStopsOnGoalStrict,
  simulateProgram,
} from "@/lib/assessment/routeAnalysis";
import {
  analyzeEditStarterDebugging,
  buildWorkingFixOptions,
  type DetectedMistakeType,
  type EditStarterDebuggingResult,
  type MatchQuality,
  type RepairStatus,
  type WorkingFixOption,
} from "@/lib/assessment/editStarterDebuggingAnalysis";
import type { ComparisonTargetType } from "@/lib/assessment/comparison-target";
import {
  resolveAttemptProgram,
  resolveStarterProgram,
} from "@/lib/assessment/resolve-program";
import type { CommandToken } from "@/lib/command-icons";
import type { SemanticInterpretation } from "@/lib/assessment/semanticInterpretation";

export type DebuggingStrategy =
  | "minimal-fix"
  | "focused-fix"
  | "successful-rewrite"
  | "partial-fix"
  | "trial-and-error"
  | "incorrect-fix"
  | "no-change";

export type CommandEditKind = "added" | "removed" | "changed" | "reordered";

export type CommandEditDetail = {
  kind: CommandEditKind;
  label: string;
  position?: number;
  from?: CommandToken;
  to?: CommandToken;
};

export type { RepairStatus, WorkingFixOption, DetectedMistakeType, MatchQuality };

export type DebuggingAnalysisResult = {
  available: boolean;
  bugFixed: boolean;
  bugFixedStatus: "yes" | "partly" | "no";
  /** Teacher-facing detail for “Did it fix the bug?” (strict stop on goal). */
  bugFixedDetail: string;
  repairStatus: RepairStatus;
  exactIssue: string;
  robotOutcome: string;
  likelyMistake: string;
  preferredWorkingFix: WorkingFixOption | null;
  closestWorkingFix: WorkingFixOption | null;
  workingFixOptions: WorkingFixOption[];
  stoppedOnGoal: boolean;
  passedThroughGoal: boolean;
  stoppedBeforeGoal: boolean;
  overshotGoal: boolean;
  undershotGoal: boolean;
  distanceFromGoal: number;
  detectedMistakeType: DetectedMistakeType;
  matchQuality: MatchQuality;
  extraCommandsComparedToFix: CommandToken[];
  missingCommandsComparedToFix: CommandToken[];
  wrongCommandsComparedToFix: CommandToken[];
  wrongOrderComparedToFix: boolean;
  editStarterDiagnosis: EditStarterDebuggingResult | null;
  reachesGoalBeforeFix: boolean;
  reachesGoalAfterFix: boolean;
  originalProgram: CommandToken[];
  studentProgram: CommandToken[];
  correctProgram: CommandToken[];
  commandsAdded: CommandEditDetail[];
  commandsRemoved: CommandEditDetail[];
  commandsChanged: CommandEditDetail[];
  commandsReordered: boolean;
  editDistance: number;
  changedBugLocation: boolean;
  originalErrorRemains: boolean;
  unnecessaryChanges: boolean;
  minimalFix: boolean;
  debuggingStrategy: DebuggingStrategy;
  score: number;
  level: MasteryBand;
  whatStudentDid: string[];
  teacherExplanation: string;
  recommendation: string;
  /** Optional path details for collapsed “View path details”. */
  originalPath: Vec2[];
  studentPath: Vec2[];
  correctPath: Vec2[];
  optimalPath: Vec2[];
  showPathDetails: boolean;
  originalPathStates?: PathState[];
  studentPathStates?: PathState[];
  routeStartPosition: Vec2;
  routeGoalPosition: Vec2;
  goalLabel: string;
  studentEndPosition: Vec2 | null;
  objectMarkers: GridObjectMarker[];
  hasObstacle: boolean;
  obstacleCollision: boolean;
  obstacleCollisionCount: number;
  obstacleCollisionSteps: number[];
  attemptedObstacleCells: Vec2[];
  firstObstacleMistakeStep: number | null;
  obstacleAvoided: boolean;
  /** First mistake vs selected comparison route (command step, not path-only). */
  firstMistakeStep: number | null;
  semanticIssue: SemanticInterpretation | null;
  comparisonUsed: ComparisonTargetType;
  comparisonReason: string;
  comparisonClarityScore: number;
  selectedComparisonRoute: CommandToken[];
};

export type AnalyzeDebuggingTaskInput = {
  originalProgram: CommandToken[];
  studentProgram: CommandToken[];
  correctProgram?: CommandToken[];
  task: TaskAssessmentConfig;
  minimalFixExpected?: boolean;
  compareWithOptimalRoute?: boolean;
};

const EMPTY_OBSTACLE_FIELDS = {
  hasObstacle: false,
  obstacleCollision: false,
  obstacleCollisionCount: 0,
  obstacleCollisionSteps: [] as number[],
  attemptedObstacleCells: [] as Vec2[],
  firstObstacleMistakeStep: null as number | null,
  obstacleAvoided: true,
};

const COMMAND_LABEL: Record<CommandToken, string> = {
  forward: "Forward",
  backward: "Backward",
  "turn left": "Turn left",
  "turn right": "Turn right",
};

function positionPhrase(index: number, length: number): string {
  if (length <= 1) return "";
  if (index === 0) return " at the start";
  if (index >= length - 1) return " at the end";
  return ` at position ${index + 1}`;
}

function programsEqual(a: CommandToken[], b: CommandToken[]): boolean {
  return a.length === b.length && a.every((c, i) => c === b[i]);
}

/** LCS-based edit script between two command sequences. */
function diffPrograms(
  original: CommandToken[],
  student: CommandToken[]
): {
  added: CommandEditDetail[];
  removed: CommandEditDetail[];
  changed: CommandEditDetail[];
  reordered: boolean;
  editDistance: number;
} {
  const n = original.length;
  const m = student.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] =
        original[i - 1] === student[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const ops: { type: "keep" | "del" | "ins"; oi?: number; si?: number }[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && original[i - 1] === student[j - 1]) {
      ops.unshift({ type: "keep", oi: i - 1, si: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: "ins", si: j - 1 });
      j--;
    } else {
      ops.unshift({ type: "del", oi: i - 1 });
      i--;
    }
  }

  const added: CommandEditDetail[] = [];
  const removed: CommandEditDetail[] = [];
  const changed: CommandEditDetail[] = [];
  let editDistance = 0;

  for (let k = 0; k < ops.length; k++) {
    const op = ops[k];
    if (op.type === "ins") {
      const cmd = student[op.si!];
      added.push({
        kind: "added",
        label: `Added ${COMMAND_LABEL[cmd]}${positionPhrase(op.si!, student.length)}`,
        position: op.si,
        to: cmd,
      });
      editDistance++;
    } else if (op.type === "del") {
      const next = ops[k + 1];
      if (next?.type === "ins") {
        const from = original[op.oi!];
        const to = student[next.si!];
        changed.push({
          kind: "changed",
          label: `Changed ${COMMAND_LABEL[from]} → ${COMMAND_LABEL[to]}${positionPhrase(op.oi!, original.length)}`,
          position: op.oi,
          from,
          to,
        });
        editDistance++;
        k++;
      } else {
        const cmd = original[op.oi!];
        removed.push({
          kind: "removed",
          label: `Removed ${COMMAND_LABEL[cmd]}${positionPhrase(op.oi!, original.length)}`,
          position: op.oi,
          from: cmd,
        });
        editDistance++;
      }
    }
  }

  const sameMultiset =
    original.length === student.length &&
    !programsEqual(original, student) &&
    [...original].sort().join() === [...student].sort().join();
  const reordered = sameMultiset && added.length === 0 && removed.length === 0 && changed.length === 0;

  return { added, removed, changed, reordered, editDistance };
}

function simPasses(task: TaskAssessmentConfig, cmds: CommandToken[]): SimulationResult {
  return simulateProgram(task, cmds);
}

function inferCorrectProgram(
  task: TaskAssessmentConfig,
  original: CommandToken[],
  student: CommandToken[]
): CommandToken[] {
  const optimal = findOptimalRoute(task);
  if (optimal.reachable && optimal.commands.length > 0) {
    return optimal.commands.filter((c): c is CommandToken =>
      ["forward", "backward", "turn left", "turn right"].includes(c)
    );
  }
  if (student.length > 0 && simPasses(task, student).passed) return [...student];
  return [...original];
}

function minimalEditCount(original: CommandToken[], correct: CommandToken[]): number {
  return diffPrograms(original, correct).editDistance;
}

function classifyStrategy(params: {
  original: CommandToken[];
  student: CommandToken[];
  bugFixed: boolean;
  reachesGoalAfterFix: boolean;
  reachesGoalBeforeFix: boolean;
  editDistance: number;
  minimalDistance: number;
  unnecessaryChanges: boolean;
  goalProgressImproved: boolean;
}): DebuggingStrategy {
  const {
    original,
    student,
    bugFixed,
    reachesGoalAfterFix,
    reachesGoalBeforeFix,
    editDistance,
    minimalDistance,
    unnecessaryChanges,
    goalProgressImproved,
  } = params;

  if (programsEqual(original, student)) return "no-change";
  if (!reachesGoalAfterFix && !goalProgressImproved) return "incorrect-fix";
  if (!bugFixed && goalProgressImproved) return "partial-fix";
  if (unnecessaryChanges || (editDistance > minimalDistance + 2 && editDistance >= 3)) {
    return "trial-and-error";
  }
  if (bugFixed && editDistance <= minimalDistance && minimalDistance <= 1) {
    return "minimal-fix";
  }
  if (bugFixed && editDistance <= minimalDistance + 1) return "focused-fix";
  if (bugFixed && editDistance > Math.max(2, Math.floor(original.length * 0.5))) {
    return "successful-rewrite";
  }
  if (bugFixed) return "focused-fix";
  if (reachesGoalBeforeFix && !bugFixed) return "incorrect-fix";
  return "partial-fix";
}

const STRATEGY_LABEL: Record<DebuggingStrategy, string> = {
  "minimal-fix": "Minimal fix",
  "focused-fix": "Focused fix",
  "successful-rewrite": "Successful rewrite",
  "partial-fix": "Partial fix",
  "trial-and-error": "Trial and error",
  "incorrect-fix": "Incorrect fix",
  "no-change": "No change",
};

const STRATEGY_EXPLANATION: Record<DebuggingStrategy, string> = {
  "minimal-fix": "Student made a small, targeted change that fixed the program.",
  "focused-fix":
    "Student changed the part of the program that needed repair and the robot reached the goal.",
  "successful-rewrite":
    "Student created a working program, but changed much of the original sequence. They can solve the task but may need practice identifying the specific bug.",
  "partial-fix": "Student improved the program but it still did not fully reach the goal.",
  "trial-and-error":
    "Student made several changes that were not directly connected to the bug. This may show trial-and-error rather than focused debugging.",
  "incorrect-fix": "Student changed the program, but the robot still did not reach the goal.",
  "no-change": "Student submitted the original program without a meaningful repair.",
};

const STRATEGY_RECOMMENDATION: Record<DebuggingStrategy, string> = {
  "minimal-fix": "Try a debugging task with a wrong turn in the middle of the sequence.",
  "focused-fix":
    "Assign a debugging task with a missing command in the middle of the sequence.",
  "successful-rewrite":
    "Practice identifying the bug before changing the full program — try a one-command fix level.",
  "partial-fix": "Try a debugging task with one wrong turn before the goal.",
  "trial-and-error":
    "Practice identifying the bug before changing the full program.",
  "incorrect-fix": "Try a debugging task with a missing final movement command.",
  "no-change": "Encourage the student to edit the yellow strip and press RUN before finishing.",
};

function computeDebuggingScore(params: {
  bugFixed: boolean;
  reachesGoalAfterFix: boolean;
  goalCompletion: number;
  repairAppropriateness: number;
  editFocus: number;
  sequenceUnderstanding: number;
  minimalFixExpected: boolean;
  minimalFix: boolean;
}): number {
  const bugFixedScore = params.bugFixed
    ? 100
    : Math.round(params.goalCompletion * 0.6 + (params.reachesGoalAfterFix ? 25 : 0));

  let score =
    0.4 * bugFixedScore +
    0.25 * params.repairAppropriateness +
    0.2 * params.editFocus +
    0.15 * params.sequenceUnderstanding;

  if (params.minimalFixExpected && params.minimalFix && params.bugFixed) {
    score = Math.min(100, score + 5);
  }

  return clampScore(score);
}

export function analyzeDebuggingTask(input: AnalyzeDebuggingTaskInput): DebuggingAnalysisResult {
  const {
    originalProgram,
    studentProgram,
    task,
    minimalFixExpected = false,
    compareWithOptimalRoute = false,
  } = input;

  const original = [...originalProgram];
  const student = [...studentProgram];

  const emptyPaths = {
    originalPath: [] as Vec2[],
    studentPath: [] as Vec2[],
    correctPath: [] as Vec2[],
    optimalPath: [] as Vec2[],
    originalPathStates: [] as PathState[],
    studentPathStates: [] as PathState[],
  };

  if (original.length === 0) {
    const emptyCorrect: CommandToken[] = [];
    return {
      available: false,
      bugFixed: false,
      bugFixedStatus: "no",
      bugFixedDetail: "No — no starter program.",
      repairStatus: "noRepair",
      exactIssue: "No starter program was recorded.",
      robotOutcome: "Cannot simulate repair.",
      likelyMistake: "",
      preferredWorkingFix: null,
      closestWorkingFix: null,
      workingFixOptions: [],
      stoppedOnGoal: false,
      passedThroughGoal: false,
      stoppedBeforeGoal: false,
      overshotGoal: false,
      undershotGoal: false,
      distanceFromGoal: 0,
      detectedMistakeType: "unknown",
      matchQuality: "unclear",
      extraCommandsComparedToFix: [],
      missingCommandsComparedToFix: [],
      wrongCommandsComparedToFix: [],
      wrongOrderComparedToFix: false,
      editStarterDiagnosis: null,
      reachesGoalBeforeFix: false,
      reachesGoalAfterFix: false,
      originalProgram: original,
      studentProgram: student,
      correctProgram: emptyCorrect,
      commandsAdded: [],
      commandsRemoved: [],
      commandsChanged: [],
      commandsReordered: false,
      editDistance: 0,
      changedBugLocation: false,
      originalErrorRemains: false,
      unnecessaryChanges: false,
      minimalFix: false,
      debuggingStrategy: "no-change",
      score: 0,
      level: masteryFromScore(0),
      whatStudentDid: [],
      teacherExplanation: "No starter program was recorded for this debugging level.",
      recommendation: "Set guided actions or initial command on the level.",
      showPathDetails: false,
      routeStartPosition: { x: 0, y: 0 },
      routeGoalPosition: { x: 0, y: 0 },
      goalLabel: "goal",
      studentEndPosition: null,
      objectMarkers: [],
      ...emptyPaths,
      ...EMPTY_OBSTACLE_FIELDS,
      firstMistakeStep: null,
      semanticIssue: null,
      comparisonUsed: "shortestValidRoute",
      comparisonReason: "",
      comparisonClarityScore: 0,
      selectedComparisonRoute: [],
    };
  }

  const optimalRoute = findOptimalRoute(task);
  const workingFixOptions = buildWorkingFixOptions(task, original, optimalRoute);
  const origSim = simPasses(task, original);
  const studentSim = simPasses(task, student);

  const editDiagnosis = analyzeEditStarterDebugging({
    originalProgram: original,
    studentProgram: student,
    task,
    workingFixOptions,
    studentSim,
    originalSim: origSim,
  });

  const closestFix = editDiagnosis.closestWorkingFix;
  const preferredFix = editDiagnosis.preferredWorkingFix;
  const selectedRoute = editDiagnosis.selectedComparisonRoute;
  const correct =
    selectedRoute.length > 0
      ? [...selectedRoute]
      : closestFix && closestFix.commands.length > 0
        ? [...closestFix.commands]
        : preferredFix && preferredFix.commands.length > 0
          ? [...preferredFix.commands]
          : input.correctProgram && input.correctProgram.length > 0
            ? [...input.correctProgram]
            : optimalRoute.reachable && optimalRoute.commands.length > 0
              ? optimalRoute.commands.filter((c): c is CommandToken =>
                  ["forward", "backward", "turn left", "turn right"].includes(c)
                )
              : inferCorrectProgram(task, original, student);

  const correctSim = simPasses(task, correct);

  const reachesGoalBeforeFix = programStopsOnGoalStrict(task, origSim);
  const reachesGoalAfterFix = editDiagnosis.bugFixed;
  const bugFixed = editDiagnosis.bugFixed;

  const diff = diffPrograms(original, student);
  const minDist = minimalEditCount(original, correct);
  const unnecessaryChanges =
    diff.editDistance > minDist + 1 &&
    (diff.added.length + diff.removed.length + diff.changed.length) > minDist + 1;

  const changedBugLocation = diff.editDistance > 0 && !programsEqual(original, student);
  const originalErrorRemains =
    !bugFixed && programsEqual(original, student) && !reachesGoalBeforeFix;

  const minimalFix = bugFixed && diff.editDistance <= minDist && minDist <= 1;

  const goalProgressImproved =
    studentSim.goalCompletion > origSim.goalCompletion + 5 ||
    (studentSim.path.length > origSim.path.length && !reachesGoalBeforeFix);

  const debuggingStrategy = classifyStrategy({
    original,
    student,
    bugFixed,
    reachesGoalAfterFix,
    reachesGoalBeforeFix,
    editDistance: diff.editDistance,
    minimalDistance: minDist,
    unnecessaryChanges,
    goalProgressImproved,
  });

  const repairAppropriateness = bugFixed
    ? clampScore(100 - (unnecessaryChanges ? 35 : 0) - (originalErrorRemains ? 50 : 0))
    : goalProgressImproved
      ? 55
      : changedBugLocation
        ? 35
        : 15;

  const editFocus = clampScore(
    100 -
      Math.max(0, diff.editDistance - minDist) * 18 -
      (unnecessaryChanges ? 25 : 0)
  );

  const sequenceUnderstanding = clampScore(
    (studentSim.correctGoalOrder ? 40 : 20) +
      (bugFixed ? 45 : studentSim.goalCompletion * 0.35) +
      (diff.reordered ? 10 : 0)
  );

  const score = editDiagnosis.score;

  const bugFixedStatus = editDiagnosis.bugFixedStatus;
  const bugFixedDetail = editDiagnosis.bugFixedDetail;

  const whatStudentDid: string[] = [];
  for (const a of diff.added) whatStudentDid.push(a.label);
  for (const c of diff.changed) whatStudentDid.push(c.label);
  for (const r of diff.removed) whatStudentDid.push(r.label);
  if (diff.reordered) whatStudentDid.push("Reordered commands in the program");
  if (bugFixed) {
    const win = resolveRouteWinCell(task.levelConfig);
    whatStudentDid.push(
      win ? `Robot stopped on the ${win.label}` : "Robot stopped on the goal"
    );
  } else if (editDiagnosis.passedThroughGoal) {
    whatStudentDid.push(editDiagnosis.robotOutcome);
  } else if (goalProgressImproved) {
    whatStudentDid.push("Robot moved closer to the goal than the original program");
  } else if (editDiagnosis.robotOutcome) {
    whatStudentDid.push(editDiagnosis.robotOutcome);
  }
  if (whatStudentDid.length === 0 && debuggingStrategy === "no-change") {
    whatStudentDid.push("No edits to the starter program were detected");
  }

  const studentEnd =
    studentSim.path.length > 0
      ? studentSim.path[studentSim.path.length - 1]
      : null;
  const anchors = resolveRouteMapAnchors(task.levelConfig, { studentEnd });

  const repairStatusToStrategy: Partial<Record<RepairStatus, DebuggingStrategy>> = {
    correctFix: "minimal-fix",
    successfulButInefficient: "focused-fix",
    partialFix: "partial-fix",
    overFix: "trial-and-error",
    underFix: "partial-fix",
    wrongTurnFix: "incorrect-fix",
    wrongOrderFix: "incorrect-fix",
    wrongCommandFix: "incorrect-fix",
    wrongDirectionFix: "incorrect-fix",
    noRepair: "no-change",
    incorrectFix: "incorrect-fix",
  };
  const strategyFromRepair =
    repairStatusToStrategy[editDiagnosis.repairStatus] ?? debuggingStrategy;

  return {
    available: true,
    bugFixed,
    bugFixedStatus,
    bugFixedDetail,
    repairStatus: editDiagnosis.repairStatus,
    exactIssue: editDiagnosis.exactIssue,
    robotOutcome: editDiagnosis.robotOutcome,
    likelyMistake: editDiagnosis.likelyMistake,
    preferredWorkingFix: editDiagnosis.preferredWorkingFix,
    closestWorkingFix: editDiagnosis.closestWorkingFix,
    workingFixOptions: editDiagnosis.workingFixOptions,
    stoppedOnGoal: editDiagnosis.stoppedOnGoal,
    passedThroughGoal: editDiagnosis.passedThroughGoal,
    stoppedBeforeGoal: editDiagnosis.stoppedBeforeGoal,
    overshotGoal: editDiagnosis.overshotGoal,
    undershotGoal: editDiagnosis.undershotGoal,
    distanceFromGoal: editDiagnosis.distanceFromGoal,
    detectedMistakeType: editDiagnosis.detectedMistakeType,
    matchQuality: editDiagnosis.matchQuality,
    extraCommandsComparedToFix: editDiagnosis.extraCommandsComparedToFix,
    missingCommandsComparedToFix: editDiagnosis.missingCommandsComparedToFix,
    wrongCommandsComparedToFix: editDiagnosis.wrongCommandsComparedToFix,
    wrongOrderComparedToFix: editDiagnosis.wrongOrderComparedToFix,
    editStarterDiagnosis: editDiagnosis,
    reachesGoalBeforeFix,
    reachesGoalAfterFix,
    originalProgram: original,
    studentProgram: student,
    correctProgram: correct,
    commandsAdded: diff.added,
    commandsRemoved: diff.removed,
    commandsChanged: diff.changed,
    commandsReordered: diff.reordered,
    editDistance: diff.editDistance,
    changedBugLocation,
    originalErrorRemains,
    unnecessaryChanges,
    minimalFix,
    debuggingStrategy: strategyFromRepair,
    score,
    level: masteryFromScore(score),
    whatStudentDid,
    teacherExplanation: editDiagnosis.likelyMistake || STRATEGY_EXPLANATION[strategyFromRepair],
    recommendation: editDiagnosis.recommendation || STRATEGY_RECOMMENDATION[strategyFromRepair],
    showPathDetails: compareWithOptimalRoute || minimalFixExpected,
    originalPath: origSim.path,
    studentPath: studentSim.path,
    correctPath: correctSim.path,
    optimalPath: optimalRoute.path ?? [],
    originalPathStates: origSim.pathStates,
    studentPathStates: studentSim.pathStates,
    routeStartPosition: anchors.routeStartPosition,
    routeGoalPosition: anchors.routeGoalPosition,
    goalLabel: anchors.goalLabel,
    studentEndPosition: anchors.studentEndPosition,
    objectMarkers: anchors.objects,
    ...analyzeObstacleCollisions(studentSim, { hasObstacle: task.hasObstacle }),
    firstMistakeStep: editDiagnosis.firstMistakeStep,
    semanticIssue: editDiagnosis.semanticIssue,
    comparisonUsed: editDiagnosis.comparisonUsed,
    comparisonReason: editDiagnosis.comparisonReason,
    comparisonClarityScore: editDiagnosis.comparisonClarityScore,
    selectedComparisonRoute: editDiagnosis.selectedComparisonRoute,
  };
}

export function buildDebuggingFromAttempt(params: {
  levelConfig: LevelGameplayConfig;
  levelType?: LevelType;
  attempt: AttemptEvidenceInput;
  task: TaskAssessmentConfig;
}): DebuggingAnalysisResult {
  const { levelConfig, levelType, attempt, task } = params;
  const originalProgram = resolveStarterProgram({
    initialCommand: attempt.initialCommand,
    levelConfig,
  });
  const studentProgram = resolveAttemptProgram({
    finalCommand: attempt.finalCommand,
    initialCommand: attempt.initialCommand,
    levelConfig,
    levelType,
    commandEvents: attempt.commandEvents,
    commandHistory: attempt.commandHistory,
  });

  const meta = (levelConfig as LevelGameplayConfig & {
    assessment?: { minimalFixExpected?: boolean; compareWithOptimalRoute?: boolean };
  }).assessment;

  return analyzeDebuggingTask({
    originalProgram,
    studentProgram,
    task,
    minimalFixExpected: meta?.minimalFixExpected ?? true,
    compareWithOptimalRoute: meta?.compareWithOptimalRoute === true,
  });
}

export function debuggingStrategyLabel(strategy: DebuggingStrategy): string {
  return STRATEGY_LABEL[strategy];
}
