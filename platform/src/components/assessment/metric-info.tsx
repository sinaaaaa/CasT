"use client";

import { Info } from "lucide-react";
import type { GlossaryKey } from "@/lib/assessment/assessmentGlossary";
import { ASSESSMENT_GLOSSARY } from "@/lib/assessment/assessmentGlossary";

export function MetricInfo({ metric }: { metric: GlossaryKey }) {
  const entry = ASSESSMENT_GLOSSARY[metric];
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={`About ${entry.title}`}
        title={entry.description}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-64 -translate-x-1/2 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md group-hover:block group-focus-within:block"
      >
        <strong className="block text-foreground">{entry.title}</strong>
        {entry.description}
      </span>
    </span>
  );
}
