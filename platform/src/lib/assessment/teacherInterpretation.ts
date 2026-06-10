/**
 * Teacher-facing recommendations from ECD results (non-technical language).
 */

import type {
  ConstructScore,
  GameplayEvidence,
  TaskAssessmentConfig,
  TaskType,
} from "@/lib/assessment/assessmentTypes";

const TASK_PRACTICE: Record<TaskType, string[]> = {
  "algorithmic-thinking": [
    "a path-planning level with a clear start and goal",
    "an obstacle navigation challenge",
  ],
  debugging: [
    "a level where students fix a broken route",
    "a short puzzle with one deliberate mistake to find",
  ],
  decomposition: [
    "a two-step visit sequence (object A, then object B)",
    "a level broken into visible subgoals",
  ],
  "spatial-reasoning": [
    "an orientation challenge with turns",
    "a level that requires facing the goal before moving",
  ],
  correspondence: [
    "a guided drag-and-drop introduction to each command",
    "a level with one command type at a time",
  ],
  optimization: [
    "a shortest-route challenge",
    "a level with a ‘fewest moves’ discussion prompt",
  ],
  prediction: [
    "another prediction task with one turn",
    "a short flag-placement level with forward moves only",
  ],
  "multi-stage-navigation": [
    "another ordered visit sequence with different objects",
    "a three-object delivery route (if curriculum allows)",
  ],
};

export function generateRecommendations(params: {
  task: TaskAssessmentConfig;
  evidence: GameplayEvidence;
  constructScores: ConstructScore[];
}): string[] {
  const { task, evidence, constructScores } = params;
  const recs: string[] = [];

  const weakest = [...constructScores].sort((a, b) => a.score - b.score)[0];
  const strongest = [...constructScores].sort((a, b) => b.score - a.score)[0];

  if (weakest && weakest.score < 65) {
    const label = weakest.slug.replace(/-/g, " ");
    recs.push(
      `Practice ${label}: assign ${pickPractice(task.taskType, weakest.slug)}.`
    );
  }

  if (task.taskEnvironmentType === "number-line" && evidence.numberLineEvidence) {
    const nl = evidence.numberLineEvidence;
    if (nl.stepCountingAccuracy < 65) {
      recs.push(
        "Practice counting ticks on the number line: ask the student to name start tick, goal tick, and how many forward/backward steps are needed."
      );
    }
    if (nl.directionAccuracy < 65) {
      recs.push(
        "Practice forward vs backward: use a short line where each arrow moves exactly one tick in the facing direction."
      );
    }
    if (nl.movementSequencing < 65) {
      recs.push(
        "Assign a ‘no backtracking’ number-line level: each step should move closer to the goal tick."
      );
    }
    if (recs.length >= 2) return recs.slice(0, 4);
  }

  if (evidence.unnecessaryMoves >= 2 && task.compareWithOptimalRoute) {
    recs.push(
      "Try a shortest-route challenge: ask the student to solve again with fewer moves."
    );
  }

  if (evidence.directionAccuracy < 60 || evidence.wrongTurns >= 2) {
    recs.push(
      task.taskEnvironmentType === "number-line"
        ? "Review forward/backward on the number line — each arrow should move one tick along the line."
        : "Try an orientation challenge: emphasize turning to face the goal before moving forward."
    );
  }

  if (
    task.requiredGoalOrder &&
    (!evidence.correctGoalOrder || evidence.reachedEnd === false)
  ) {
    recs.push(
      "Assign another ordered visit level (visit object 1, then object 2) with different props."
    );
  }

  if (evidence.collisions > 0 && task.hasObstacle && task.taskEnvironmentType === "grid") {
    recs.push(
      "Assign obstacle navigation practice: plan a path around blocked cells before running."
    );
  }

  if (evidence.editCount === 0 && !evidence.passed) {
    recs.push(
      "Encourage test-and-fix: have the student change one block when the robot does not reach the goal."
    );
  }

  if (strongest && strongest.score >= 85 && recs.length < 2) {
    recs.push(
      `Ready for stretch work: offer a harder ${task.taskType.replace(/-/g, " ")} level.`
    );
  }

  if (recs.length === 0) {
    recs.push(
      `Continue the ${task.taskType.replace(/-/g, " ")} strand with the next level in sequence.`
    );
  }

  return recs.slice(0, 4);
}

function pickPractice(taskType: TaskType, slug: string): string {
  const options = TASK_PRACTICE[taskType] ?? TASK_PRACTICE["algorithmic-thinking"];
  if (slug.includes("evaluation") || slug.includes("algorithm")) return options[0] ?? options[0];
  if (slug.includes("debug")) return TASK_PRACTICE.debugging[0];
  if (slug.includes("decomposition")) return TASK_PRACTICE.decomposition[0];
  return options[1] ?? options[0];
}

/** Plain-language interpretations from evidence (no formulas). */
export function buildInterpretations(
  evidence: GameplayEvidence,
  constructScores: ConstructScore[]
): string[] {
  if (evidence.taskEnvironmentType === "number-line" && evidence.numberLineEvidence) {
    return buildNumberLineInterpretations(evidence.numberLineEvidence, constructScores);
  }

  const lines: string[] = [];

  if (evidence.sequenceCoherence >= 70) {
    lines.push("Shows solid sequencing: commands follow a logical order.");
  } else {
    lines.push("Sequencing is still developing: steps may need reordering or trimming.");
  }

  if (evidence.directionAccuracy >= 70) {
    lines.push("Understands how direction and turns connect to movement.");
  } else if (evidence.wrongTurns > 0) {
    lines.push("Still building spatial orientation — turns do not always match the goal.");
  }

  if (evidence.passed && evidence.efficiencyRatio >= 80) {
    lines.push("Reaches goals with an efficient, purposeful route.");
  } else if (evidence.passed && evidence.unnecessaryMoves > 0) {
    lines.push("Solves the task correctly but could plan a tighter path.");
  }

  if (evidence.correctGoalOrder && evidence.subgoalCompletion >= 100) {
    lines.push("Handles multi-step goals in the right order.");
  }

  if (evidence.editCount > 0 || evidence.routeRecovery >= 60) {
    lines.push("Shows debugging behavior: revises the program after seeing results.");
  }

  const top = [...constructScores].sort((a, b) => b.score - a.score)[0];
  const low = [...constructScores].sort((a, b) => a.score - b.score)[0];
  if (top && top.score >= 85) {
    lines.push(`Strongest area: ${top.slug.replace(/-/g, " ")}.`);
  }
  if (low && low.score < 50) {
    lines.push(`Needs support with: ${low.slug.replace(/-/g, " ")}.`);
  }

  return lines.slice(0, 6);
}

function buildNumberLineInterpretations(
  nl: NonNullable<GameplayEvidence["numberLineEvidence"]>,
  constructScores: ConstructScore[]
): string[] {
  const lines: string[] = [];

  if (nl.startPositionRecognition >= 85) {
    lines.push("Start position: recognizes where the robot begins on the number line.");
  } else {
    lines.push("Start position: still building awareness of the starting tick on the line.");
  }

  if (nl.visitObjectSequence && nl.visit1 && nl.visit2) {
    if (nl.correctVisitOrder && nl.visit2.reached) {
      lines.push(
        `Visit sequence: reached ${nl.visit1.label} (tick ${nl.visit1.tick + 1}) then ${nl.visit2.label} (tick ${nl.visit2.tick + 1}) in order.`
      );
    } else if (!nl.visit1.reached) {
      lines.push(`Visit sequence: did not reach the first object (${nl.visit1.label}).`);
    } else if (!nl.visit2.reached) {
      lines.push(
        `Visit sequence: reached ${nl.visit1.label} but not the second object (${nl.visit2.label}).`
      );
    } else {
      lines.push("Visit sequence: objects were not visited in the required order.");
    }
  }

  if (nl.teacherNotes.directionConfusion) {
    lines.push(nl.teacherNotes.directionConfusion);
  }
  if (nl.teacherNotes.countingErrors) {
    lines.push(nl.teacherNotes.countingErrors);
  }
  if (nl.teacherNotes.movementConsistency) {
    lines.push(nl.teacherNotes.movementConsistency);
  }
  if (nl.teacherNotes.orientationUnderstanding) {
    lines.push(nl.teacherNotes.orientationUnderstanding);
  }

  if (nl.arrowToMovementCorrespondence >= 80) {
    lines.push("Arrow-to-movement: pressed arrows match how the robot moved along ticks.");
  }

  const top = [...constructScores].sort((a, b) => b.score - a.score)[0];
  const low = [...constructScores].sort((a, b) => a.score - b.score)[0];
  if (top && top.score >= 85) {
    lines.push(`Strongest area: ${top.slug.replace(/-/g, " ")}.`);
  }
  if (low && low.score < 50) {
    lines.push(`Needs support with: ${low.slug.replace(/-/g, " ")}.`);
  }

  return lines.slice(0, 6);
}
