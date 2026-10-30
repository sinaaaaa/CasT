import type { LucideIcon } from "lucide-react";
import {
  Sparkles,
  Grid3x3,
  Blocks,
  Shield,
  Rocket,
} from "lucide-react";

export type WizardStepId =
  | "info"
  | "grid"
  | "program"
  | "rules"
  | "preview";

export type WizardStep = {
  id: WizardStepId;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
};

export const WIZARD_STEPS: WizardStep[] = [
  {
    id: "info",
    label: "Student job",
    shortLabel: "Job",
    description: "What students do, then name the item",
    icon: Sparkles,
  },
  {
    id: "grid",
    label: "The board",
    shortLabel: "Board",
    description: "Where the robot (or pattern) lives",
    icon: Grid3x3,
  },
  {
    id: "program",
    label: "The program",
    shortLabel: "Program",
    description: "Blocks students see or build with",
    icon: Blocks,
  },
  {
    id: "rules",
    label: "Play rules",
    shortLabel: "Rules",
    description: "Attempts, movement, and how they win",
    icon: Shield,
  },
  {
    id: "preview",
    label: "Review & publish",
    shortLabel: "Publish",
    description: "Play it like a student, then go live",
    icon: Rocket,
  },
];

export const WIZARD_STEP_CONTEXT: Record<
  WizardStepId,
  { title: string; body: string; checklist: string[] }
> = {
  info: {
    title: "Start with the student job",
    body: "Ask “what will students do?” — program, predict, trace, or work a pattern. The board and program steps adapt to that choice.",
    checklist: [
      "Pick a family, then one activity",
      "Give it a concrete classroom name",
      "Set difficulty so reports stay useful",
    ],
  },
  grid: {
    title: "Make the puzzle readable at a glance",
    body: "Students should instantly see where Robo starts and what success looks like. Every object should have a purpose.",
    checklist: [
      "Robo has a clear starting position",
      "Goals are unambiguous",
      "Skip clutter — empty cells are fine",
    ],
  },
  program: {
    title: "Match the strip to the student job",
    body: "Empty strip, starter, blanks, or a shown program — only include the blocks this lesson needs.",
    checklist: [
      "The strip matches the activity you picked",
      "Skip Bags and Chunks unless the lesson needs them",
      "For prediction, students should not edit the program",
    ],
  },
  rules: {
    title: "Rules shape how students explore",
    body: "Attempts, undo, and highlight settings affect whether students experiment freely or plan carefully. Align rules with your teaching intent.",
    checklist: [
      "Attempt limit fits your classroom norms",
      "Movement rules match the lesson objective",
      "Win condition is testable in preview",
    ],
  },
  preview: {
    title: "Play it like a student would",
    body: "Walk through the full flow before publishing. Small layout or rule tweaks here save confusion in the classroom.",
    checklist: [
      "Preview matches your design intent",
      "Student tip is helpful, not spoiler-heavy",
      "Publish when ready for assignments",
    ],
  },
};

export function isWizardStepId(v: string | null): v is WizardStepId {
  return WIZARD_STEPS.some((s) => s.id === v);
}
