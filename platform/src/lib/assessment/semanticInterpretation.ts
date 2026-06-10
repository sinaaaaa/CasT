/**
 * Simulation-first semantic mistake interpretation for teacher-facing copy.
 * Prioritizes what happened to the robot over raw command diffs.
 */

import type { GoalRelationshipAnalysis } from "@/lib/assessment/routeAnalysis";
import type { SimulationResult } from "@/lib/assessment/assessmentTypes";
import { classifyStepCommandMismatch } from "@/lib/assessment/program-diff-visual";
import type { CommandToken } from "@/lib/command-icons";
import { COMMAND_ARIA_LABELS } from "@/lib/command-icons";

export type SemanticIssueType =
  | "obstacle_collision"
  | "passed_goal"
  | "extra_command"
  | "wrong_turn"
  | "wrong_command"
  | "wrong_direction"
  | "missing_command"
  | "stopped_before_goal"
  | "inefficient_route"
  | "correct"
  | "unknown";

export type SemanticInterpretation = {
  issueType: SemanticIssueType;
  /** Single primary line for teacher cards */
  primaryIssue: string;
  teacherMessage: string;
  robotOutcomeMessage: string;
  suggestedFix: string | null;
  firstIncorrectStep: number | null;
  suppressMissingSummary: boolean;
  suppressStoppedEarlyHint: boolean;
  highlightExtraAfterGoalStep: number | null;
};

export function interpretSemanticIssue(params: {
  goalRel: GoalRelationshipAnalysis;
  studentSim: SimulationResult;
  goalLabel: string;
  firstObstacleStep?: number | null;
  /** Command-level fallback when simulation is inconclusive */
  repairStatus?: string;
  firstCommandMistakeStep?: number | null;
  forwardMissingCount?: number;
  forwardExtraCount?: number;
  studentCmdAtFirstMistake?: CommandToken;
  referenceCmdAtFirstMistake?: CommandToken;
}): SemanticInterpretation {
  const {
    goalRel,
    studentSim,
    goalLabel,
    firstObstacleStep,
    repairStatus,
    firstCommandMistakeStep,
    forwardMissingCount = 0,
    forwardExtraCount = 0,
    studentCmdAtFirstMistake,
    referenceCmdAtFirstMistake,
  } = params;

  const base = {
    suppressMissingSummary: false,
    suppressStoppedEarlyHint: false,
    highlightExtraAfterGoalStep: null as number | null,
    suggestedFix: null as string | null,
  };

  if (
    (studentSim.obstacleCollisionCount ?? 0) > 0 ||
    (firstObstacleStep != null && firstObstacleStep > 0)
  ) {
    const step = firstObstacleStep ?? studentSim.firstObstacleMistakeStep ?? 1;
    return {
      issueType: "obstacle_collision",
      primaryIssue: "Hit obstacle",
      teacherMessage: `Robot tried to move through an obstacle at Step ${step}.`,
      robotOutcomeMessage: `Hit obstacle at Step ${step}.`,
      firstIncorrectStep: step,
      ...base,
      suppressMissingSummary: true,
      suppressStoppedEarlyHint: true,
    };
  }

  const passedGoal =
    goalRel.goalTouched &&
    !goalRel.finalStoppedOnGoal &&
    (goalRel.movedAfterGoal || goalRel.passedThroughGoal || goalRel.overshotGoal);

  if (passedGoal) {
    const beyond = goalRel.passedGoalDistance || goalRel.distanceFromGoal;
    const extraStep = goalRel.firstExtraAfterGoalStep;
    return {
      issueType: "passed_goal",
      primaryIssue: "Passed goal",
      teacherMessage: "Robot reached the goal but continued moving.",
      robotOutcomeMessage:
        beyond === 1
          ? `Robot passed the ${goalLabel} by 1 cell.`
          : beyond > 0
            ? `Robot passed the ${goalLabel} by ${beyond} cell(s).`
            : `Robot passed the ${goalLabel} but did not stop on it.`,
      suggestedFix: "Remove the extra movement after the goal.",
      firstIncorrectStep: extraStep ?? firstCommandMistakeStep ?? null,
      suppressMissingSummary: true,
      suppressStoppedEarlyHint: true,
      highlightExtraAfterGoalStep: extraStep,
    };
  }

  if (
    goalRel.finalStoppedOnGoal &&
    forwardExtraCount > 0 &&
    repairStatus === "successfulButInefficient"
  ) {
    return {
      ...base,
      issueType: "inefficient_route",
      primaryIssue: "Extra movement",
      teacherMessage: `Robot stopped on the ${goalLabel} but the program has extra commands.`,
      robotOutcomeMessage: `Robot stopped on the ${goalLabel}.`,
      suggestedFix: "Remove commands that are not needed.",
      firstIncorrectStep: firstCommandMistakeStep ?? null,
      suppressMissingSummary: true,
    };
  }

  if (goalRel.finalStoppedOnGoal) {
    return {
      issueType: "correct",
      primaryIssue: "On goal",
      teacherMessage: `Robot stopped on the ${goalLabel}.`,
      robotOutcomeMessage: `Robot stopped on the ${goalLabel}.`,
      firstIncorrectStep: null,
      ...base,
      suppressMissingSummary: true,
    };
  }

  if (repairStatus === "wrongDirectionFix") {
    return {
      issueType: "wrong_direction",
      primaryIssue: "Wrong direction",
      teacherMessage: "Robot reached the goal cell but ended facing the wrong direction.",
      robotOutcomeMessage: "Wrong final direction.",
      firstIncorrectStep: firstCommandMistakeStep ?? null,
      ...base,
      suppressMissingSummary: true,
    };
  }

  if (repairStatus === "wrongTurnFix") {
    return {
      issueType: "wrong_turn",
      primaryIssue: "Wrong turn",
      teacherMessage: "Student used the wrong turn for this step.",
      robotOutcomeMessage: goalRel.stoppedBeforeGoal
        ? `Robot stopped before the ${goalLabel}.`
        : `Robot did not stop on the ${goalLabel}.`,
      firstIncorrectStep: firstCommandMistakeStep ?? null,
      ...base,
    };
  }

  const step = firstCommandMistakeStep;
  if (
    step != null &&
    studentCmdAtFirstMistake &&
    referenceCmdAtFirstMistake
  ) {
    const mismatch = classifyStepCommandMismatch(
      studentCmdAtFirstMistake,
      referenceCmdAtFirstMistake
    );
    if (mismatch === "wrong_turn") {
      return {
        ...base,
        issueType: "wrong_turn",
        primaryIssue: "Wrong turn",
        teacherMessage: `Student turned the wrong direction at Step ${step}.`,
        robotOutcomeMessage: goalRel.stoppedBeforeGoal
          ? `Robot stopped ${goalRel.distanceFromGoal} step(s) before the ${goalLabel}.`
          : `Robot did not stop on the ${goalLabel}.`,
        firstIncorrectStep: step,
        suppressMissingSummary: true,
      };
    }
    if (
      mismatch === "turn_instead_of_forward" ||
      mismatch === "forward_instead_of_turn" ||
      mismatch === "wrong_command"
    ) {
      const expected = COMMAND_ARIA_LABELS[referenceCmdAtFirstMistake];
      const used = COMMAND_ARIA_LABELS[studentCmdAtFirstMistake];
      return {
        ...base,
        issueType: "wrong_command",
        primaryIssue: "Wrong command",
        teacherMessage:
          mismatch === "turn_instead_of_forward"
            ? `Student used a turn at Step ${step} when ${expected} was needed.`
            : `Student used ${used} at Step ${step} when ${expected} was needed.`,
        robotOutcomeMessage: goalRel.stoppedBeforeGoal
          ? `Robot stopped ${goalRel.distanceFromGoal} step(s) before the ${goalLabel}.`
          : `Robot did not stop on the ${goalLabel}.`,
        firstIncorrectStep: step,
        suppressMissingSummary: true,
      };
    }
  }

  const neverReachedGoal = !goalRel.goalTouched;

  if (neverReachedGoal && goalRel.stoppedBeforeGoal) {
    if (forwardMissingCount > 0) {
      return {
        ...base,
        issueType: "missing_command",
        primaryIssue: "Missing movement",
        teacherMessage:
          forwardMissingCount === 1
            ? "Missing one movement needed to reach the goal."
            : `Missing ${forwardMissingCount} movement(s) needed to reach the goal.`,
        robotOutcomeMessage: `Robot stopped ${goalRel.distanceFromGoal} step(s) before the ${goalLabel}.`,
        suggestedFix: "Add the missing forward command(s).",
        firstIncorrectStep: firstCommandMistakeStep ?? null,
      };
    }
    return {
      issueType: "stopped_before_goal",
      primaryIssue: "Stopped early",
      teacherMessage: "Robot stopped before reaching the goal.",
      robotOutcomeMessage: `Robot stopped ${goalRel.distanceFromGoal} step(s) before the ${goalLabel}.`,
      firstIncorrectStep: firstCommandMistakeStep ?? null,
      ...base,
    };
  }

  if (forwardExtraCount > 0 && !goalRel.goalTouched) {
    return {
      issueType: "extra_command",
      primaryIssue: "Extra movement",
      teacherMessage: "Student added extra movement that was not needed.",
      robotOutcomeMessage: `Robot did not stop on the ${goalLabel}.`,
      firstIncorrectStep: firstCommandMistakeStep ?? null,
      ...base,
    };
  }

  return {
    issueType: "unknown",
    primaryIssue: "Needs review",
    teacherMessage: "Review the student's program against the working route.",
    robotOutcomeMessage: `Robot did not stop on the ${goalLabel}.`,
    firstIncorrectStep: firstCommandMistakeStep ?? null,
    ...base,
  };
}

/** Map semantic issue to compact chip label for summary cards. */
export function semanticIssueChipLabel(issueType: SemanticIssueType): string {
  switch (issueType) {
    case "obstacle_collision":
      return "Hit obstacle";
    case "passed_goal":
      return "Passed goal";
    case "extra_command":
      return "Extra movement";
    case "wrong_turn":
      return "Wrong turn";
    case "wrong_command":
      return "Wrong command";
    case "wrong_direction":
      return "Wrong direction";
    case "missing_command":
      return "Missing movement";
    case "stopped_before_goal":
      return "Stopped early";
    case "inefficient_route":
      return "Extra movement";
    case "correct":
      return "On goal";
    default:
      return "Needs review";
  }
}

export function defaultSemanticInterpretation(
  overrides?: Partial<SemanticInterpretation>
): SemanticInterpretation {
  return {
    issueType: "unknown",
    primaryIssue: "Needs review",
    teacherMessage: "",
    robotOutcomeMessage: "",
    suggestedFix: null,
    firstIncorrectStep: null,
    suppressMissingSummary: false,
    suppressStoppedEarlyHint: false,
    highlightExtraAfterGoalStep: null,
    ...overrides,
  };
}
