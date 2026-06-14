/**
 * Edit-starter / drag-and-drop debugging assessment — strict goal-stop rules.
 */

import type { LevelGameplayConfig } from "@/lib/level-config";
import {
  clampScore,
  masteryFromScore,
  resolveRouteMapAnchors,
  resolveRouteWinCell,
} from "@/lib/assessment/assessmentConfig";
import type { GridObjectMarker } from "@/lib/assessment/assessmentConfig";
import type {
  MasteryBand,
  OptimalRouteResult,
  RobotCommand,
  SimulationResult,
  TaskAssessmentConfig,
  Vec2,
} from "@/lib/assessment/assessmentTypes";
import {
  analyzeGoalRelationship,
  findOptimalRoute,
  programStopsOnGoalStrict,
  rankOptimalRoute,
  resolveStrictGoalPosition,
  simulateProgram,
  taskRequiredFinalFacing,
  type GoalRelationshipAnalysis,
} from "@/lib/assessment/routeAnalysis";
import { resolveFirstMistakeStep } from "@/lib/assessment/program-diff-visual";
import {
  interpretSemanticIssue,
  type SemanticInterpretation,
} from "@/lib/assessment/semanticInterpretation";
import {
  buildComparisonCandidatesFromFixOptions,
  chooseComparisonTarget,
  type ComparisonTargetType,
} from "@/lib/assessment/comparison-target";
import type { CommandToken } from "@/lib/command-icons";

export type RepairStatus =
  | "correctFix"
  | "partialFix"
  | "incorrectFix"
  | "overFix"
  | "underFix"
  | "wrongTurnFix"
  | "wrongCommandFix"
  | "wrongOrderFix"
  | "wrongDirectionFix"
  | "noRepair"
  | "successfulButInefficient";

export type MatchQuality = "strong" | "possible" | "unclear";

export type DetectedMistakeType =
  | "noRepair"
  | "overAddedForward"
  | "underAddedForward"
  | "oppositeTurn"
  | "wrongCommandAdded"
  | "correctCommandWrongPosition"
  | "extraUnrelatedCommand"
  | "fullRewriteCorrect"
  | "fullRewriteIncorrect"
  | "collisionRepairError"
  | "unknown";

export type WorkingFixOption = {
  commands: CommandToken[];
  commandCount: number;
  finalPosition: Vec2;
  finalDirection: Vec2;
  reachesGoalExactly: boolean;
  isShortest: boolean;
};

export type EditStarterDebuggingResult = {
  bugFixed: boolean;
  repairStatus: RepairStatus;
  originalProgram: CommandToken[];
  studentProgram: CommandToken[];
  preferredWorkingFix: WorkingFixOption | null;
  closestWorkingFix: WorkingFixOption | null;
  workingFixOptions: WorkingFixOption[];

  studentFinalPosition: Vec2;
  studentFinalDirection: Vec2;
  goalPosition: Vec2;
  requiredFinalDirection?: Vec2;

  goalRelationship: GoalRelationshipAnalysis;
  stoppedOnGoal: boolean;
  passedThroughGoal: boolean;
  stoppedBeforeGoal: boolean;
  overshotGoal: boolean;
  undershotGoal: boolean;
  distanceFromGoal: number;

  exactIssue: string;
  robotOutcome: string;
  likelyMistake: string;
  recommendation: string;

  commandsAdded: string[];
  commandsRemoved: string[];
  commandsChanged: string[];
  commandsReordered: boolean;

  extraCommandsComparedToFix: CommandToken[];
  missingCommandsComparedToFix: CommandToken[];
  wrongCommandsComparedToFix: CommandToken[];
  wrongOrderComparedToFix: boolean;

  detectedMistakeType: DetectedMistakeType;
  matchQuality: MatchQuality;
  score: number;
  levelLabel: MasteryBand;
  levelDisplayName: string;

  bugFixedStatus: "yes" | "partly" | "no";
  bugFixedDetail: string;
  /** 1-based step for teacher UI — from selected comparison route. */
  firstMistakeStep: number | null;
  semanticIssue: SemanticInterpretation;
  comparisonUsed: ComparisonTargetType;
  comparisonReason: string;
  comparisonClarityScore: number;
  selectedComparisonRoute: CommandToken[];
};

const COMMAND_LABEL: Record<CommandToken, string> = {
  forward: "Forward",
  backward: "Backward",
  "turn left": "Turn left",
  "turn right": "Turn right",
};

function programsEqual(a: CommandToken[], b: CommandToken[]): boolean {
  return a.length === b.length && a.every((c, i) => c === b[i]);
}

function toTokens(cmds: readonly string[]): CommandToken[] {
  const out: CommandToken[] = [];
  for (const c of cmds) {
    if (c === "forward" || c === "backward" || c === "turn left" || c === "turn right") {
      out.push(c);
    }
  }
  return out;
}

function countTurns(cmds: CommandToken[]): number {
  return cmds.filter((c) => c === "turn left" || c === "turn right").length;
}

function sharedPrefixLength(a: CommandToken[], b: CommandToken[]): number {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) i++;
  return i;
}

function candidateExtendsStarter(
  starter: CommandToken[],
  candidate: CommandToken[]
): boolean {
  return (
    candidate.length >= starter.length &&
    starter.every((c, i) => candidate[i] === c)
  );
}

const CONTINUATION_COMMANDS: CommandToken[] = [
  "forward",
  "turn left",
  "turn right",
];

function manhattan(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function lcsDiff(original: CommandToken[], student: CommandToken[]) {
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
  const added: CommandToken[] = [];
  const removed: CommandToken[] = [];
  const changed: { from: CommandToken; to: CommandToken }[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && original[i - 1] === student[j - 1]) {
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      added.unshift(student[j - 1]);
      j--;
    } else if (i > 0 && j > 0) {
      changed.push({ from: original[i - 1], to: student[j - 1] });
      i--;
      j--;
    } else {
      removed.unshift(original[i - 1]);
      i--;
    }
  }
  const reordered =
    original.length === student.length &&
    !programsEqual(original, student) &&
    [...original].sort().join() === [...student].sort().join() &&
    added.length === 0 &&
    removed.length === 0 &&
    changed.length === 0;
  const editDistance = added.length + removed.length + changed.length;
  return { added, removed, changed, reordered, editDistance };
}

function compareToFix(student: CommandToken[], fix: CommandToken[]) {
  const d = lcsDiff(fix, student);
  const extra = d.added;
  const missing = d.removed;
  const wrong = d.changed.map((c) => c.to);
  return {
    extra,
    missing,
    wrong,
    wrongOrder: d.reordered,
    editDistance: d.editDistance,
  };
}

function programSimilarity(a: CommandToken[], b: CommandToken[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const d = lcsDiff(a, b);
  const maxLen = Math.max(a.length, b.length, 1);
  return 1 - d.editDistance / maxLen;
}

function loadStoredPrograms(task: TaskAssessmentConfig): CommandToken[][] {
  const meta = (
    task.levelConfig as LevelGameplayConfig & {
      assessment?: {
        correctPrograms?: string[][];
        workingFixes?: string[][];
        solutionPrograms?: string[][];
      };
    }
  ).assessment;
  const raw = [
    ...(meta?.correctPrograms ?? []),
    ...(meta?.workingFixes ?? []),
    ...(meta?.solutionPrograms ?? []),
  ];
  return raw.map((row) => toTokens(row));
}

function pickTeacherSolution(
  task: TaskAssessmentConfig,
  stored: CommandToken[][]
): CommandToken[] | null {
  for (const program of stored) {
    if (program.length === 0) continue;
    const sim = simulateProgram(task, program);
    if (programStopsOnGoalStrict(task, sim)) {
      return [...program];
    }
  }
  return null;
}

function workingFixFromCommands(
  task: TaskAssessmentConfig,
  commands: CommandToken[],
  isShortest = false
): WorkingFixOption {
  const sim = simulateProgram(task, commands);
  return {
    commands: [...commands],
    commandCount: commands.length,
    finalPosition: { ...sim.finalPosition },
    finalDirection: { ...sim.finalDirection },
    reachesGoalExactly: programStopsOnGoalStrict(task, sim),
    isShortest,
  };
}

const MAX_BFS_ALTERNATIVES = 6;
const MAX_SUFFIX_LENGTH = 6;

export function buildWorkingFixOptions(
  task: TaskAssessmentConfig,
  originalProgram: CommandToken[],
  optimalResult?: OptimalRouteResult | null
): WorkingFixOption[] {
  const options: WorkingFixOption[] = [];
  const seen = new Set<string>();
  const simCache = new Map<string, SimulationResult>();

  const simulateCached = (cmds: CommandToken[]): SimulationResult => {
    const sig = cmds.join("|");
    const cached = simCache.get(sig);
    if (cached) return cached;
    const sim = simulateProgram(task, cmds);
    simCache.set(sig, sim);
    return sim;
  };

  const push = (cmds: CommandToken[], isShortest = false) => {
    const sig = cmds.join("|");
    if (!sig || seen.has(sig)) return;
    seen.add(sig);
    const sim = simulateCached(cmds);
    const reaches = programStopsOnGoalStrict(task, sim);
    options.push({
      commands: cmds,
      commandCount: cmds.length,
      finalPosition: { ...sim.finalPosition },
      finalDirection: { ...sim.finalDirection },
      reachesGoalExactly: reaches,
      isShortest,
    });
  };

  for (const stored of loadStoredPrograms(task)) {
    if (stored.length > 0) push(stored);
  }

  const optimal = optimalResult ?? findOptimalRoute(task);
  if (optimal.reachable && optimal.commands.length > 0) {
    const primary = toTokens(optimal.commands);
    push(primary, true);
    for (const alt of (optimal.alternativeRoutes ?? []).slice(0, MAX_BFS_ALTERNATIVES)) {
      push(toTokens(alt.commands));
    }
  }

  for (const derived of collectStarterDerivedValidFixes(task, originalProgram)) {
    push(derived);
  }

  for (const continued of collectStarterContinuationFixes(task, originalProgram)) {
    push(continued);
  }

  const valid = options.filter((o) => o.reachesGoalExactly);
  valid.sort((a, b) => {
    if (a.commandCount !== b.commandCount) return a.commandCount - b.commandCount;
    const turnDiff = countTurns(a.commands) - countTurns(b.commands);
    if (turnDiff !== 0) return turnDiff;
    return rankOptimalRoute(b.commands as RobotCommand[]) - rankOptimalRoute(a.commands as RobotCommand[]);
  });

  if (valid.length > 0) {
    valid[0].isShortest = true;
    for (let i = 1; i < valid.length; i++) valid[i].isShortest = false;
  }

  return valid;
}

/** Try small edits to the starter program and keep variants that reach the goal. */
function collectStarterDerivedValidFixes(
  task: TaskAssessmentConfig,
  original: CommandToken[]
): CommandToken[][] {
  const out: CommandToken[][] = [];
  const seen = new Set<string>();

  const tryAdd = (cmds: CommandToken[]) => {
    const sig = cmds.join("|");
    if (!sig || seen.has(sig)) return;
    seen.add(sig);
    const sim = simulateProgram(task, cmds);
    if (programStopsOnGoalStrict(task, sim)) {
      out.push(cmds);
    }
  };

  for (let i = 0; i < original.length; i++) {
    const c = original[i];
    if (c === "turn left" || c === "turn right") {
      const alt = [...original];
      alt[i] = c === "turn left" ? "turn right" : "turn left";
      tryAdd(alt);
    }
  }

  for (let i = 0; i < original.length; i++) {
    if (original[i] !== "forward") continue;
    tryAdd(original.filter((_, j) => j !== i));
    tryAdd([...original.slice(0, i), "forward", ...original.slice(i)]);
  }

  tryAdd([...original, "forward"]);
  tryAdd([...original, "forward", "forward"]);

  for (let i = 0; i < original.length - 1; i++) {
    if (original[i] === "forward" && original[i + 1] === "forward") {
      const collapsed = [...original.slice(0, i), ...original.slice(i + 1)];
      tryAdd(collapsed);
    }
  }

  return out;
}

/**
 * From the starter program's end state, try short suffixes (turn + forward, etc.)
 * that complete the route — e.g. buggy FFRFFF → valid FFRFFFRF.
 */
function collectStarterContinuationFixes(
  task: TaskAssessmentConfig,
  original: CommandToken[]
): CommandToken[][] {
  if (original.length === 0) return [];

  const out: CommandToken[][] = [];
  const programSeen = new Set<string>();
  const goalCache = new Map<string, boolean>();

  const reachesGoal = (suffix: CommandToken[]): boolean => {
    const full = [...original, ...suffix];
    const sig = full.join("|");
    const cached = goalCache.get(sig);
    if (cached != null) return cached;
    const ok = programStopsOnGoalStrict(task, simulateProgram(task, full));
    goalCache.set(sig, ok);
    return ok;
  };

  const recordProgram = (suffix: CommandToken[]) => {
    const full = [...original, ...suffix];
    const sig = full.join("|");
    if (!sig || programSeen.has(sig)) return false;
    programSeen.add(sig);
    if (reachesGoal(suffix)) {
      out.push(full);
      return true;
    }
    return false;
  };

  type SuffixNode = { suffix: CommandToken[] };
  const queue: SuffixNode[] = [{ suffix: [] }];
  const suffixSeen = new Set<string>([""]);

  while (queue.length > 0) {
    const { suffix } = queue.shift()!;
    if (suffix.length > 0 && recordProgram(suffix)) continue;
    if (suffix.length >= MAX_SUFFIX_LENGTH) continue;

    for (const cmd of CONTINUATION_COMMANDS) {
      const nextSuffix = [...suffix, cmd];
      const key = nextSuffix.join("|");
      if (suffixSeen.has(key)) continue;
      suffixSeen.add(key);
      queue.push({ suffix: nextSuffix });
    }
  }

  return out;
}

function trimWorkingFixOptions(
  original: CommandToken[],
  options: WorkingFixOption[],
  closest: WorkingFixOption | null,
  preferred: WorkingFixOption | null
): WorkingFixOption[] {
  const trimmed: WorkingFixOption[] = [];
  const seen = new Set<string>();

  const add = (opt: WorkingFixOption | null | undefined) => {
    if (!opt) return;
    const sig = opt.commands.join("|");
    if (seen.has(sig)) return;
    seen.add(sig);
    trimmed.push(opt);
  };

  add(closest);
  add(preferred);
  for (const opt of options) {
    if (trimmed.length >= 8) break;
    if (candidateExtendsStarter(original, opt.commands)) add(opt);
  }
  for (const opt of options) {
    if (trimmed.length >= 8) break;
    add(opt);
  }
  return trimmed;
}

/**
 * Pick the valid fix that best explains the student's repair (not always the shortest).
 * Prefers starter-shaped routes (same prefix as buggy program) when the student
 * edited incrementally rather than rewriting to the BFS shortest path.
 */
function pickClosestWorkingFix(
  student: CommandToken[],
  original: CommandToken[],
  options: WorkingFixOption[]
): WorkingFixOption | null {
  if (options.length === 0) return null;

  const pool = options.filter((o) => o.reachesGoalExactly);
  const candidates = pool.length > 0 ? pool : options;

  let best = candidates[0];
  let bestScore = -Infinity;

  for (const opt of candidates) {
    const diff = compareToFix(student, opt.commands);
    const prefixStudent = sharedPrefixLength(student, opt.commands);
    const prefixOriginal = sharedPrefixLength(original, opt.commands);
    const extendsStarter = candidateExtendsStarter(original, opt.commands);

    let score = programSimilarity(student, opt.commands) * 2.2;
    score += programSimilarity(original, opt.commands) * 0.4;
    score += prefixStudent * 0.9;
    score += prefixOriginal * 0.6;
    if (extendsStarter) score += 3.0;
    if (prefixOriginal < 2 && !extendsStarter) score -= 2.0;
    score -= diff.missing.length * 0.55;
    score -= diff.extra.length * 0.2;
    const turnWrong = diff.wrong.filter(
      (c) => c === "turn left" || c === "turn right"
    ).length;
    score -= turnWrong * 0.45;
    if (score > bestScore) {
      bestScore = score;
      best = opt;
    }
  }

  return best;
}

function firstTurnOrCommandMismatch(
  student: CommandToken[],
  fix: CommandToken[]
): { step: number; expected: CommandToken; actual: CommandToken } | null {
  const maxLen = Math.max(student.length, fix.length);
  for (let i = 0; i < maxLen; i++) {
    const s = student[i];
    const f = fix[i];
    if (s === undefined || f === undefined || s === f) continue;
    return { step: i + 1, expected: f, actual: s };
  }
  return null;
}

function isTurnCommand(c: CommandToken | undefined): c is "turn left" | "turn right" {
  return c === "turn left" || c === "turn right";
}

/** Turn mistake at the first command diff — including misplaced turn vs forward. */
function isTurnRelatedMistake(params: {
  originalProgram: CommandToken[];
  studentProgram: CommandToken[];
  cmdMismatch: { step: number; expected: CommandToken; actual: CommandToken } | null;
  diffOrig: ReturnType<typeof lcsDiff>;
}): boolean {
  const { originalProgram, cmdMismatch, diffOrig } = params;
  if (!cmdMismatch || !isTurnCommand(cmdMismatch.actual)) return false;

  if (isTurnCommand(cmdMismatch.expected)) return true;

  const idx = cmdMismatch.step - 1;
  const origAtStep = originalProgram[idx];
  if (isTurnCommand(origAtStep)) return true;

  const starterTurnTouched =
    diffOrig.changed.some((c) => isTurnCommand(c.from) || isTurnCommand(c.to)) ||
    diffOrig.added.some(isTurnCommand) ||
    diffOrig.removed.some(isTurnCommand);
  if (starterTurnTouched) return true;

  return cmdMismatch.expected === "forward" || cmdMismatch.expected === "backward";
}

export function generateExactRepairDiagnosis(params: {
  originalProgram: CommandToken[];
  studentProgram: CommandToken[];
  preferredWorkingFix: WorkingFixOption | null;
  closestWorkingFix: WorkingFixOption | null;
  goalRelationship: GoalRelationshipAnalysis;
  goalLabel: string;
  requiredFinalDirection?: Vec2;
  studentSim: SimulationResult;
}): {
  exactIssue: string;
  robotOutcome: string;
  likelyMistake: string;
  repairStatus: RepairStatus;
} {
  const {
    originalProgram,
    studentProgram,
    preferredWorkingFix,
    closestWorkingFix,
    goalRelationship,
    goalLabel,
    requiredFinalDirection,
    studentSim,
  } = params;

  const fix = closestWorkingFix ?? preferredWorkingFix;
  const fixCmds = fix?.commands ?? [];
  const diffOrig = lcsDiff(originalProgram, studentProgram);
  const diffFix = fixCmds.length > 0 ? compareToFix(studentProgram, fixCmds) : null;

  let exactIssue = "Student changed the starter program.";
  let likelyMistake = "Review the student's edits against a working fix.";
  let repairStatus: RepairStatus = "incorrectFix";

  if (programsEqual(originalProgram, studentProgram)) {
    return {
      exactIssue: "Student did not change the starter program.",
      robotOutcome: goalRelationship.stoppedOnGoal
        ? `Robot already stops on the ${goalLabel}.`
        : goalRelationship.stoppedBeforeGoal
          ? `Robot stops before the ${goalLabel}.`
          : `Robot does not stop on the ${goalLabel}.`,
      likelyMistake: "Student may not have attempted a repair.",
      repairStatus: "noRepair",
    };
  }

  if (studentSim.obstacleCollisionCount && studentSim.obstacleCollisionCount > 0) {
    const step = studentSim.firstObstacleMistakeStep ?? 1;
    return {
      exactIssue: `Student tried to move through the obstacle at Step ${step}.`,
      robotOutcome: `Robot tried to move through the obstacle at Step ${step}.`,
      likelyMistake: "Student may not have noticed the blocked cell.",
      repairStatus: "incorrectFix",
    };
  }

  const passedGoalAfterTouch =
    goalRelationship.goalTouched &&
    !goalRelationship.finalStoppedOnGoal &&
    goalRelationship.movedAfterGoal;

  if (passedGoalAfterTouch) {
    const beyond = goalRelationship.passedGoalDistance || goalRelationship.distanceFromGoal;
    return {
      exactIssue: "Robot reached the goal but continued moving.",
      robotOutcome:
        beyond === 1
          ? `Robot passed the ${goalLabel} by 1 cell.`
          : beyond > 0
            ? `Robot passed the ${goalLabel} by ${beyond} cell(s).`
            : `Robot passed the ${goalLabel} but did not stop on it.`,
      likelyMistake: "Remove the extra movement after the goal.",
      repairStatus: "overFix",
    };
  }

  if (diffFix) {
    const forwardAdds = diffFix.extra.filter((c) => c === "forward").length;
    const forwardMissing = diffFix.missing.filter((c) => c === "forward").length;
    const turnChanges = diffOrig.changed.filter(
      (c) =>
        (c.from === "turn left" && c.to === "turn right") ||
        (c.from === "turn right" && c.to === "turn left")
    );
    const cmdMismatch = fixCmds.length > 0 ? firstTurnOrCommandMismatch(studentProgram, fixCmds) : null;
    const isTurnMismatch =
      cmdMismatch &&
      isTurnCommand(cmdMismatch.expected) &&
      isTurnCommand(cmdMismatch.actual);
    const turnRelated = isTurnRelatedMistake({
      originalProgram,
      studentProgram,
      cmdMismatch,
      diffOrig,
    });

    if (isTurnMismatch && cmdMismatch) {
      exactIssue = `Student used ${COMMAND_LABEL[cmdMismatch.actual]} instead of ${COMMAND_LABEL[cmdMismatch.expected]} at Step ${cmdMismatch.step}.`;
      likelyMistake = "Student may be confusing left and right turns.";
      repairStatus = "wrongTurnFix";
    } else if (turnRelated && cmdMismatch) {
      exactIssue =
        isTurnCommand(cmdMismatch.expected)
          ? `Student used ${COMMAND_LABEL[cmdMismatch.actual]} instead of ${COMMAND_LABEL[cmdMismatch.expected]} at Step ${cmdMismatch.step}.`
          : `Student used ${COMMAND_LABEL[cmdMismatch.actual]} at Step ${cmdMismatch.step} where ${COMMAND_LABEL[cmdMismatch.expected]} was needed.`;
      likelyMistake = "Student may have used the wrong turn or placed a turn in the wrong step.";
      repairStatus = "wrongTurnFix";
    } else if (turnChanges.length > 0) {
      const t = turnChanges[0];
      exactIssue = `Student changed ${COMMAND_LABEL[t.from]} to ${COMMAND_LABEL[t.to]}.`;
      likelyMistake = "Student may be confusing left and right turns.";
      repairStatus = "wrongTurnFix";
    } else if (
      !goalRelationship.goalTouched &&
      goalRelationship.stoppedBeforeGoal &&
      forwardMissing > 0
    ) {
      exactIssue =
        forwardMissing === 1
          ? "Student needed 1 more Forward command to reach the goal."
          : `Student needed ${forwardMissing} more Forward command(s) to reach the goal.`;
      likelyMistake = "Student fixed part of the path but stopped before the goal.";
      repairStatus = "underFix";
    } else if (diffFix.wrongOrder && diffFix.extra.length === 0 && diffFix.missing.length === 0) {
      exactIssue = "Student used the needed commands but placed them in the wrong order.";
      likelyMistake = "Student may need support with command order.";
      repairStatus = "wrongOrderFix";
    } else if (!goalRelationship.goalTouched && forwardMissing > 0 && forwardAdds === 0) {
      exactIssue =
        forwardMissing === 1
          ? "Student did not add the missing Forward command."
          : `Student is missing ${forwardMissing} Forward command(s) compared with a working route.`;
      likelyMistake = "Student did not complete the repair.";
      repairStatus = "underFix";
    } else if (forwardAdds > 0 && forwardMissing === 0) {
      exactIssue =
        forwardAdds === 1
          ? "Student added 1 extra Forward command."
          : `Student added ${forwardAdds} extra Forward commands.`;
      likelyMistake =
        "Student recognized that more movement was needed, but over-counted the number of steps.";
      repairStatus = "overFix";
    } else if (diffFix.wrong.length > 0) {
      const w = diffOrig.changed[0];
      exactIssue = w
        ? `Student changed ${COMMAND_LABEL[w.from]} to ${COMMAND_LABEL[w.to]}.`
        : "Student replaced a command with the wrong type.";
      likelyMistake = "Student may have chosen the wrong action for this step.";
      repairStatus = "wrongCommandFix";
    } else if (diffFix.extra.length > 0 && goalRelationship.stoppedOnGoal) {
      exactIssue = `Student reached the ${goalLabel} but added unnecessary commands.`;
      likelyMistake = "Student fixed the bug but included extra steps that were not required.";
      repairStatus = "successfulButInefficient";
    } else if (diffOrig.editDistance > 0 && !goalRelationship.stoppedOnGoal) {
      exactIssue = "Student edited the program but the repair does not stop on the goal.";
      repairStatus = "partialFix";
    }
  }

  let robotOutcome: string;
  if (goalRelationship.stoppedOnGoal) {
    if (!goalRelationship.finalDirectionCorrect && requiredFinalDirection) {
      robotOutcome = `Robot reached the ${goalLabel} cell but ended facing the wrong direction.`;
      repairStatus = "wrongDirectionFix";
    } else {
      robotOutcome = `Robot stopped on the ${goalLabel}.`;
    }
  } else if (goalRelationship.passedThroughGoal && goalRelationship.overshotGoal) {
    const beyond = goalRelationship.distanceFromGoal;
    robotOutcome =
      beyond === 1
        ? `Robot passed the ${goalLabel} and stopped 1 square beyond it.`
        : `Robot passed the ${goalLabel} and stopped ${beyond} square(s) away from it.`;
    if (repairStatus === "incorrectFix") repairStatus = "overFix";
  } else if (goalRelationship.passedThroughGoal) {
    robotOutcome = `Robot passed the ${goalLabel} but did not stop on it.`;
    if (repairStatus === "incorrectFix") repairStatus = "overFix";
  } else if (goalRelationship.stoppedBeforeGoal) {
    robotOutcome = `Robot stopped before the ${goalLabel}.`;
    if (repairStatus === "incorrectFix") repairStatus = "underFix";
  } else if (studentSim.obstacleCollisionCount && studentSim.obstacleCollisionCount > 0) {
    const step = studentSim.firstObstacleMistakeStep ?? 1;
    robotOutcome = `Robot tried to move through the obstacle at Step ${step}.`;
    exactIssue = `Student tried to move through the obstacle at Step ${step}.`;
    repairStatus = "incorrectFix";
  } else if (studentSim.collisions.length > 0) {
    robotOutcome = "Robot hit the edge of the grid during the repair.";
    repairStatus = "incorrectFix";
  } else {
    robotOutcome = `Robot stopped ${goalRelationship.distanceFromGoal} step(s) from the ${goalLabel}.`;
  }

  if (
    goalRelationship.stoppedOnGoal &&
    goalRelationship.finalDirectionCorrect &&
    fix &&
    studentProgram.length > fix.commandCount
  ) {
    repairStatus = "successfulButInefficient";
  }

  return { exactIssue, robotOutcome, likelyMistake, repairStatus };
}

type MistakeModel = {
  type: DetectedMistakeType;
  program: CommandToken[];
};

function buildMistakeModels(
  original: CommandToken[],
  preferred: CommandToken[] | null
): MistakeModel[] {
  const fix = preferred ?? original;
  const models: MistakeModel[] = [{ type: "noRepair", program: [...original] }];

  const withExtraForward = [...fix];
  const fIdx = withExtraForward.lastIndexOf("forward");
  if (fIdx >= 0) {
    withExtraForward.splice(fIdx + 1, 0, "forward");
  } else {
    withExtraForward.push("forward");
  }
  models.push({ type: "overAddedForward", program: withExtraForward });

  const underForward = [...fix];
  const remIdx = underForward.lastIndexOf("forward");
  if (remIdx >= 0) underForward.splice(remIdx, 1);
  models.push({ type: "underAddedForward", program: underForward });

  const opposite = fix.map((c): CommandToken => {
    if (c === "turn left") return "turn right";
    if (c === "turn right") return "turn left";
    return c;
  });
  if (!programsEqual(opposite, fix)) {
    models.push({ type: "oppositeTurn", program: opposite });
  }

  if (fix.length > 1) {
    const reordered = [...fix];
    [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
    if (!programsEqual(reordered, fix)) {
      models.push({ type: "correctCommandWrongPosition", program: reordered });
    }
  }

  const extraTurn: CommandToken[] = [...fix, "turn left"];
  models.push({ type: "extraUnrelatedCommand", program: extraTurn });

  return models;
}

function matchMistakeModels(
  task: TaskAssessmentConfig,
  student: CommandToken[],
  studentSim: SimulationResult,
  goalRel: GoalRelationshipAnalysis,
  original: CommandToken[],
  preferred: WorkingFixOption | null
): { type: DetectedMistakeType; quality: MatchQuality; score: number } {
  const goal = resolveStrictGoalPosition(task);
  const models = buildMistakeModels(original, preferred?.commands ?? null);
  let bestType: DetectedMistakeType = "unknown";
  let bestScore = 0;

  for (const model of models) {
    const sim = simulateProgram(task, model.program);
    const modelGoal =
      goal &&
      analyzeGoalRelationship({
        pathVisited: sim.path,
        finalPosition: sim.finalPosition,
        goalPosition: goal,
        finalDirection: sim.finalDirection,
        requiredFinalDirection: taskRequiredFinalFacing(task),
      });

    const progSim = programSimilarity(student, model.program);
    const posSim =
      goal && modelGoal
        ? 1 - manhattan(studentSim.finalPosition, sim.finalPosition) / 10
        : 0;
    const editSim = 1 - lcsDiff(model.program, student).editDistance / Math.max(student.length, 1);
    const dirSim = vecFacingSim(studentSim.finalDirection, sim.finalDirection);
    const goalSim = modelGoal
      ? (modelGoal.stoppedOnGoal === goalRel.stoppedOnGoal ? 1 : 0) * 0.5 +
        (modelGoal.passedThroughGoal === goalRel.passedThroughGoal ? 1 : 0) * 0.5
      : 0;

    const matchScore =
      0.4 * progSim +
      0.3 * Math.max(0, posSim) +
      0.15 * editSim +
      0.1 * dirSim +
      0.05 * goalSim;

    if (matchScore > bestScore) {
      bestScore = matchScore;
      bestType = model.type;
    }
  }

  if (preferred && programsEqual(student, preferred.commands)) {
    return { type: "fullRewriteCorrect", quality: "strong", score: 1 };
  }

  const quality: MatchQuality =
    bestScore >= 0.85 ? "strong" : bestScore >= 0.65 ? "possible" : "unclear";
  return { type: bestType, quality, score: bestScore };
}

function vecFacingSim(a: Vec2, b: Vec2): number {
  return a.x === b.x && a.y === b.y ? 1 : 0;
}

function scoreForRepair(
  repairStatus: RepairStatus,
  goalRel: GoalRelationshipAnalysis,
  matchScore: number
): number {
  if (repairStatus === "correctFix") return clampScore(92 + matchScore * 8);
  if (repairStatus === "successfulButInefficient") return clampScore(78 + matchScore * 10);
  if (repairStatus === "partialFix") return clampScore(45 + goalRel.distanceFromGoal * -3 + 25);
  if (repairStatus === "overFix") return clampScore(55 + matchScore * 15);
  if (repairStatus === "underFix") return clampScore(50 + matchScore * 12);
  if (repairStatus === "wrongTurnFix") return clampScore(35 + matchScore * 18);
  if (repairStatus === "wrongOrderFix") return clampScore(40 + matchScore * 18);
  if (repairStatus === "wrongDirectionFix") return clampScore(42);
  if (repairStatus === "noRepair") return clampScore(8 + matchScore * 10);
  return clampScore(15 + matchScore * 20);
}

const REPAIR_RECOMMENDATIONS: Record<RepairStatus, string> = {
  correctFix: "Try a harder debugging task with a wrong turn in the middle of the sequence.",
  successfulButInefficient:
    "Practice checking where the robot stops after each command — only add what is needed.",
  partialFix: "Try a debugging task with one missing movement before the goal.",
  overFix: "Practice counting steps to the goal so the robot stops on the goal, not past it.",
  underFix: "Encourage adding the missing command and running again before finishing.",
  wrongTurnFix: "Practice left vs right turns with a simple two-turn path.",
  wrongCommandFix: "Review which command type matches each step on the grid.",
  wrongOrderFix: "Practice placing turns before or after the forward that needs them.",
  wrongDirectionFix: "Discuss which way the robot should face when it stops on the goal.",
  noRepair: "Encourage editing the yellow strip and pressing RUN before finishing.",
  incorrectFix: "Try a debugging task with a single missing forward at the end.",
};

export function analyzeEditStarterDebugging(params: {
  originalProgram: CommandToken[];
  studentProgram: CommandToken[];
  workingFixOptions?: WorkingFixOption[];
  preferredWorkingFix?: WorkingFixOption | null;
  studentSim?: SimulationResult;
  originalSim?: SimulationResult;
  task: TaskAssessmentConfig;
}): EditStarterDebuggingResult {
  const original = [...params.originalProgram];
  const student = [...params.studentProgram];
  const task = params.task;

  const goalCell = resolveStrictGoalPosition(task);
  const goalPosition = goalCell ?? { x: 0, y: 0 };
  const win = resolveRouteWinCell(task.levelConfig);
  const goalLabel = win?.label ?? "goal";
  const requiredFinalDirection = taskRequiredFinalFacing(task);

  const workingFixOptions =
    params.workingFixOptions ?? buildWorkingFixOptions(task, original);
  const preferredWorkingFix =
    params.preferredWorkingFix ??
    workingFixOptions.find((o) => o.isShortest) ??
    workingFixOptions[0] ??
    null;
  const closestWorkingFix =
    pickClosestWorkingFix(student, original, workingFixOptions) ?? preferredWorkingFix;

  const storedPrograms = loadStoredPrograms(task);
  const teacherSolution = pickTeacherSolution(task, storedPrograms);
  const shortestCommands = preferredWorkingFix?.commands ?? [];
  const closestCommands = closestWorkingFix?.commands ?? shortestCommands;
  const validOptions = workingFixOptions.filter((o) => o.reachesGoalExactly);
  const comparisonCandidates = buildComparisonCandidatesFromFixOptions(validOptions, {
    originalProgram: original,
    teacherSolution,
    shortestCommands,
    closestCommands,
  });
  const comparison = chooseComparisonTarget({
    studentProgram: student,
    originalProgram: original,
    teacherSolution,
    shortestValidRoute: shortestCommands,
    closestValidRoute: closestCommands,
    alternateValidRoutes: validOptions
      .map((o) => o.commands)
      .filter((cmds) => {
        const sig = cmds.join("|");
        return sig !== shortestCommands.join("|") && sig !== closestCommands.join("|");
      }),
    candidates: comparisonCandidates,
    taskSettings: {
      fixedAnswerExpected: teacherSolution != null,
      minimalFixExpected: true,
      hasObstacle: task.hasObstacle,
    },
  });

  const selectedComparisonFix =
    validOptions.find((o) => programsEqual(o.commands, comparison.selectedTargetProgram)) ??
    workingFixFromCommands(
      task,
      comparison.selectedTargetProgram,
      programsEqual(comparison.selectedTargetProgram, shortestCommands)
    );

  const studentSim = params.studentSim ?? simulateProgram(task, student);
  const goalRelationship = analyzeGoalRelationship({
    pathVisited: studentSim.path,
    finalPosition: studentSim.finalPosition,
    goalPosition,
    finalDirection: studentSim.finalDirection,
    requiredFinalDirection,
  });

  const bugFixed = programStopsOnGoalStrict(task, studentSim);

  const diagnosis = generateExactRepairDiagnosis({
    originalProgram: original,
    studentProgram: student,
    preferredWorkingFix,
    closestWorkingFix: selectedComparisonFix,
    goalRelationship,
    goalLabel,
    requiredFinalDirection,
    studentSim,
  });

  let repairStatus = diagnosis.repairStatus;
  if (bugFixed && repairStatus !== "successfulButInefficient") {
    repairStatus = "correctFix";
  } else if (!bugFixed && repairStatus === "correctFix") {
    repairStatus = diagnosis.repairStatus === "noRepair" ? "noRepair" : "incorrectFix";
  }

  const diffOrig = lcsDiff(original, student);
  const diffFix = selectedComparisonFix
    ? compareToFix(student, selectedComparisonFix.commands)
    : { extra: [], missing: [], wrong: [], wrongOrder: false, editDistance: 0 };

  const { type: detectedMistakeType, quality: matchQuality, score: matchScore } =
    matchMistakeModels(task, student, studentSim, goalRelationship, original, selectedComparisonFix);

  const score = bugFixed
    ? scoreForRepair(
        repairStatus === "successfulButInefficient" ? repairStatus : "correctFix",
        goalRelationship,
        matchScore
      )
    : scoreForRepair(repairStatus, goalRelationship, matchScore);

  const origSim = params.originalSim ?? simulateProgram(task, original);
  const goalProgressImproved =
    studentSim.path.length > origSim.path.length ||
    manhattan(studentSim.finalPosition, goalPosition) <
      manhattan(origSim.finalPosition, goalPosition);

  let bugFixedStatus: "yes" | "partly" | "no" = bugFixed ? "yes" : goalProgressImproved ? "partly" : "no";

  let bugFixedDetail: string;
  if (bugFixed) {
    bugFixedDetail = "Yes — robot stopped on the goal.";
  } else if (goalRelationship.passedThroughGoal) {
    bugFixedDetail = "No — robot passed the goal.";
  } else if (goalRelationship.stoppedBeforeGoal) {
    bugFixedDetail = "No — robot stopped before the goal.";
  } else if (goalRelationship.stoppedOnGoal && !goalRelationship.finalDirectionCorrect) {
    bugFixedDetail = "No — robot ended facing the wrong direction.";
  } else {
    bugFixedDetail = "No — robot did not stop on the goal.";
  }

  const commandsAdded = diffOrig.added.map((c) => `Added ${COMMAND_LABEL[c]}`);
  const commandsRemoved = diffOrig.removed.map((c) => `Removed ${COMMAND_LABEL[c]}`);
  const commandsChanged = diffOrig.changed.map(
    (c) => `Changed ${COMMAND_LABEL[c.from]} → ${COMMAND_LABEL[c.to]}`
  );

  const selectedSim = simulateProgram(task, selectedComparisonFix.commands);
  const selectedPath = selectedSim.path;
  const forwardMissingCount = diffFix.missing.filter((c) => c === "forward").length;
  const forwardExtraCount = diffFix.extra.filter((c) => c === "forward").length;

  let firstMistakeStep = resolveFirstMistakeStep({
    student,
    reference: selectedComparisonFix.commands,
    studentPath: studentSim.path,
    referencePath: selectedPath.length > 1 ? selectedPath : studentSim.path,
    firstObstacleMistakeStep: studentSim.firstObstacleMistakeStep ?? null,
  });

  const semanticIssue = interpretSemanticIssue({
    goalRel: goalRelationship,
    studentSim,
    goalLabel,
    firstObstacleStep: studentSim.firstObstacleMistakeStep ?? null,
    repairStatus,
    firstCommandMistakeStep: firstMistakeStep,
    forwardMissingCount,
    forwardExtraCount,
    studentCmdAtFirstMistake:
      firstMistakeStep != null ? student[firstMistakeStep - 1] : undefined,
    referenceCmdAtFirstMistake:
      firstMistakeStep != null
        ? selectedComparisonFix.commands[firstMistakeStep - 1]
        : undefined,
  });

  if (semanticIssue.firstIncorrectStep != null) {
    firstMistakeStep = semanticIssue.firstIncorrectStep;
  }

  const exactIssue =
    semanticIssue.issueType !== "unknown" && semanticIssue.issueType !== "correct"
      ? semanticIssue.teacherMessage
      : diagnosis.exactIssue;
  const robotOutcome =
    semanticIssue.issueType !== "unknown" && semanticIssue.issueType !== "correct"
      ? semanticIssue.robotOutcomeMessage
      : diagnosis.robotOutcome;
  const likelyMistake = semanticIssue.suggestedFix ?? diagnosis.likelyMistake;

  if (semanticIssue.issueType === "passed_goal" && repairStatus === "incorrectFix") {
    repairStatus = "overFix";
  }

  // When the student reached the goal but added extra movement after it (over-fix /
  // passed goal), the clearest reference is the student's OWN program trimmed to the
  // moment it stood on the goal — not an unrelated alternate valid route. This shows
  // "you had it right up to Step N, the rest is extra" instead of a confusing diff.
  let comparisonUsed = comparison.selectedTargetType;
  let comparisonReason = comparison.reasonForSelection;
  let selectedComparisonRoute = [...comparison.selectedTargetProgram];

  const passedGoalOverFix =
    goalRelationship.goalTouched &&
    !goalRelationship.finalStoppedOnGoal &&
    goalRelationship.movedAfterGoal &&
    goalRelationship.firstGoalTouchStep != null &&
    goalRelationship.firstGoalTouchStep > 0;

  if (passedGoalOverFix) {
    const routeToGoal = student.slice(0, goalRelationship.firstGoalTouchStep!);
    if (
      routeToGoal.length > 0 &&
      programStopsOnGoalStrict(task, simulateProgram(task, routeToGoal))
    ) {
      const extraCount = student.length - routeToGoal.length;
      selectedComparisonRoute = routeToGoal;
      comparisonUsed = "studentRouteToGoal";
      comparisonReason =
        extraCount === 1
          ? `Robot reached the ${goalLabel} at Step ${routeToGoal.length}. The command after it is extra and should be removed.`
          : `Robot reached the ${goalLabel} at Step ${routeToGoal.length}. The ${extraCount} commands after it are extra and should be removed.`;
    }
  }

  return {
    bugFixed,
    repairStatus,
    originalProgram: original,
    studentProgram: student,
    preferredWorkingFix,
    closestWorkingFix,
    workingFixOptions: trimWorkingFixOptions(
      original,
      workingFixOptions,
      closestWorkingFix,
      preferredWorkingFix
    ),
    studentFinalPosition: studentSim.finalPosition,
    studentFinalDirection: studentSim.finalDirection,
    goalPosition,
    requiredFinalDirection,
    goalRelationship,
    stoppedOnGoal: goalRelationship.stoppedOnGoal,
    passedThroughGoal: goalRelationship.passedThroughGoal,
    stoppedBeforeGoal: goalRelationship.stoppedBeforeGoal,
    overshotGoal: goalRelationship.overshotGoal,
    undershotGoal: goalRelationship.undershotGoal,
    distanceFromGoal: goalRelationship.distanceFromGoal,
    exactIssue,
    robotOutcome,
    likelyMistake,
    semanticIssue,
    recommendation: REPAIR_RECOMMENDATIONS[repairStatus],
    commandsAdded,
    commandsRemoved,
    commandsChanged,
    commandsReordered: diffOrig.reordered,
    extraCommandsComparedToFix: diffFix.extra,
    missingCommandsComparedToFix: diffFix.missing,
    wrongCommandsComparedToFix: diffFix.wrong,
    wrongOrderComparedToFix: diffFix.wrongOrder,
    detectedMistakeType,
    matchQuality,
    score,
    levelLabel: masteryFromScore(score),
    levelDisplayName: win?.label ? `Fixing a Program — ${win.label}` : "Fixing a Program",
    bugFixedStatus,
    bugFixedDetail,
    firstMistakeStep,
    comparisonUsed,
    comparisonReason,
    comparisonClarityScore: comparison.diagnosisClarityScore,
    selectedComparisonRoute,
  };
}
