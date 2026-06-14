"use client";

import { useMemo } from "react";
import type { NumberLineEvidence } from "@/lib/assessment/assessmentTypes";
import { cn } from "@/lib/utils";

function tickLabel(tick: number): string {
  return `Tick ${tick + 1}`;
}

export function NumberLineMap({ evidence }: { evidence: NumberLineEvidence }) {
  const tickMax = useMemo(() => {
    const ticks = [
      evidence.startTick,
      evidence.endTick,
      evidence.goalTick ?? 0,
      evidence.visit1?.tick ?? 0,
      evidence.visit2?.tick ?? 0,
      ...evidence.optimalPathTicks,
      ...evidence.movementSteps.map((s) => Math.max(s.tickBefore, s.tickAfter)),
    ];
    return Math.max(...ticks, 0) + 1;
  }, [evidence]);

  const studentTicks = useMemo(() => {
    const path = [evidence.startTick];
    for (const step of evidence.movementSteps) path.push(step.tickAfter);
    return path;
  }, [evidence]);

  const markers = [
    { tick: evidence.startTick, label: "Start", tone: "start" as const },
    ...(evidence.visit1
      ? [{ tick: evidence.visit1.tick, label: evidence.visit1.label, tone: "visit1" as const }]
      : []),
    ...(evidence.visit2
      ? [{ tick: evidence.visit2.tick, label: evidence.visit2.label, tone: "visit2" as const }]
      : []),
    ...(evidence.goalTick != null && !evidence.visit2
      ? [{ tick: evidence.goalTick, label: "Goal", tone: "goal" as const }]
      : []),
  ];

  const studentTickSet = new Set(studentTicks);
  const optimalTickSet = new Set(evidence.optimalPathTicks);

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <div className="flex flex-wrap gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-6 rounded-full bg-indigo-500" />
          Student path
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-6 rounded-full border-2 border-dashed border-emerald-500 bg-emerald-100" />
          Best route
        </span>
      </div>

      <div className="relative mx-auto max-w-3xl pt-8 pb-4">
        <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-slate-300" />
        <div className="relative flex justify-between gap-1">
          {Array.from({ length: tickMax }, (_, tick) => {
            const marker = markers.find((m) => m.tick === tick);
            const onStudent = studentTickSet.has(tick);
            const onOptimal = optimalTickSet.has(tick);
            const isEnd = tick === evidence.endTick;
            return (
              <div key={tick} className="flex flex-1 flex-col items-center">
                <div
                  className={cn(
                    "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white text-xs font-semibold",
                    isEnd && "border-indigo-500 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-200",
                    !isEnd && onStudent && "border-indigo-400 bg-indigo-50/60",
                    !isEnd && onOptimal && !onStudent && "border-emerald-400 bg-emerald-50/60",
                    !isEnd && !onStudent && !onOptimal && "border-slate-300 text-slate-600",
                    marker?.tone === "visit1" && "border-amber-400",
                    marker?.tone === "visit2" && "border-violet-400",
                    marker?.tone === "goal" && "border-emerald-500"
                  )}
                >
                  {isEnd ? "🤖" : tick + 1}
                </div>
                {marker && (
                  <p className="mt-1 max-w-[4rem] truncate text-center text-[10px] capitalize text-slate-600">
                    {marker.label}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
        <p>
          <span className="font-medium">Student ended at:</span> {tickLabel(evidence.endTick)}
        </p>
        <p>
          <span className="font-medium">Best route ends at:</span>{" "}
          {tickLabel(evidence.optimalPathTicks[evidence.optimalPathTicks.length - 1] ?? evidence.startTick)}
        </p>
      </div>
    </div>
  );
}
