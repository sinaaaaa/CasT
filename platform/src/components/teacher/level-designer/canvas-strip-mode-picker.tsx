"use client";

import { CANVAS_STRIP_TYPES, type CanvasStripMode } from "@/lib/canvas-strip-types";
import { cn } from "@/lib/utils";

type Props = {
  value: CanvasStripMode;
  onChange: (mode: CanvasStripMode) => void;
};

/** Compact strip-type switch — one row, no heavy cards. */
export function CanvasStripModePicker({ value, onChange }: Props) {
  const active = CANVAS_STRIP_TYPES.find((t) => t.value === value) ?? CANVAS_STRIP_TYPES[0]!;

  return (
    <div className="space-y-2">
      <div
        className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1"
        role="radiogroup"
        aria-label="Yellow strip type"
      >
        {CANVAS_STRIP_TYPES.map((type) => {
          const selected = value === type.value;
          return (
            <button
              key={type.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(type.value)}
              className={cn(
                "flex-1 rounded-lg px-2.5 py-2 text-center text-xs font-semibold transition sm:text-sm",
                selected
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              {type.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">{active.studentJob}</p>
    </div>
  );
}
