/**
 * Visual program diff alignment for debugging dashboard (client-safe).
 */

import type { CommandToken } from "@/lib/command-icons";
import { COMMAND_ARIA_LABELS } from "@/lib/command-icons";
import type { Vec2 } from "@/lib/assessment/assessmentTypes";

export type DiffSlotStatus =
  | "match"
  | "correct"
  | "added"
  | "removed"
  | "changed"
  | "missing"
  | "extra"
  | "divergence"
  | "wrong"
  | "wrongLater"
  | "afterFirstMistake"
  | "hitObstacle";

export type CommandChipLabel =
  | "First mistake"
  | "Wrong command"
  | "Wrong turn"
  | "Extra command"
  | "Extra Forward"
  | "Extra Backward"
  | "Extra Turn left"
  | "Extra Turn right"
  | "Hit obstacle"
  | "Wrong order"
  | "Stopped early"
  | "Passed goal";

/** Command-specific "Extra …" chip label, e.g. "Extra Forward". */
export function extraCommandChipLabel(cmd: CommandToken | undefined): CommandChipLabel {
  switch (cmd) {
    case "forward":
      return "Extra Forward";
    case "backward":
      return "Extra Backward";
    case "turn left":
      return "Extra Turn left";
    case "turn right":
      return "Extra Turn right";
    default:
      return "Extra command";
  }
}

export type ProgramDiffSlot = {
  status: DiffSlotStatus;
  command?: CommandToken;
  from?: CommandToken;
  to?: CommandToken;
  /** 1-based command step for movement linking */
  step: number;
  tooltip: string;
  /** Short teacher-facing label under the chip */
  chipLabel?: CommandChipLabel;
};

export type StudentProgramDisplay = {
  slots: ProgramDiffSlot[];
  missingSummary: string | null;
};

export type ProgramDiffAlignment = {
  slots: ProgramDiffSlot[];
  addedCount: number;
  removedCount: number;
  changedCount: number;
};

function lcsAlign(reference: CommandToken[], compare: CommandToken[]) {
  const n = reference.length;
  const m = compare.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] =
        reference[i - 1] === compare[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const ops: { type: "keep" | "del" | "ins"; oi?: number; si?: number }[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && reference[i - 1] === compare[j - 1]) {
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
  return ops;
}

/** Align `compare` program against `reference` for visual diff chips. */
export function alignProgramsForDiff(
  reference: CommandToken[],
  compare: CommandToken[],
  options?: { markDivergenceFromStep?: number | null }
): ProgramDiffAlignment {
  const ops = lcsAlign(reference, compare);
  const slots: ProgramDiffSlot[] = [];
  let addedCount = 0;
  let removedCount = 0;
  let changedCount = 0;
  let step = 0;

  for (let k = 0; k < ops.length; k++) {
    const op = ops[k];
    if (op.type === "keep") {
      step++;
      const cmd = compare[op.si!];
      const isDivergence =
        options?.markDivergenceFromStep != null && step >= options.markDivergenceFromStep;
      slots.push({
        status: isDivergence ? "divergence" : "match",
        command: cmd,
        step,
        tooltip: isDivergence
          ? firstMistakeCommandTooltip(step, COMMAND_ARIA_LABELS[cmd])
          : `Step ${step}: ${COMMAND_ARIA_LABELS[cmd]}`,
      });
    } else if (op.type === "ins") {
      const next = ops[k + 1];
      if (next?.type === "del") {
        step++;
        changedCount++;
        const from = reference[next.oi!];
        const to = compare[op.si!];
        const isDivergence =
          options?.markDivergenceFromStep != null && step >= options.markDivergenceFromStep;
        slots.push({
          status: isDivergence ? "divergence" : "changed",
          from,
          to,
          command: to,
          step,
          tooltip: isDivergence
            ? `Step ${step}: changed ${COMMAND_ARIA_LABELS[from]} to ${COMMAND_ARIA_LABELS[to]} — first incorrect movement`
            : `Step ${step}: changed ${COMMAND_ARIA_LABELS[from]} to ${COMMAND_ARIA_LABELS[to]}`,
        });
        k++;
      } else {
        step++;
        addedCount++;
        const cmd = compare[op.si!];
        const isDivergence =
          options?.markDivergenceFromStep != null && step >= options.markDivergenceFromStep;
        slots.push({
          status: isDivergence ? "divergence" : "added",
          command: cmd,
          step,
          tooltip: isDivergence
            ? `Step ${step}: added ${COMMAND_ARIA_LABELS[cmd]} — extra movement`
            : `Step ${step}: added ${COMMAND_ARIA_LABELS[cmd]}`,
        });
      }
    } else if (op.type === "del") {
      removedCount++;
      const cmd = reference[op.oi!];
      slots.push({
        status: "missing",
        command: cmd,
        from: cmd,
        step: step + 1,
        tooltip: `Missing ${COMMAND_ARIA_LABELS[cmd]}`,
      });
    }
  }

  return { slots, addedCount, removedCount, changedCount };
}

/** Baseline slots for original program (neutral display). */
export function baselineProgramSlots(commands: CommandToken[]): ProgramDiffSlot[] {
  return commands.map((cmd, i) => ({
    status: "match" as const,
    command: cmd,
    step: i + 1,
    tooltip: `Step ${i + 1}: ${COMMAND_ARIA_LABELS[cmd]}`,
  }));
}

/** Reference fix slots (all correct/green). */
export function referenceFixSlots(commands: CommandToken[]): ProgramDiffSlot[] {
  return commands.map((cmd, i) => ({
    status: "correct" as const,
    command: cmd,
    step: i + 1,
    tooltip: `Step ${i + 1}: ${COMMAND_ARIA_LABELS[cmd]} (working fix)`,
  }));
}

/**
 * First 1-based command step where the student program differs from the reference.
 * Use this for teacher-facing “first mistake” — wrong turns are caught here (path
 * divergence often lags by one step because turns do not change position).
 */
export function findFirstCommandMistakeStep(
  student: CommandToken[],
  reference: CommandToken[]
): number | null {
  const maxLen = Math.max(student.length, reference.length);
  for (let i = 0; i < maxLen; i++) {
    const s = student[i];
    const r = reference[i];
    if (s === undefined || r === undefined || s !== r) {
      return i + 1;
    }
  }
  return null;
}

/**
 * First 1-based command step for UI labels — obstacle hit, then command diff, then path.
 */
export function resolveFirstMistakeStep(params: {
  student: CommandToken[];
  reference: CommandToken[];
  studentPath: Vec2[];
  referencePath: Vec2[];
  firstObstacleMistakeStep?: number | null;
}): number | null {
  if (params.firstObstacleMistakeStep != null) {
    return params.firstObstacleMistakeStep;
  }
  const commandStep = findFirstCommandMistakeStep(params.student, params.reference);
  if (commandStep != null) {
    return commandStep;
  }
  return findFirstPathDivergence(params.referencePath, params.studentPath);
}

/**
 * First 1-based command step where the student path leaves the correct path.
 * path[0] is start; path[i] is position after command i.
 */
export function findFirstPathDivergence(
  referencePath: Vec2[],
  studentPath: Vec2[]
): number | null {
  if (referencePath.length === 0 || studentPath.length === 0) return null;
  const minLen = Math.min(referencePath.length, studentPath.length);
  for (let i = 1; i < minLen; i++) {
    if (
      referencePath[i].x !== studentPath[i].x ||
      referencePath[i].y !== studentPath[i].y
    ) {
      return i;
    }
  }
  if (studentPath.length > referencePath.length) {
    return referencePath.length;
  }
  return null;
}

export type FirstMistakeStepInfo = {
  step: number;
  /** Single teacher-facing line, e.g. "First mistake at Step 4". */
  label: string;
  pathMapSubtitle: string;
};

/** Where the student's repair first went wrong (one short line). */
export function buildFirstMistakeMessages(
  step: number | null,
  options?: {
    studentLength?: number;
    repairStatus?: string;
    passedGoal?: boolean;
    suppressMissingAfterStep?: boolean;
  }
): FirstMistakeStepInfo | null {
  if (step == null) return null;
  if (options?.passedGoal) {
    const label = "Extra movement after goal";
    return {
      step,
      label,
      pathMapSubtitle: `First extra command at Step ${step}`,
    };
  }
  if (
    options?.studentLength != null &&
    step > options.studentLength &&
    options.studentLength > 0 &&
    !options?.suppressMissingAfterStep
  ) {
    const label = `Missing command after Step ${options.studentLength}`;
    return {
      step,
      label,
      pathMapSubtitle: label,
    };
  }
  const label =
    options?.repairStatus === "wrongTurnFix"
      ? `Wrong turn at Step ${step}`
      : `First mistake at Step ${step}`;
  return {
    step,
    label,
    pathMapSubtitle: label,
  };
}

function isTurnToken(c: CommandToken): boolean {
  return c === "turn left" || c === "turn right";
}

function isMovementToken(c: CommandToken): boolean {
  return c === "forward" || c === "backward";
}

export type StepCommandMismatchKind =
  | "wrong_turn"
  | "turn_instead_of_forward"
  | "forward_instead_of_turn"
  | "wrong_command";

/** Classify a single-step student vs reference command mismatch. */
export function classifyStepCommandMismatch(
  studentCmd: CommandToken,
  refCmd: CommandToken
): StepCommandMismatchKind | null {
  if (studentCmd === refCmd) return null;
  if (isTurnToken(studentCmd) && isTurnToken(refCmd)) return "wrong_turn";
  if (isTurnToken(studentCmd) && isMovementToken(refCmd)) return "turn_instead_of_forward";
  if (isMovementToken(studentCmd) && isTurnToken(refCmd)) return "forward_instead_of_turn";
  return "wrong_command";
}

/** Chip label for the first incorrect command at a step. */
export function commandMismatchChipLabel(
  studentCmd: CommandToken,
  refCmd: CommandToken | undefined
): CommandChipLabel | null {
  if (!refCmd || studentCmd === refCmd) return null;
  if (classifyStepCommandMismatch(studentCmd, refCmd) === "wrong_turn") {
    return "Wrong turn";
  }
  return "Wrong command";
}

function firstMistakeChipLabel(
  cmd: CommandToken,
  ref: CommandToken | undefined,
  issueHints?: {
    passedGoal?: boolean;
    stoppedEarly?: boolean;
    wrongOrder?: boolean;
  }
): CommandChipLabel {
  if (ref != null && cmd === ref) return "First mistake";
  const chip = commandMismatchChipLabel(cmd, ref);
  if (chip) return chip;
  if (issueHints?.passedGoal) return "Passed goal";
  if (issueHints?.wrongOrder) return "Wrong order";
  if (ref != null && cmd !== ref) return "Wrong command";
  if (issueHints?.stoppedEarly) return "Stopped early";
  return "First mistake";
}

/**
 * Student-only program row for Programs Compared — no blank missing slots.
 */
export function buildStudentProgramDisplay(params: {
  student: CommandToken[];
  reference: CommandToken[];
  firstMistakeStep: number | null;
  obstacleSteps?: number[];
  softenAfterFirstMistake?: boolean;
  suppressMissingSummary?: boolean;
  highlightExtraAfterGoalStep?: number | null;
  issueHints?: {
    passedGoal?: boolean;
    stoppedEarly?: boolean;
    wrongOrder?: boolean;
  };
}): StudentProgramDisplay {
  const {
    student,
    reference,
    firstMistakeStep,
    obstacleSteps = [],
    softenAfterFirstMistake = true,
    suppressMissingSummary = false,
    highlightExtraAfterGoalStep = null,
    issueHints,
  } = params;
  const obstacleSet = new Set(obstacleSteps);
  const slots: ProgramDiffSlot[] = [];

  for (let i = 0; i < student.length; i++) {
    const step = i + 1;
    const cmd = student[i];
    const ref = reference[i];
    let status: DiffSlotStatus;
    let chipLabel: CommandChipLabel | undefined;
    let tooltip: string;

    if (obstacleSet.has(step)) {
      status = "hitObstacle";
      chipLabel = "Hit obstacle";
      tooltip = "This command tried to move the robot into a blocked space.";
    } else if (
      highlightExtraAfterGoalStep != null &&
      step < highlightExtraAfterGoalStep
    ) {
      // Robot reached the goal on an earlier step — do not diff against a longer alternate route.
      status = "correct";
      tooltip =
        step === highlightExtraAfterGoalStep - 1
          ? `Step ${step}: ${COMMAND_ARIA_LABELS[cmd]} — reached the goal`
          : `Step ${step}: ${COMMAND_ARIA_LABELS[cmd]} (correct)`;
    } else if (highlightExtraAfterGoalStep != null && step === highlightExtraAfterGoalStep) {
      status = "wrong";
      chipLabel = extraCommandChipLabel(cmd);
      tooltip = `Extra ${COMMAND_ARIA_LABELS[cmd]} after reaching the goal — should be removed.`;
    } else if (
      highlightExtraAfterGoalStep != null &&
      step > highlightExtraAfterGoalStep
    ) {
      status = "afterFirstMistake";
      tooltip = `Step ${step}: after extra movement at Step ${highlightExtraAfterGoalStep}.`;
    } else if (ref != null && cmd === ref) {
      status = "correct";
      tooltip = `Step ${step}: ${COMMAND_ARIA_LABELS[cmd]} (correct)`;
    } else if (step === firstMistakeStep) {
      status = "wrong";
      if (ref == null && i >= reference.length) {
        chipLabel = extraCommandChipLabel(cmd);
        tooltip = `Extra ${COMMAND_ARIA_LABELS[cmd]} at Step ${step}`;
      } else {
        chipLabel = firstMistakeChipLabel(cmd, ref, issueHints);
        if (chipLabel === "Wrong turn" && ref) {
          tooltip = `Used ${COMMAND_ARIA_LABELS[cmd]}, expected ${COMMAND_ARIA_LABELS[ref]}`;
        } else if (chipLabel === "Passed goal") {
          tooltip = `Step ${step}: robot passed the goal`;
        } else if (chipLabel === "Stopped early") {
          tooltip = `Step ${step}: stopped before the goal`;
        } else if (chipLabel === "Wrong order") {
          tooltip = `Step ${step}: commands out of order`;
        } else {
          tooltip = ref
            ? `Used ${COMMAND_ARIA_LABELS[cmd]}, expected ${COMMAND_ARIA_LABELS[ref]}`
            : `Unexpected command at Step ${step}`;
        }
      }
    } else if (
      softenAfterFirstMistake &&
      firstMistakeStep != null &&
      step > firstMistakeStep &&
      (ref == null || cmd !== ref)
    ) {
      status = "afterFirstMistake";
      tooltip = `Step ${step}: after the first incorrect command at Step ${firstMistakeStep}.`;
    } else if (ref == null || cmd !== ref) {
      status = "wrongLater";
      if (i >= reference.length) {
        chipLabel = extraCommandChipLabel(cmd);
        tooltip = `Extra ${COMMAND_ARIA_LABELS[cmd]} at Step ${step}`;
      } else {
        chipLabel = commandMismatchChipLabel(cmd, ref) ?? "Wrong command";
        tooltip = ref
          ? `Used ${COMMAND_ARIA_LABELS[cmd]}, expected ${COMMAND_ARIA_LABELS[ref]}`
          : `Unexpected command at Step ${step}`;
      }
    } else {
      status = "correct";
      tooltip = `Step ${step}: ${COMMAND_ARIA_LABELS[cmd]}`;
    }

    slots.push({
      status,
      command: cmd,
      step,
      tooltip,
      chipLabel,
      from: ref,
      to: cmd,
    });
  }

  let missingSummary: string | null = null;
  if (!suppressMissingSummary && student.length < reference.length) {
    const missingCmd = reference[student.length];
    if (missingCmd) {
      const after = student.length;
      missingSummary =
        after === 0
          ? `Missing: ${COMMAND_ARIA_LABELS[missingCmd]} at the start`
          : `Missing: ${COMMAND_ARIA_LABELS[missingCmd]} after Step ${after}`;
    }
  }

  return { slots, missingSummary };
}

export function firstMistakeCommandTooltip(step: number, commandLabel: string): string {
  return `Step ${step}: ${commandLabel} — first incorrect movement`;
}

export function programsEqual(a: CommandToken[], b: CommandToken[]): boolean {
  return a.length === b.length && a.every((c, i) => c === b[i]);
}

export type RepairQualityLevel =
  | "Exact Repair"
  | "Efficient Repair"
  | "Alternate Valid Repair"
  | "Close Repair"
  | "Partial Repair"
  | "Incorrect Repair"
  | "No Repair";

/** @deprecated Use RepairQualityLevel */
export type RepairQualityLabel = RepairQualityLevel;

export type RepairQualityMeta = {
  level: RepairQualityLevel;
  dotClass: string;
  cardGradient: string;
  borderClass: string;
  textClass: string;
};

export const REPAIR_QUALITY_META: Record<RepairQualityLevel, RepairQualityMeta> = {
  "Exact Repair": {
    level: "Exact Repair",
    dotClass: "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]",
    cardGradient: "from-green-500/12 via-white to-emerald-50/40",
    borderClass: "border-green-200/70",
    textClass: "text-green-900",
  },
  "Efficient Repair": {
    level: "Efficient Repair",
    dotClass: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.55)]",
    cardGradient: "from-emerald-500/12 via-white to-emerald-50/30",
    borderClass: "border-emerald-200/70",
    textClass: "text-emerald-900",
  },
  "Alternate Valid Repair": {
    level: "Alternate Valid Repair",
    dotClass: "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]",
    cardGradient: "from-blue-500/10 via-white to-sky-50/40",
    borderClass: "border-blue-200/70",
    textClass: "text-blue-900",
  },
  "Close Repair": {
    level: "Close Repair",
    dotClass: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]",
    cardGradient: "from-amber-500/10 via-white to-amber-50/35",
    borderClass: "border-amber-200/70",
    textClass: "text-amber-950",
  },
  "Partial Repair": {
    level: "Partial Repair",
    dotClass: "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.45)]",
    cardGradient: "from-orange-500/10 via-white to-orange-50/30",
    borderClass: "border-orange-200/70",
    textClass: "text-orange-950",
  },
  "Incorrect Repair": {
    level: "Incorrect Repair",
    dotClass: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.45)]",
    cardGradient: "from-red-500/8 via-white to-red-50/25",
    borderClass: "border-red-200/60",
    textClass: "text-red-900",
  },
  "No Repair": {
    level: "No Repair",
    dotClass: "bg-slate-400",
    cardGradient: "from-slate-200/40 via-white to-slate-50/50",
    borderClass: "border-slate-200/80",
    textClass: "text-slate-700",
  },
};

export type RepairInsightChips = {
  issue: string;
  robotResult: string;
  repairAction: string;
  difference: string;
  bugLocation: string | null;
};

export type GoalOutcomeHeadline = {
  label: string;
  detail: string;
  tone: "success" | "warning" | "danger";
};

export function resolveRepairQuality(params: {
  repairStatus: string;
  bugFixed: boolean;
  score: number;
  studentProgram: CommandToken[];
  preferredFix: CommandToken[] | null;
  programsEqualStarter: boolean;
}): RepairQualityLevel {
  const { repairStatus, bugFixed, studentProgram, preferredFix, programsEqualStarter } =
    params;

  if (programsEqualStarter || repairStatus === "noRepair") {
    return "No Repair";
  }

  if (bugFixed && preferredFix) {
    if (programsEqual(studentProgram, preferredFix)) {
      return "Exact Repair";
    }
    if (studentProgram.length <= preferredFix.length) {
      return "Efficient Repair";
    }
    return "Alternate Valid Repair";
  }

  if (repairStatus === "partialFix") return "Partial Repair";

  if (
    repairStatus === "overFix" ||
    repairStatus === "underFix" ||
    repairStatus === "wrongTurnFix" ||
    (params.score >= 50 && !bugFixed)
  ) {
    return "Close Repair";
  }

  return "Incorrect Repair";
}

/** @deprecated Use resolveRepairQuality */
export function repairQualityLabel(params: {
  repairStatus: string;
  bugFixed: boolean;
  score: number;
  studentProgram: CommandToken[];
  preferredFix: CommandToken[] | null;
}): RepairQualityLevel {
  return resolveRepairQuality({
    ...params,
    programsEqualStarter: false,
  });
}

function shortenIssue(exactIssue: string): string {
  let s = exactIssue.replace(/^Student /i, "").replace(/\.$/, "");
  if (/continued (moving|after)/i.test(s) || /reached the goal but continued/i.test(s)) {
    return "Passed goal";
  }
  if (/extra movement after/i.test(s)) return "Extra movement";
  if (s.includes("extra Forward")) return "Extra Forward";
  if (
    s.includes("missing Forward") ||
    s.includes("did not add") ||
    (s.includes("needed") && /forward/i.test(s))
  ) {
    return "Missing Forward";
  }
  if (/instead of.*turn/i.test(s) || (s.includes("Turn Left") && s.includes("Turn Right"))) {
    return "Wrong turn";
  }
  if (/used Turn (Left|Right) at Step/i.test(s) || /where Forward was needed/i.test(s)) {
    return "Wrong turn";
  }
  if (/changed Turn (Left|Right) to Turn/i.test(s)) return "Wrong turn";
  if (s.includes("wrong order")) return "Wrong order";
  if (s.includes("did not change")) return "No edit";
  if (s.length > 32) s = s.slice(0, 30) + "…";
  return s;
}

function repairActionLabel(params: {
  commandsAdded: { label: string }[];
  commandsChanged: { label: string }[];
  commandsRemoved: { label: string }[];
  commandsReordered: boolean;
}): string {
  if (params.commandsReordered && params.commandsAdded.length === 0) {
    return "Reordered commands";
  }
  if (params.commandsAdded.length > 0) {
    const m = params.commandsAdded[0].label.match(/Added (\w+(?:\s+\w+)?)/i);
    return m ? `Added ${m[1]}` : params.commandsAdded[0].label;
  }
  if (params.commandsChanged.length > 0) {
    const m = params.commandsChanged[0].label.match(/Changed (.+?) →/);
    return m ? `Changed ${m[1]}` : "Changed command";
  }
  if (params.commandsRemoved.length > 0) return "Removed command";
  return "Edited program";
}

export function buildRepairInsights(input: {
  exactIssue: string;
  robotOutcome: string;
  bugFixed: boolean;
  passedThroughGoal: boolean;
  stoppedBeforeGoal: boolean;
  distanceFromGoal: number;
  repairStatus: string;
  editDistance: number;
  commandsAdded: { label: string }[];
  commandsChanged: { label: string }[];
  commandsRemoved: { label: string }[];
  commandsReordered: boolean;
  extraCommandsComparedToFix: CommandToken[];
  missingCommandsComparedToFix: CommandToken[];
  divergenceStep: number | null;
  studentProgram: CommandToken[];
  preferredFix: CommandToken[] | null;
  semanticIssue?: {
    primaryIssue: string;
    robotOutcomeMessage: string;
    firstIncorrectStep: number | null;
    teacherMessage: string;
  };
}): RepairInsightChips {
  if (input.semanticIssue) {
    return {
      issue: input.semanticIssue.primaryIssue,
      robotResult: input.semanticIssue.robotOutcomeMessage,
      repairAction: repairActionLabel(input),
      difference:
        input.studentProgram.length - (input.preferredFix?.length ?? 0) > 0
          ? `+${input.studentProgram.length - (input.preferredFix?.length ?? 0)} command(s)`
          : input.editDistance > 0
            ? `${input.editDistance} edit${input.editDistance === 1 ? "" : "s"}`
            : "Same length",
      bugLocation: input.semanticIssue.firstIncorrectStep
        ? `Step ${input.semanticIssue.firstIncorrectStep}`
        : input.divergenceStep != null
          ? `Step ${input.divergenceStep}`
          : null,
    };
  }

  let robotResult = "Off goal";
  if (input.bugFixed) robotResult = "On goal";
  else if (input.passedThroughGoal) robotResult = "Passed goal";
  else if (input.stoppedBeforeGoal) robotResult = "Stopped early";
  else if (input.repairStatus === "wrongDirectionFix") robotResult = "Wrong direction";
  else if (input.distanceFromGoal > 0) robotResult = `${input.distanceFromGoal} off`;

  let difference = "Same length";
  const fixLen = input.preferredFix?.length ?? 0;
  const delta = input.studentProgram.length - fixLen;
  if (delta > 0) difference = `+${delta} command${delta === 1 ? "" : "s"}`;
  else if (delta < 0) difference = `${delta} command${delta === -1 ? "" : "s"}`;
  else if (input.editDistance > 0) difference = `${input.editDistance} edit${input.editDistance === 1 ? "" : "s"}`;

  return {
    issue: shortenIssue(input.exactIssue),
    robotResult,
    repairAction: repairActionLabel(input),
    difference,
    bugLocation:
      input.divergenceStep != null ? `Step ${input.divergenceStep}` : null,
  };
}

export function goalOutcomeHeadline(input: {
  bugFixed: boolean;
  passedThroughGoal: boolean;
  stoppedBeforeGoal: boolean;
  distanceFromGoal: number;
  repairStatus: string;
  goalLabel: string;
}): GoalOutcomeHeadline {
  if (input.bugFixed) {
    return {
      label: "Stopped on goal",
      detail: `Robot stopped on the ${input.goalLabel}.`,
      tone: "success",
    };
  }
  if (input.repairStatus === "wrongDirectionFix") {
    return {
      label: "Wrong direction",
      detail: "Reached the goal cell but ended facing the wrong way.",
      tone: "warning",
    };
  }
  if (input.passedThroughGoal) {
    const extra =
      input.distanceFromGoal > 0
        ? ` by ${input.distanceFromGoal} square${input.distanceFromGoal === 1 ? "" : "s"}`
        : "";
    return {
      label: "Passed goal",
      detail: `Robot crossed the ${input.goalLabel} but did not stop on it${extra}.`,
      tone: "warning",
    };
  }
  if (input.stoppedBeforeGoal) {
    return {
      label: "Stopped before goal",
      detail: `${input.distanceFromGoal} step${input.distanceFromGoal === 1 ? "" : "s"} short of the ${input.goalLabel}.`,
      tone: "warning",
    };
  }
  return {
    label: "Did not reach goal",
    detail: `Robot did not stop on the ${input.goalLabel}.`,
    tone: "danger",
  };
}

export function repairQualityExplanation(
  level: RepairQualityLevel,
  ctx: {
    bugFixed: boolean;
    passedThroughGoal: boolean;
    stoppedBeforeGoal: boolean;
    repairStatus: string;
  }
): string {
  switch (level) {
    case "Exact Repair":
      return "Student repaired the issue and the robot stopped on the goal.";
    case "Efficient Repair":
      return "Student fixed the program with a concise solution that reaches the goal.";
    case "Alternate Valid Repair":
      return "Student used a different valid program that still solves the level.";
    case "Close Repair":
      if (ctx.passedThroughGoal) {
        return "Student was close but the robot passed the goal without stopping.";
      }
      if (ctx.stoppedBeforeGoal) {
        return "Student identified the right idea but stopped before the goal.";
      }
      return "Student partially understood the bug but made a small mistake.";
    case "Partial Repair":
      return "Student improved the route but the robot still did not finish on the goal.";
    case "No Repair":
      return "Student did not meaningfully change the buggy starter program.";
    case "Incorrect Repair":
    default:
      if (ctx.repairStatus === "wrongTurnFix") {
        return "Student changed turns but the robot moved away from the target.";
      }
      return "Student changed the program but the robot behavior was still incorrect.";
  }
}
