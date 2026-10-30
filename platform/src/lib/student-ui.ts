import type { LevelType } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import {
  Bug,
  Flag,
  GitBranch,
  Grid3x3,
  MousePointerClick,
  PenLine,
  Sparkles,
  Route,
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
  | "Warm-up"
  | "Build a path"
  | "Guess the finish"
  | "Fill the blanks"
  | "Fix the program"
  | "Number line"
  | "Trace the shape"
  | "Draw the path"
  | "Pattern board"
  | "Challenge";

export function resolveLevelTaskLabel(
  levelType: LevelType,
  layoutMode?: string | null,
  extra?: { geometryTask?: string | null }
): LevelTaskLabel {
  if (layoutMode === "NUMBER_LINE") return "Number line";
  if (layoutMode === "CANVAS") return "Pattern board";
  if (levelType === "GEOMETRY_PATH") {
    return extra?.geometryTask === "DRAW_PATH" ? "Draw the path" : "Trace the shape";
  }
  switch (levelType) {
    case "INTRO":
      return "Warm-up";
    case "DRAG_ACTIONS":
      return "Build a path";
    case "FLAG_PLACEMENT":
      return "Guess the finish";
    case "CHOOSE_BUTTONS":
      return "Fill the blanks";
    case "DRAG_EDIT_PROGRAM":
      return "Fix the program";
    default:
      return "Challenge";
  }
}

export function levelTaskMeta(label: LevelTaskLabel): {
  icon: LucideIcon;
  gradient: string;
  emoji: string;
  hint: string;
} {
  switch (label) {
    case "Warm-up":
      return {
        icon: Sparkles,
        gradient: "from-violet-400 to-indigo-500",
        emoji: "✨",
        hint: "A short practice before the main puzzles.",
      };
    case "Build a path":
      return {
        icon: GitBranch,
        gradient: "from-teal-400 to-emerald-500",
        emoji: "🛤️",
        hint: "Line up moves so the robot reaches the goal.",
      };
    case "Guess the finish":
      return {
        icon: Flag,
        gradient: "from-amber-400 to-orange-500",
        emoji: "🎯",
        hint: "Watch the program, then tap where the robot will stop.",
      };
    case "Fill the blanks":
      return {
        icon: MousePointerClick,
        gradient: "from-sky-400 to-blue-500",
        emoji: "👆",
        hint: "Pick the missing moves to complete the program.",
      };
    case "Fix the program":
      return {
        icon: Bug,
        gradient: "from-rose-400 to-pink-500",
        emoji: "🔧",
        hint: "Something is wrong in the starter program. Repair it.",
      };
    case "Number line":
      return {
        icon: Minus,
        gradient: "from-cyan-400 to-teal-500",
        emoji: "➖",
        hint: "Move the robot along the number line, tick by tick.",
      };
    case "Trace the shape":
      return {
        icon: PenLine,
        gradient: "from-fuchsia-400 to-violet-500",
        emoji: "📐",
        hint: "Follow the shape with the same moves the robot would take.",
      };
    case "Draw the path":
      return {
        icon: Route,
        gradient: "from-lime-400 to-emerald-500",
        emoji: "✏️",
        hint: "Draw the path, then see it as robot commands.",
      };
    case "Pattern board":
      return {
        icon: Grid3x3,
        gradient: "from-indigo-400 to-sky-500",
        emoji: "🧩",
        hint: "Build or complete the repeating pattern.",
      };
    default:
      return {
        icon: Grid3x3,
        gradient: "from-indigo-400 to-violet-500",
        emoji: "🤖",
        hint: "Help the robot finish this challenge.",
      };
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

/** Students can replay finished items and keep going. Upcoming items stay locked. */
export function canOpenStudentItem(opts: {
  status: LevelPlayStatus;
  queuedForReplay?: boolean;
  isNext?: boolean;
}): boolean {
  if (opts.queuedForReplay) return true;
  if (opts.isNext) return true;
  if (opts.status === "completed" || opts.status === "in_progress") return true;
  return false;
}

/** First name for greetings. Skips placeholder IDs like STU-1001. */
export function greetingName(displayName: string | null | undefined): string {
  const trimmed = displayName?.trim() ?? "";
  if (!trimmed) return "";
  if (/^STU-/i.test(trimmed)) return "";
  if (/^Student\s+\S+$/i.test(trimmed)) return "";
  return trimmed.split(/\s+/)[0];
}

export function heyGreeting(displayName: string | null | undefined): string {
  const name = greetingName(displayName);
  return name ? `Hey ${name}` : "Hey there";
}

export const FEATURE_CARDS = [
  {
    emoji: "🧠",
    title: "Think like a problem solver",
    description: "Break big puzzles into small steps, just like real coders do.",
    gradient: "from-indigo-500/10 to-violet-500/10",
    accent: "border-indigo-200",
  },
  {
    emoji: "🤖",
    title: "Control the robot",
    description: "Drag, drop, and build commands to guide your robot friend.",
    gradient: "from-teal-500/10 to-emerald-500/10",
    accent: "border-teal-200",
  },
  {
    emoji: "🎯",
    title: "Finish challenges",
    description: "Guess paths, fix bugs, and get through obstacle courses.",
    gradient: "from-amber-500/10 to-orange-500/10",
    accent: "border-amber-200",
  },
  {
    emoji: "🏆",
    title: "See your progress",
    description: "Collect stars, keep a streak, and get a little better each time.",
    gradient: "from-violet-500/10 to-fuchsia-500/10",
    accent: "border-violet-200",
  },
] as const;

export const HOW_IT_WORKS_STEPS = [
  { step: 1, title: "Get your Student ID", text: "Your teacher gives you a code that is already on the class list." },
  { step: 2, title: "Pick a challenge", text: "Start with the one marked Play next, or tap any item to open it." },
  { step: 3, title: "Build and run", text: "Drag blocks, press play, and watch your robot go." },
  { step: 4, title: "Try again", text: "Missed it? Play the same item again until it clicks." },
] as const;
