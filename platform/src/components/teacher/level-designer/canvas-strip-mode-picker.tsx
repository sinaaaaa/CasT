"use client";

import {
  Hash,
  LayoutTemplate,
  Minus,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  CANVAS_STRIP_ACCENT_CLASS,
  CANVAS_STRIP_TYPES,
  type CanvasStripMode,
  type CanvasStripTypeMeta,
} from "@/lib/canvas-strip-types";
import { cn } from "@/lib/utils";

const ICONS: Record<CanvasStripMode, LucideIcon> = {
  EMPTY: Sparkles,
  BLANKS: Minus,
  SEED_PROGRAM: LayoutTemplate,
  COUNT_ANSWER: Hash,
};

/** Mini yellow-strip sketch so teachers see the interaction at a glance. */
function StripSketch({ type }: { type: CanvasStripTypeMeta }) {
  if (type.value === "BLANKS") {
    return (
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1 w-7 rounded-full bg-slate-500/75"
            aria-hidden
          />
        ))}
      </div>
    );
  }
  if (type.value === "SEED_PROGRAM") {
    return (
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-5 w-5 rounded-md border border-sky-300/80 bg-white shadow-sm"
            aria-hidden
          />
        ))}
      </div>
    );
  }
  if (type.value === "COUNT_ANSWER") {
    return (
      <div className="inline-flex items-center gap-1 rounded-md border border-amber-400/70 bg-white px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-800 shadow-sm">
        <span className="text-slate-400">−</span>
        <span>0</span>
        <span className="text-slate-400">+</span>
      </div>
    );
  }
  return (
    <span className="text-[10px] font-medium text-amber-900/55">Empty strip</span>
  );
}

type Props = {
  value: CanvasStripMode;
  onChange: (mode: CanvasStripMode) => void;
};

/**
 * Task-type picker for canvas items — organized by what the student does,
 * with a yellow-strip sketch so the interaction is obvious before editing.
 */
export function CanvasStripModePicker({ value, onChange }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-900">Student task type</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Choose how students respond on the yellow strip. Board content (prompt + pattern) is shared.
        </p>
      </div>

      <div
        className="grid gap-2.5 sm:grid-cols-2"
        role="radiogroup"
        aria-label="Canvas student task type"
      >
        {CANVAS_STRIP_TYPES.map((type) => {
          const active = value === type.value;
          const Icon = ICONS[type.value];
          const accent = CANVAS_STRIP_ACCENT_CLASS[type.accent];
          return (
            <button
              key={type.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(type.value)}
              className={cn(
                "group relative flex flex-col gap-3 rounded-2xl border p-3.5 text-left transition",
                active
                  ? cn("shadow-sm ring-2", accent.ring, accent.bg)
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={cn(
                    "inline-flex h-9 w-9 items-center justify-center rounded-xl transition",
                    active ? accent.iconBgActive : accent.iconBg
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div
                  className="rounded-lg bg-gradient-to-b from-amber-200 to-amber-300 px-2 py-1.5 shadow-inner"
                  aria-hidden
                >
                  <StripSketch type={type} />
                </div>
              </div>

              <div>
                <span className={cn("block text-sm font-semibold", accent.text)}>
                  {type.label}
                </span>
                <span className="mt-1 block text-xs leading-snug text-slate-600">
                  {type.studentJob}
                </span>
              </div>

              {active && (
                <span
                  className={cn(
                    "absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    accent.soft
                  )}
                >
                  Selected
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
