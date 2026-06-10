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
    label: "Choose your challenge",
    shortLabel: "Start",
    description: "Pick how students interact, then name and classify your item",
    icon: Sparkles,
  },
  {
    id: "grid",
    label: "Design the board",
    shortLabel: "Board",
    description: "Grid or number line — place Robo, goals, and objects",
    icon: Grid3x3,
  },
  {
    id: "program",
    label: "Shape the program",
    shortLabel: "Program",
    description: "Starter blocks, blanks, or constraints students work with",
    icon: Blocks,
  },
  {
    id: "rules",
    label: "Set the rules",
    shortLabel: "Rules",
    description: "Attempts, movement, highlights, and win conditions",
    icon: Shield,
  },
  {
    id: "preview",
    label: "Review & publish",
    shortLabel: "Publish",
    description: "Preview the student experience and go live",
    icon: Rocket,
  },
];

export const WIZARD_STEP_CONTEXT: Record<
  WizardStepId,
  { title: string; body: string; checklist: string[] }
> = {
  info: {
    title: "Lead with the learning goal",
    body: "Choose the challenge type that best matches what you want students to practice. The type determines which tools appear in later steps.",
    checklist: [
      "Pick one challenge type",
      "Give the item a clear, student-friendly name",
      "Set difficulty so analytics stay meaningful",
    ],
  },
  grid: {
    title: "Make the puzzle readable at a glance",
    body: "Students should instantly see where Robo starts and what success looks like. Avoid clutter — every object should have a purpose.",
    checklist: [
      "Robo has a clear starting position",
      "Goals and visit objects are unambiguous",
      "Board size matches the cognitive load",
    ],
  },
  program: {
    title: "Scaffold without giving away the answer",
    body: "Pre-fill enough structure that students know what to do, but leave the thinking for them. Match scaffolding to your chosen challenge type.",
    checklist: [
      "Starter program matches the challenge type",
      "Blanks or editable slots are intentional",
      "Block palette includes only what students need",
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
