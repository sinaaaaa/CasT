"use client";

import { Lightbulb } from "lucide-react";
import type { ReactNode } from "react";

/** Shared "Recommended next" footer used by every assessment panel. */
export function PanelRecommendation({
  children,
  label = "Recommended next",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <footer className="flex gap-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-900/70">
          {label}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-700">{children}</p>
      </div>
    </footer>
  );
}
