"use client";

import { ArrowRight } from "lucide-react";

/** Multi-stage visit path: Start → Banana → Trash */
export function VisitPathDiagram({ labels }: { labels: string[] }) {
  const steps = ["Start", ...labels];
  return (
    <div className="rounded-lg border bg-slate-50 px-4 py-3">
      <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Visit sequence</p>
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium capitalize text-slate-800">
        {steps.map((label, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="rounded-full border bg-white px-3 py-1 shadow-sm">{label}</span>
            {i < steps.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Shows the order of goals the level expected the student to reach.
      </p>
    </div>
  );
}
