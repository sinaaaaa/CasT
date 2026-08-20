/**
 * Canvas strip task types — single source of truth for teacher UI labels,
 * pedagogy, and strip behavior summaries.
 */

import type { CanvasLessonConfig } from "@/lib/level-config";

export type CanvasStripMode = NonNullable<CanvasLessonConfig["stripMode"]>;

export type CanvasStripTypeMeta = {
  value: CanvasStripMode;
  /** Short card title */
  label: string;
  /** One-line teacher hint */
  hint: string;
  /** What the student does (cognitive demand) */
  studentJob: string;
  /** What appears in the yellow strip */
  stripSummary: string;
  /** Accent for selected cards / badges */
  accent: "slate" | "amber" | "sky" | "violet";
  /** Whether motion palette / Repeat apply */
  usesMotionPalette: boolean;
  /** Whether accepted-program list is edited separately */
  usesAcceptedPrograms: boolean;
};

export const CANVAS_STRIP_TYPES: readonly CanvasStripTypeMeta[] = [
  {
    value: "EMPTY",
    label: "Build from scratch",
    hint: "Open yellow strip",
    studentJob: "Compose a full program that matches the pattern.",
    stripSummary: "Empty strip — drag blocks freely",
    accent: "slate",
    usesMotionPalette: true,
    usesAcceptedPrograms: true,
  },
  {
    value: "BLANKS",
    label: "Fill the blanks",
    hint: "Fixed dash slots",
    studentJob: "Drop the missing arrows into each blank slot.",
    stripSummary: "Fixed blank slots to fill",
    accent: "amber",
    usesMotionPalette: true,
    usesAcceptedPrograms: true,
  },
  {
    value: "SEED_PROGRAM",
    label: "Edit a starter",
    hint: "Pre-filled blocks",
    studentJob: "Change, add, or reorder a starter program.",
    stripSummary: "Seeded starter blocks",
    accent: "sky",
    usesMotionPalette: true,
    usesAcceptedPrograms: true,
  },
  {
    value: "COUNT_ANSWER",
    label: "Count the pattern",
    hint: "+/− number answer",
    studentJob: "Count how many of one arrow appear, then submit with +/−.",
    stripSummary: "Number counter only (no motion blocks)",
    accent: "violet",
    usesMotionPalette: false,
    usesAcceptedPrograms: false,
  },
] as const;

export function getCanvasStripType(
  mode: string | undefined | null
): CanvasStripTypeMeta {
  const key = (mode ?? "EMPTY").toUpperCase() as CanvasStripMode;
  return (
    CANVAS_STRIP_TYPES.find((t) => t.value === key) ?? CANVAS_STRIP_TYPES[0]!
  );
}

export function canvasStripModeLabel(mode: string | undefined | null): string {
  return getCanvasStripType(mode).label;
}

export const CANVAS_STRIP_ACCENT_CLASS: Record<
  CanvasStripTypeMeta["accent"],
  {
    ring: string;
    bg: string;
    iconBg: string;
    iconBgActive: string;
    text: string;
    soft: string;
  }
> = {
  slate: {
    ring: "border-slate-400 ring-slate-200",
    bg: "bg-slate-50",
    iconBg: "bg-slate-100 text-slate-600",
    iconBgActive: "bg-slate-800 text-white",
    text: "text-slate-900",
    soft: "bg-slate-100 text-slate-700",
  },
  amber: {
    ring: "border-amber-400 ring-amber-100",
    bg: "bg-amber-50/80",
    iconBg: "bg-amber-100 text-amber-800",
    iconBgActive: "bg-amber-600 text-white",
    text: "text-amber-950",
    soft: "bg-amber-100 text-amber-900",
  },
  sky: {
    ring: "border-sky-400 ring-sky-100",
    bg: "bg-sky-50/80",
    iconBg: "bg-sky-100 text-sky-800",
    iconBgActive: "bg-sky-600 text-white",
    text: "text-sky-950",
    soft: "bg-sky-100 text-sky-900",
  },
  violet: {
    ring: "border-violet-400 ring-violet-100",
    bg: "bg-violet-50/80",
    iconBg: "bg-violet-100 text-violet-800",
    iconBgActive: "bg-violet-600 text-white",
    text: "text-violet-950",
    soft: "bg-violet-100 text-violet-900",
  },
};
