/**
 * Smart comparison-target selection — pick the reference route that yields
 * the clearest educational diagnosis (not always shortest or closest).
 */

import type { CommandToken } from "@/lib/command-icons";
import { findFirstCommandMistakeStep } from "@/lib/assessment/program-diff-visual";

export type ComparisonTargetType =
  | "teacherSolution"
  | "shortestValidRoute"
  | "closestValidRoute"
  | "alternateValidRoute"
  /** The student's own program trimmed to where it first stopped on the goal. */
  | "studentRouteToGoal";

export type TaskComparisonSettings = {
  compareWithOptimalRoute?: boolean;
  minimalFixExpected?: boolean;
  hasObstacle?: boolean;
  hasMultipleGoals?: boolean;
  fixedAnswerExpected?: boolean;
};

export type ComparisonCandidate = {
  type: ComparisonTargetType;
  commands: CommandToken[];
  path?: { x: number; y: number }[];
  isShortest?: boolean;
  extendsStarter?: boolean;
};

export type ComparisonTargetResult = {
  selectedTargetType: ComparisonTargetType;
  selectedTargetProgram: CommandToken[];
  reasonForSelection: string;
  diagnosisClarityScore: number;
  closestValidRoute: CommandToken[];
  shortestValidRoute: CommandToken[];
  teacherSolution: CommandToken[] | null;
};

export function comparisonTargetLabel(type: ComparisonTargetType): string {
  switch (type) {
    case "teacherSolution":
      return "The expected answer";
    case "shortestValidRoute":
      return "Best (shortest) way";
    case "closestValidRoute":
      return "Closest correct way";
    case "alternateValidRoute":
      return "Another correct way";
    case "studentRouteToGoal":
      return "Student's route up to the goal";
  }
}

function isTurn(c: CommandToken | undefined): boolean {
  return c === "turn left" || c === "turn right";
}

function sharedPrefixLength(a: CommandToken[], b: CommandToken[]): number {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) i++;
  return i;
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
  return dp[n][m] / Math.max(n, m, 1);
}

function commandLengthSimilarity(student: CommandToken[], candidate: CommandToken[]): number {
  const diff = Math.abs(student.length - candidate.length);
  return 1 - diff / Math.max(student.length, candidate.length, 1);
}

function countMismatchesAfter(
  student: CommandToken[],
  candidate: CommandToken[],
  fromIndex: number
): number {
  const maxLen = Math.max(student.length, candidate.length);
  let count = 0;
  for (let i = fromIndex; i < maxLen; i++) {
    if (student[i] !== candidate[i]) count++;
  }
  return count;
}

function singleMistakeExplainability(
  student: CommandToken[],
  candidate: CommandToken[],
  original?: CommandToken[]
): number {
  const step = findFirstCommandMistakeStep(student, candidate);
  if (step == null) {
    return student.length === candidate.length ? 1 : 0.55;
  }

  const idx = step - 1;
  const s = student[idx];
  const c = candidate[idx];
  if (s === undefined || c === undefined) {
    return student.length < candidate.length ? 0.72 : 0.5;
  }

  if (isTurn(s) && isTurn(c) && s !== c) return 1;

  if (isTurn(s) && (c === "forward" || c === "backward")) {
    const starterTurnTouched =
      original &&
      (original.some(isTurn) ||
        sharedPrefixLength(original, student) < step ||
        isTurn(original[idx]));
    if (starterTurnTouched || step <= 3) return 0.88;
    return 0.72;
  }

  if (Math.abs(student.length - candidate.length) <= 1 && step <= 3 && s !== c) {
    return isTurn(s) || isTurn(c) ? 0.82 : 0.78;
  }

  const tail = countMismatchesAfter(student, candidate, idx);
  if (tail === 1) return 0.8;
  if (tail === 2) return 0.62;
  return Math.max(0.25, 0.55 - tail * 0.08);
}

function teacherSimplicityScore(
  type: ComparisonTargetType,
  settings?: TaskComparisonSettings
): number {
  if (type === "teacherSolution") {
    return settings?.fixedAnswerExpected ? 1 : 0.88;
  }
  if (type === "shortestValidRoute" && settings?.compareWithOptimalRoute) {
    return 0.92;
  }
  if (type === "shortestValidRoute") return 0.55;
  return 0.42;
}

function scoreCandidate(params: {
  student: CommandToken[];
  candidate: ComparisonCandidate;
  original?: CommandToken[];
  shortestCommands: CommandToken[];
  settings?: TaskComparisonSettings;
}): number {
  const { student, candidate, original, shortestCommands, settings } = params;
  const cmds = candidate.commands;
  if (cmds.length === 0) return -1;

  const explain = singleMistakeExplainability(student, cmds, original);
  const prefix =
    sharedPrefixLength(student, cmds) / Math.max(student.length, cmds.length, 1);
  const lenSim = commandLengthSimilarity(student, cmds);
  const shape = programSimilarity(student, cmds);
  const teacher = teacherSimplicityScore(candidate.type, settings);

  let score =
    0.3 * explain +
    0.25 * prefix +
    0.2 * lenSim +
    0.15 * shape +
    0.1 * teacher;

  const firstStep = findFirstCommandMistakeStep(student, cmds);
  const firstIdx = firstStep != null ? firstStep - 1 : -1;
  const s0 = firstIdx >= 0 ? student[firstIdx] : undefined;
  const c0 = firstIdx >= 0 ? cmds[firstIdx] : undefined;

  if (
    candidate.type === "shortestValidRoute" &&
    lenSim >= 0.8 &&
    explain >= 0.75 &&
    isTurn(s0) &&
    isTurn(c0) &&
    s0 !== c0
  ) {
    score += 0.22;
  }

  if (
    candidate.type === "shortestValidRoute" &&
    lenSim >= 0.85 &&
    explain >= 0.7 &&
    student.length <= shortestCommands.length + 1
  ) {
    score += 0.12;
  }

  if (
    candidate.extendsStarter &&
    original &&
    candidate.type !== "shortestValidRoute"
  ) {
    const starterPrefix = sharedPrefixLength(original, student) / Math.max(original.length, 1);
    const muchLongerThanShortest = student.length > shortestCommands.length + 2;
    if (starterPrefix >= 0.45 && muchLongerThanShortest) {
      score += 0.18;
    } else if (starterPrefix >= 0.35) {
      score += 0.08;
    }
  }

  if (
    candidate.type === "closestValidRoute" &&
    candidate.extendsStarter &&
    student.length > shortestCommands.length + 2 &&
    lenSim < 0.75
  ) {
    score += 0.1;
  }

  const tailMismatches =
    firstIdx >= 0 ? countMismatchesAfter(student, cmds, firstIdx) : 0;
  if (
    candidate.type === "shortestValidRoute" &&
    tailMismatches >= 4 &&
    student.length + 2 < cmds.length
  ) {
    score -= 0.25;
  }

  if (settings?.hasObstacle && candidate.type === "alternateValidRoute") {
    score += 0.06;
  }

  if (settings?.hasMultipleGoals && candidate.type === "alternateValidRoute") {
    score += 0.05;
  }

  return score;
}

function buildSelectionReason(params: {
  type: ComparisonTargetType;
  student: CommandToken[];
  selected: CommandToken[];
  shortest: CommandToken[];
  original?: CommandToken[];
}): string {
  const { type, student, selected, shortest, original } = params;
  const step = findFirstCommandMistakeStep(student, selected);
  const lenClose = commandLengthSimilarity(student, shortest) >= 0.85;
  const explain = singleMistakeExplainability(student, selected, original);

  if (type === "teacherSolution") {
    return "Used teacher solution because this level has one expected repair.";
  }

  if (type === "shortestValidRoute") {
    if (step != null && explain >= 0.85) {
      const idx = step - 1;
      const s = student[idx];
      const c = selected[idx];
      if (isTurn(s) && isTurn(c) && s !== c) {
        return "Used shortest route because it shows one clear wrong turn.";
      }
    }
    if (lenClose) {
      return "Used shortest route because the student program is close in length and one command explains the error.";
    }
    return "Used shortest route because it gives the simplest explanation.";
  }

  if (type === "closestValidRoute") {
    if (original && sharedPrefixLength(original, student) >= 2) {
      return "Used closest valid route because the student followed a longer but meaningful path from the starter.";
    }
    return "Used closest valid route because it best matches how the student built their program.";
  }

  return "Used an alternate valid route because the shortest path would label too many steps as wrong.";
}

function dedupeCandidates(candidates: ComparisonCandidate[]): ComparisonCandidate[] {
  const out: ComparisonCandidate[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    if (c.commands.length === 0) continue;
    const sig = c.commands.join("|");
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(c);
  }
  return out;
}

export function chooseComparisonTarget(params: {
  studentProgram: CommandToken[];
  originalProgram?: CommandToken[];
  teacherSolution?: CommandToken[] | null;
  shortestValidRoute: CommandToken[];
  closestValidRoute: CommandToken[];
  alternateValidRoutes?: CommandToken[][];
  candidates?: ComparisonCandidate[];
  taskSettings?: TaskComparisonSettings;
}): ComparisonTargetResult {
  const student = params.studentProgram;
  const shortest = [...params.shortestValidRoute];
  const closest = [...params.closestValidRoute];
  const teacher = params.teacherSolution?.length
    ? [...params.teacherSolution]
    : null;

  const built: ComparisonCandidate[] = params.candidates ? [...params.candidates] : [];

  if (teacher?.length) {
    built.push({ type: "teacherSolution", commands: teacher });
  }
  if (shortest.length) {
    built.push({
      type: "shortestValidRoute",
      commands: shortest,
      isShortest: true,
    });
  }
  if (closest.length && closest.join("|") !== shortest.join("|")) {
    built.push({
      type: "closestValidRoute",
      commands: closest,
      extendsStarter: params.originalProgram
        ? candidateExtendsStarter(params.originalProgram, closest)
        : false,
    });
  } else if (closest.length && !built.some((c) => c.type === "closestValidRoute")) {
    built.push({ type: "closestValidRoute", commands: closest });
  }

  for (const alt of params.alternateValidRoutes ?? []) {
    if (alt.length === 0) continue;
    const sig = alt.join("|");
    if (sig === shortest.join("|") || sig === closest.join("|")) continue;
    built.push({
      type: "alternateValidRoute",
      commands: [...alt],
      extendsStarter: params.originalProgram
        ? candidateExtendsStarter(params.originalProgram, alt)
        : false,
    });
  }

  const pool = dedupeCandidates(built);
  if (pool.length === 0) {
    return {
      selectedTargetType: "shortestValidRoute",
      selectedTargetProgram: shortest,
      reasonForSelection: "No valid comparison routes were found.",
      diagnosisClarityScore: 0,
      closestValidRoute: closest,
      shortestValidRoute: shortest,
      teacherSolution: teacher,
    };
  }

  let best = pool[0];
  let bestScore = -Infinity;

  for (const candidate of pool) {
    const score = scoreCandidate({
      student,
      candidate,
      original: params.originalProgram,
      shortestCommands: shortest,
      settings: params.taskSettings,
    });
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  const reason = buildSelectionReason({
    type: best.type,
    student,
    selected: best.commands,
    shortest,
    original: params.originalProgram,
  });

  return {
    selectedTargetType: best.type,
    selectedTargetProgram: [...best.commands],
    reasonForSelection: reason,
    diagnosisClarityScore: Math.round(bestScore * 100) / 100,
    closestValidRoute: closest,
    shortestValidRoute: shortest,
    teacherSolution: teacher,
  };
}

export function candidateExtendsStarter(
  starter: CommandToken[],
  candidate: CommandToken[]
): boolean {
  return (
    candidate.length >= starter.length &&
    starter.every((c, i) => candidate[i] === c)
  );
}

export function buildComparisonCandidatesFromFixOptions(
  options: {
    commands: CommandToken[];
    isShortest?: boolean;
    reachesGoalExactly?: boolean;
  }[],
  params: {
    originalProgram?: CommandToken[];
    teacherSolution?: CommandToken[] | null;
    shortestCommands: CommandToken[];
    closestCommands: CommandToken[];
  }
): ComparisonCandidate[] {
  const { originalProgram, teacherSolution, shortestCommands, closestCommands } = params;
  const out: ComparisonCandidate[] = [];
  const teacherSig = teacherSolution?.join("|") ?? "";
  const shortestSig = shortestCommands.join("|");
  const closestSig = closestCommands.join("|");

  for (const opt of options) {
    if (opt.reachesGoalExactly === false) continue;
    const sig = opt.commands.join("|");
    let type: ComparisonTargetType = "alternateValidRoute";
    if (teacherSig && sig === teacherSig) type = "teacherSolution";
    else if (sig === shortestSig || opt.isShortest) type = "shortestValidRoute";
    else if (sig === closestSig) type = "closestValidRoute";

    out.push({
      type,
      commands: [...opt.commands],
      isShortest: opt.isShortest ?? sig === shortestSig,
      extendsStarter: originalProgram
        ? candidateExtendsStarter(originalProgram, opt.commands)
        : false,
    });
  }

  return out;
}
