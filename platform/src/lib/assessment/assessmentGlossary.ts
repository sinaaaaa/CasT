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
  | "routeComparison";

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
