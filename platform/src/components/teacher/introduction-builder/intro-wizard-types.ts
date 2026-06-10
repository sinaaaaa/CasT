import type { LucideIcon } from "lucide-react";
import { BookOpen, Grid3x3, ListOrdered, MessageSquare, Rocket } from "lucide-react";

export type IntroWizardStepId = "info" | "playfield" | "welcome" | "steps" | "publish";

export type IntroWizardStep = {
  id: IntroWizardStepId;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
};

export const INTRO_WIZARD_STEPS: IntroWizardStep[] = [
  {
    id: "info",
    label: "Introduction info",
    shortLabel: "Info",
    description: "Name, publish status, and skip options",
    icon: BookOpen,
  },
  {
    id: "playfield",
    label: "Robot & grid",
    shortLabel: "Grid",
    description: "Where the robot starts on the board (syncs to the game)",
    icon: Grid3x3,
  },
  {
    id: "welcome",
    label: "Welcome message",
    shortLabel: "Welcome",
    description: "What students see before the first teaching step",
    icon: MessageSquare,
  },
  {
    id: "steps",
    label: "Teaching steps",
    shortLabel: "Steps",
    description: "Teach each action block one at a time",
    icon: ListOrdered,
  },
  {
    id: "publish",
    label: "Review & publish",
    shortLabel: "Publish",
    description: "Check everything and make it live for students",
    icon: Rocket,
  },
];

export function isIntroWizardStepId(v: string | null): v is IntroWizardStepId {
  return INTRO_WIZARD_STEPS.some((s) => s.id === v);
}
