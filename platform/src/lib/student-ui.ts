import type { LevelType } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import {
  Bug,
  Flag,
  GitBranch,
  Grid3x3,
  MousePointerClick,
  Sparkles,
  Minus,
} from "lucide-react";

/** SPARC student experience design tokens */
export const SPARC = {
  primary: "#4F46E5",
  purple: "#7C3AED",
  teal: "#14B8A6",
  success: "#22C55E",
  warning: "#F59E0B",
  background: "#F8FAFC",
} as const;

export type LevelTaskLabel =
  | "Introduction"
  | "Path Building"
  | "Prediction"
  | "Choose Actions"
  | "Debugging"
  | "Number Line"
  | "Challenge";

export function resolveLevelTaskLabel(
  levelType: LevelType,
  layoutMode?: string | null
): LevelTaskLabel {
  if (layoutMode === "NUMBER_LINE") return "Number Line";
  switch (levelType) {
    case "INTRO":
      return "Introduction";
    case "DRAG_ACTIONS":
      return "Path Building";
    case "FLAG_PLACEMENT":
      return "Prediction";
    case "CHOOSE_BUTTONS":
      return "Choose Actions";
    case "DRAG_EDIT_PROGRAM":
      return "Debugging";
    default:
      return "Challenge";
  }
}

export function levelTaskMeta(label: LevelTaskLabel): {
  icon: LucideIcon;
  gradient: string;
  emoji: string;
} {
  switch (label) {
    case "Introduction":
      return { icon: Sparkles, gradient: "from-violet-400 to-indigo-500", emoji: "✨" };
    case "Path Building":
      return { icon: GitBranch, gradient: "from-teal-400 to-emerald-500", emoji: "🛤️" };
    case "Prediction":
      return { icon: Flag, gradient: "from-amber-400 to-orange-500", emoji: "🎯" };
    case "Choose Actions":
      return { icon: MousePointerClick, gradient: "from-sky-400 to-blue-500", emoji: "👆" };
    case "Debugging":
      return { icon: Bug, gradient: "from-rose-400 to-pink-500", emoji: "🔧" };
    case "Number Line":
      return { icon: Minus, gradient: "from-cyan-400 to-teal-500", emoji: "➖" };
    default:
      return { icon: Grid3x3, gradient: "from-indigo-400 to-violet-500", emoji: "🤖" };
  }
}

export function difficultyLabel(n: number): string {
  if (n <= 1) return "Easy";
  if (n <= 2) return "Medium";
  if (n <= 3) return "Tricky";
  return "Expert";
}

export function difficultyColor(n: number): string {
  if (n <= 1) return "bg-emerald-100 text-emerald-800";
  if (n <= 2) return "bg-sky-100 text-sky-800";
  if (n <= 3) return "bg-amber-100 text-amber-800";
  return "bg-rose-100 text-rose-800";
}

export type LevelPlayStatus = "completed" | "in_progress" | "new";

export function resolvePlayStatus(
  attempts: number,
  passed: boolean
): LevelPlayStatus {
  if (passed) return "completed";
  if (attempts > 0) return "in_progress";
  return "new";
}

export const FEATURE_CARDS = [
  {
    emoji: "🧠",
    title: "Think Like a Problem Solver",
    description: "Break big puzzles into small steps — just like real coders do!",
    gradient: "from-indigo-500/10 to-violet-500/10",
    accent: "border-indigo-200",
  },
  {
    emoji: "🤖",
    title: "Control the Robot",
    description: "Drag, drop, and build commands to guide your robot friend.",
    gradient: "from-teal-500/10 to-emerald-500/10",
    accent: "border-teal-200",
  },
  {
    emoji: "🎯",
    title: "Complete Challenges",
    description: "Predict paths, fix bugs, and conquer obstacle courses.",
    gradient: "from-amber-500/10 to-orange-500/10",
    accent: "border-amber-200",
  },
  {
    emoji: "🏆",
    title: "Earn Progress",
    description: "Collect stars, build streaks, and level up your skills!",
    gradient: "from-violet-500/10 to-fuchsia-500/10",
    accent: "border-violet-200",
  },
] as const;

export const HOW_IT_WORKS_STEPS = [
  { step: 1, title: "Get your Student ID", text: "Your teacher gives you a special code to sign in." },
  { step: 2, title: "Pick a challenge", text: "Choose a robot level that looks fun to you." },
  { step: 3, title: "Build & run", text: "Drag blocks, press play, and watch your robot go!" },
  { step: 4, title: "Learn & grow", text: "Try again, earn stars, and become a coding hero." },
] as const;
