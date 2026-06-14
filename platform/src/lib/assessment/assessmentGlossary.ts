/**
 * Plain-language explanations for teachers (tooltips & report copy).
 */

export type GlossaryKey =
  | "resetCount"
  | "robotTouch"
  | "robotTouchCount"
  | "efficiency"
  | "extraCommands"
  | "collisions"
  | "correctGoalOrder"
  | "subgoalCompletion"
  | "wrongTurns"
  | "overallScore"
  | "confidence"
  | "routeComparison"
  | "diagnosticScore"
  | "itemOutcome"
  | "diagnosticScoreFlag"
  | "diagnosticScorePathBuilding"
  | "diagnosticScoreDebugging"
  | "diagnosticScoreNumberLine"
  | "diagnosticScoreChoice"
  | "diagnosticScoreRoute";

export const ASSESSMENT_GLOSSARY: Record<
  GlossaryKey,
  { title: string; description: string }
> = {
  resetCount: {
    title: "Reset count",
    description:
      "Number of times the student pressed Reset during this attempt. High reset use can show trial-and-error, uncertainty, or active revision of their plan.",
  },
  robotTouch: {
    title: "Robot touch",
    description:
      "Shows whether the student interacted with the robot directly. This may indicate exploration, checking orientation, or needing interaction support.",
  },
  robotTouchCount: {
    title: "Robot touches",
    description:
      "How many times the student started touching or dragging the robot. Frequent touches may mean manual exploration instead of only using command blocks.",
  },
  efficiency: {
    title: "Efficiency",
    description:
      "Compares the student's route with the shortest known route for this item. A lower gap means more efficient planning.",
  },
  extraCommands: {
    title: "Extra commands",
    description:
      "Commands beyond the shortest route. Extra commands may show inefficient planning or a valid alternative strategy.",
  },
  collisions: {
    title: "Collisions",
    description:
      "Times the robot hit an obstacle or boundary. Collisions may indicate difficulty with spatial planning.",
  },
  correctGoalOrder: {
    title: "Correct goal order",
    description:
      "Whether the student completed required goals in the intended sequence (for example, visit A then B).",
  },
  subgoalCompletion: {
    title: "Subgoal completion",
    description:
      "Shows whether the student completed parts of a multi-step task before finishing the item.",
  },
  wrongTurns: {
    title: "Wrong turns",
    description:
      "Turns that did not help progress toward the goal. May indicate orientation or planning challenges.",
  },
  overallScore: {
    title: "Overall score",
    description:
      "How well the student met this task. For flag prediction items, a correct flag is 100% (advanced).",
  },
  confidence: {
    title: "Confidence",
    description:
      "How much evidence we had to score this attempt (commands run, goals reached, telemetry). More gameplay data usually means higher confidence.",
  },
  routeComparison: {
    title: "Student route vs best route",
    description:
      "Compares the student's full command program to the shortest program found by search over position, facing, obstacles, and ordered goals — not grid distance. Icons show each command; maps show cells visited.",
  },
  diagnosticScore: {
    title: "Diagnostic score",
    description:
      "A 0–100% teaching signal about how close the attempt was to success and how clear the mistake pattern is. It guides feedback and next activities — it is not always the same as pass/fail in the game.",
  },
  itemOutcome: {
    title: "Item outcome",
    description:
      "Whether the student met the level's win rule on this attempt (for example, flag on the stop cell, robot stopped on the goal, or correct button choices). Often 0% or 100% — separate from the diagnostic score.",
  },
  diagnosticScoreFlag: {
    title: "Diagnostic score (flag items)",
    description:
      "For correct flags: 100%. For wrong flags: how closely the placement matches a known misconception model (for example, one-step counting error). Higher % means a clearer, named mistake pattern — not credit for being close to correct.",
  },
  diagnosticScorePathBuilding: {
    title: "Diagnostic score (path-building items)",
    description:
      "Based on route quality (exact, valid, extra commands, partial, wrong order, obstacle hit, etc.) plus how much of the required goal path was completed. Better routes and more progress yield a higher score even when the item is not fully passed.",
  },
  diagnosticScoreDebugging: {
    title: "Diagnostic score (debugging items)",
    description:
      "Weighted blend: 40% whether the bug was fixed (robot stops on goal), 25% repair appropriateness vs a working fix, 20% edit focus, 15% sequence understanding. A small bonus when the fix was minimal and correct.",
  },
  diagnosticScoreNumberLine: {
    title: "Diagnostic score (number-line items)",
    description:
      "Combines direction accuracy, step count vs shortest path, arrow-to-movement match, movement toward targets, and start facing. Reaching the correct tick on the line is required for a full pass; the score still shows partial understanding when the stop tick is wrong.",
  },
  diagnosticScoreChoice: {
    title: "Diagnostic score (choose-action items)",
    description:
      "Percentage of guided blanks where the student picked the correct command. 100% means every choice was right; lower scores show which steps in the program were incorrect.",
  },
  diagnosticScoreRoute: {
    title: "Diagnostic score (route items)",
    description:
      "Reflects goal completion, efficiency compared with the shortest route, direction accuracy, and obstacle handling. Used when the student builds or edits a route on the grid.",
  },
};

/** Teacher-facing construct names (slug → label). */
export const CONSTRUCT_DISPLAY_NAMES: Record<string, string> = {
  sequencing: "Program Construction",
  "algorithm-design": "Algorithmic Thinking",
  debugging: "Debugging",
  decomposition: "Decomposition",
  "logical-reasoning": "Spatial Reasoning",
  evaluation: "Efficiency",
  conditionals: "Spatial Reasoning",
  abstraction: "Focus & Planning",
  "pattern-recognition": "Creativity",
  loops: "Patterns (not assessed in this game)",
  correspondence: "Correspondence",
};

export function constructDisplayName(slug: string): string {
  return CONSTRUCT_DISPLAY_NAMES[slug] ?? slug.replace(/-/g, " ");
}
