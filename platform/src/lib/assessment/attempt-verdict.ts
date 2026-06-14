/**
 * Plain-English "verdict" for an attempt — one friendly sentence anyone can read
 * (teacher, parent, or student), plus a next-step and an honest confidence note.
 *
 * This sits ON TOP of the detailed analysis panels; it never replaces them. The
 * goal is that the first thing a reader sees answers: what happened, and what to
 * do next — without any jargon.
 */

import type { PredictionAnalysisResult } from "@/lib/assessment/predictionAnalysis";
import type { ChoiceActionAnalysisResult } from "@/lib/assessment/choiceActionAnalysis";
import type { DebuggingAnalysisResult } from "@/lib/assessment/debuggingAnalysis";
import type { PathBuildingAnalysisResult } from "@/lib/assessment/pathBuildingAnalysis";
import type { NumberLineEvidence } from "@/lib/assessment/assessmentTypes";

export type VerdictTone = "success" | "warning" | "danger" | "neutral";

export type VerdictConfidence = {
  level: "high" | "medium" | "low";
  /** Plain sentence shown only when we are not fully sure. */
  note: string;
};

export type AttemptVerdict = {
  /** Short, bold headline — e.g. "Almost — the robot drove one step too far". */
  headline: string;
  /** What happened, in plain words. */
  detail: string;
  /** What to try next (optional). */
  fix: string | null;
  tone: VerdictTone;
  confidence: VerdictConfidence | null;
};

export type AttemptVerdictInput = {
  goalLabel: string;
  prediction: PredictionAnalysisResult | null | undefined;
  choice: ChoiceActionAnalysisResult | null | undefined;
  debugging: DebuggingAnalysisResult | null | undefined;
  pathBuilding: PathBuildingAnalysisResult | null | undefined;
  numberLine: NumberLineEvidence | null | undefined;
  /** Fallback when no rich analysis is available. */
  fallback: { passed: boolean; status: string; score: number | null };
};

function clean(sentence: string | null | undefined): string {
  if (!sentence) return "";
  const trimmed = sentence.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function flagVerdict(
  r: PredictionAnalysisResult,
  goalLabel: string
): AttemptVerdict {
  const close =
    r.detectedMistakeType === "oneStepCountingError" ||
    r.matchQuality === "strong" ||
    r.matchQuality === "close";

  const confidence: VerdictConfidence | null =
    r.matchQuality === "weak" && !r.isCorrect
      ? {
          level: "medium",
          note: "The flag doesn't clearly match a common mistake pattern, so treat the suggested cause as a guess.",
        }
      : null;

  if (r.isCorrect) {
    return {
      headline: "Correct — the flag is exactly where the robot stops.",
      detail: clean(r.teacherExplanation) || "The student predicted the robot's stopping cell correctly.",
      fix: clean(r.recommendation) || null,
      tone: "success",
      confidence,
    };
  }

  if (close) {
    return {
      headline: "Very close — the flag is just off the right cell.",
      detail: clean(r.teacherExplanation),
      fix: clean(r.recommendation) || null,
      tone: "warning",
      confidence,
    };
  }

  return {
    headline: "Not yet — the flag isn't where the robot would stop.",
    detail: clean(r.teacherExplanation),
    fix: clean(r.recommendation) || null,
    tone: "danger",
    confidence,
  };
}

function choiceVerdict(r: ChoiceActionAnalysisResult): AttemptVerdict {
  if (r.isCorrect) {
    return {
      headline: "Correct — the right blocks were chosen.",
      detail: clean(r.teacherExplanation) || "The student picked the commands that solve the level.",
      fix: clean(r.recommendation) || null,
      tone: "success",
      confidence: null,
    };
  }
  if (r.obstacleCollision) {
    return {
      headline: "Not yet — the chosen blocks drove into an obstacle.",
      detail: clean(r.teacherExplanation),
      fix: clean(r.recommendation) || null,
      tone: "danger",
      confidence: null,
    };
  }
  return {
    headline: "Not yet — the chosen blocks don't solve the level.",
    detail: clean(r.teacherExplanation),
    fix: clean(r.recommendation) || null,
    tone: "danger",
    confidence: null,
  };
}

function pathVerdict(
  r: PathBuildingAnalysisResult,
  goalLabel: string
): AttemptVerdict {
  const detail =
    clean(r.semanticIssue?.robotOutcomeMessage) ||
    clean(r.robotOutcome) ||
    clean(r.whatHappened);
  const fix = clean(r.recommendation) || null;

  if (r.reachedGoal && (r.routeQuality === "Exact Route" || r.routeQuality === "Valid Route")) {
    return {
      headline: `Solved it — the robot reached the ${goalLabel}.`,
      detail: detail || `The robot stopped on the ${goalLabel}.`,
      fix,
      tone: "success",
      confidence: null,
    };
  }

  if (r.reachedGoal && r.routeQuality === "Valid but Extra Commands") {
    return {
      headline: `Solved it — but with a few extra moves.`,
      detail: detail || `The robot reached the ${goalLabel} using more commands than needed.`,
      fix: fix ?? "Try to reach the goal with fewer commands.",
      tone: "success",
      confidence: null,
    };
  }

  if (r.passedThroughGoal) {
    return {
      headline: `So close — the robot drove past the ${goalLabel}.`,
      detail: detail || `The robot crossed the ${goalLabel} but didn't stop on it.`,
      fix: fix ?? "Remove the extra movement so the robot stops on the goal.",
      tone: "warning",
      confidence: null,
    };
  }

  if (r.routeQuality === "Close Route" || r.routeQuality === "Partial Route") {
    return {
      headline: `Almost — one small step is off.`,
      detail: detail || clean(r.exactIssue),
      fix,
      tone: "warning",
      confidence: null,
    };
  }

  if (r.routeQuality === "Obstacle Collision") {
    return {
      headline: "Not yet — the route ran into an obstacle.",
      detail: detail || clean(r.exactIssue),
      fix,
      tone: "danger",
      confidence: null,
    };
  }

  if (r.routeQuality === "Goal Order Error") {
    return {
      headline: "Not yet — the goals were reached in the wrong order.",
      detail: detail || clean(r.exactIssue),
      fix,
      tone: "danger",
      confidence: null,
    };
  }

  return {
    headline: `Not yet — the robot didn't reach the ${goalLabel}.`,
    detail: detail || clean(r.exactIssue),
    fix,
    tone: "danger",
    confidence: null,
  };
}

function debuggingVerdict(
  r: DebuggingAnalysisResult,
  goalLabel: string
): AttemptVerdict {
  const detail =
    clean(r.semanticIssue?.robotOutcomeMessage) || clean(r.robotOutcome);
  const fix = clean(r.recommendation) || null;

  const confidence: VerdictConfidence | null =
    r.matchQuality === "unclear" && !r.bugFixed
      ? {
          level: "medium",
          note: "This repair doesn't match a common pattern, so the suggested cause is our best guess — check the program steps below.",
        }
      : null;

  if (r.bugFixed && r.repairStatus === "successfulButInefficient") {
    return {
      headline: "Fixed it — but the program has extra steps.",
      detail: detail || `The robot stopped on the ${goalLabel}.`,
      fix: fix ?? "Remove the commands that aren't needed.",
      tone: "success",
      confidence,
    };
  }

  if (r.bugFixed) {
    return {
      headline: `Fixed it — the robot now stops on the ${goalLabel}.`,
      detail: detail || `The robot stopped on the ${goalLabel}.`,
      fix,
      tone: "success",
      confidence,
    };
  }

  if (r.passedThroughGoal) {
    return {
      headline: `So close — the robot drove past the ${goalLabel}.`,
      detail: detail || `The robot crossed the ${goalLabel} but didn't stop on it.`,
      fix: fix ?? "Remove the extra movement after the goal.",
      tone: "warning",
      confidence,
    };
  }

  if (r.stoppedBeforeGoal) {
    return {
      headline: `Almost — the robot stopped before the ${goalLabel}.`,
      detail: detail || `The robot stopped short of the ${goalLabel}.`,
      fix: fix ?? "Add the movement needed to reach the goal.",
      tone: "warning",
      confidence,
    };
  }

  if (r.repairStatus === "wrongTurnFix") {
    return {
      headline: "Close — one turn went the wrong way.",
      detail: detail || clean(r.exactIssue),
      fix,
      tone: "warning",
      confidence,
    };
  }

  if (r.repairStatus === "noRepair") {
    return {
      headline: "No change — the starter program wasn't edited.",
      detail: detail || "The student submitted the program without fixing the bug.",
      fix: fix ?? "Encourage editing the program and pressing RUN before finishing.",
      tone: "neutral",
      confidence,
    };
  }

  return {
    headline: `Not yet — the robot didn't stop on the ${goalLabel}.`,
    detail: detail || clean(r.exactIssue),
    fix,
    tone: "danger",
    confidence,
  };
}

function numberLineVerdict(r: NumberLineEvidence, _attemptPassed: boolean): AttemptVerdict {
  const tick = (n: number) => `Tick ${n + 1}`;
  const visitMode = r.visitObjectSequence && r.visit1 && r.visit2;

  if (r.passed) {
    const headline = visitMode
      ? "Correct — visited both objects in order along the line."
      : "Correct — the robot reached the goal on the number line.";
    return {
      headline,
      detail: visitMode
        ? `Moved from ${tick(r.startTick)} to ${tick(r.endTick)} and visited ${r.visit1!.label} then ${r.visit2!.label}.`
        : `Moved from ${tick(r.startTick)} to ${tick(r.endTick)} facing ${r.startFacing} → ${r.endFacing}.`,
      fix: null,
      tone: "success",
      confidence: null,
    };
  }

  if (visitMode) {
    if (!r.visit1!.reached) {
      return {
        headline: `Not yet — did not reach ${r.visit1!.label} on the line.`,
        detail: r.teacherNotes.movementConsistency ?? `Stopped at ${tick(r.endTick)}.`,
        fix: r.teacherNotes.countingErrors ?? "Count the steps from start to the first object.",
        tone: "danger",
        confidence: null,
      };
    }
    if (!r.visit2!.reached) {
      return {
        headline: `Almost — reached ${r.visit1!.label} but not ${r.visit2!.label}.`,
        detail: r.teacherNotes.movementConsistency ?? `Ended at ${tick(r.endTick)}.`,
        fix: r.teacherNotes.countingErrors ?? "Add the moves needed to reach the second object.",
        tone: "warning",
        confidence: null,
      };
    }
    if (!r.correctVisitOrder) {
      return {
        headline: "Not yet — visited the objects in the wrong order.",
        detail: r.teacherNotes.movementConsistency ?? "Visit object 1, then object 2.",
        fix: "Replay the route: first object, then second object.",
        tone: "danger",
        confidence: null,
      };
    }
  }

  if (r.goalOutcome === "overshot" && r.goalTick != null) {
    return {
      headline: "Almost — went past the goal on the number line.",
      detail: `Ended at ${tick(r.endTick)} but the goal is ${tick(r.goalTick)}.`,
      fix:
        r.firstMistakeStep != null
          ? "Remove the extra step that carried the robot past the goal tick."
          : "Practice stopping exactly on the goal tick.",
      tone: "warning",
      confidence: null,
    };
  }

  if (r.goalOutcome === "stopped_early" && r.goalTick != null) {
    return {
      headline: "Close — stopped before the goal.",
      detail: `Ended at ${tick(r.endTick)} but the goal is ${tick(r.goalTick)}.`,
      fix: "Add the last forward or backward needed to reach the goal tick.",
      tone: "warning",
      confidence: null,
    };
  }

  if (r.stepCountingAccuracy >= 70 && r.directionAccuracy >= 70) {
    return {
      headline: "Close — movement was mostly right but the goal was missed.",
      detail: r.teacherNotes.countingErrors ?? `Ended at ${tick(r.endTick)} instead of the goal.`,
      fix: "Check whether one more forward or backward step was needed.",
      tone: "warning",
      confidence: null,
    };
  }

  if (r.directionAccuracy < 65) {
    return {
      headline: "Not yet — forward/backward did not match the robot's facing.",
      detail: r.teacherNotes.directionConfusion ?? "Some moves went the wrong way along the line.",
      fix: "Remind the student: forward means the way the robot faces; backward is the opposite.",
      tone: "danger",
      confidence: null,
    };
  }

  return {
    headline: "Not yet — the robot did not finish the number-line goal.",
    detail: r.teacherNotes.countingErrors ?? `Ended at ${tick(r.endTick)}.`,
    fix: "Count ticks from start to goal and match that many forward/backward moves.",
    tone: "danger",
    confidence: null,
  };
}

function fallbackVerdict(
  fallback: AttemptVerdictInput["fallback"]
): AttemptVerdict {
  if (fallback.passed || fallback.status === "CORRECT") {
    return {
      headline: "Correct — the student solved this item.",
      detail:
        fallback.score != null
          ? `Scored ${fallback.score}% on this attempt.`
          : "The robot completed the goal.",
      fix: null,
      tone: "success",
      confidence: null,
    };
  }
  if (fallback.status === "INCORRECT") {
    return {
      headline: "Not yet — the student didn't solve this item.",
      detail:
        fallback.score != null
          ? `Scored ${fallback.score}% on this attempt.`
          : "The robot didn't reach the goal.",
      fix: null,
      tone: "danger",
      confidence: null,
    };
  }
  return {
    headline: "Attempt recorded.",
    detail: "Open the details below to see what the student did.",
    fix: null,
    tone: "neutral",
    confidence: null,
  };
}

export function buildAttemptVerdict(input: AttemptVerdictInput): AttemptVerdict {
  const goalLabel = input.goalLabel || "goal";

  if (input.prediction?.available || (input.prediction?.misconceptionMatches?.length ?? 0) > 0) {
    if (input.prediction) return flagVerdict(input.prediction, goalLabel);
  }
  if (input.choice?.available) return choiceVerdict(input.choice);
  if (input.pathBuilding?.available) return pathVerdict(input.pathBuilding, goalLabel);
  if (input.debugging?.available) return debuggingVerdict(input.debugging, goalLabel);
  if (input.numberLine) return numberLineVerdict(input.numberLine, input.fallback.passed);

  return fallbackVerdict(input.fallback);
}
