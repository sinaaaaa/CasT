"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { NumberLineEvidence } from "@/lib/assessment/assessmentTypes";
import { CommandIconSequence } from "@/components/assessment/command-icon-sequence";
import type { CommandToken } from "@/lib/command-icons";
import { cn } from "@/lib/utils";

function tickLabel(tick: number): string {
  return `Tick ${tick + 1}`;
}

const FACING_ARROW: Record<string, string> = {
  left: "←",
  right: "→",
  up: "↑",
  down: "↓",
};

export function NumberLineReplay({ evidence }: { evidence: NumberLineEvidence }) {
  const tickMax = useMemo(() => {
    const ticks = [
      evidence.startTick,
      evidence.endTick,
      evidence.goalTick ?? 0,
      evidence.visit1?.tick ?? 0,
      evidence.visit2?.tick ?? 0,
      ...evidence.movementSteps.map((s) => Math.max(s.tickBefore, s.tickAfter)),
    ];
    return Math.max(...ticks, 0) + 1;
  }, [evidence]);

  const positions = useMemo(() => {
    const path = [evidence.startTick];
    for (const step of evidence.movementSteps) path.push(step.tickAfter);
    return path;
  }, [evidence]);

  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const maxStep = Math.max(0, positions.length - 1);
  const currentTick = positions[stepIndex] ?? evidence.startTick;
  const movementStep =
    stepIndex > 0 ? evidence.movementSteps[stepIndex - 1] ?? null : null;

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setStepIndex((i) => {
        if (i >= maxStep) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 700);
    return () => window.clearInterval(id);
  }, [playing, maxStep]);

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

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <div className="relative mx-auto max-w-3xl pt-8 pb-4">
        <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-slate-300" />
        <div className="relative flex justify-between gap-1">
          {Array.from({ length: tickMax }, (_, tick) => {
            const marker = markers.find((m) => m.tick === tick);
            const isRobotHere = tick === currentTick;
            return (
              <div key={tick} className="flex flex-1 flex-col items-center">
                <div
                  className={cn(
                    "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white text-xs font-semibold transition-all",
                    isRobotHere
                      ? "border-indigo-500 bg-indigo-50 text-indigo-900 shadow-md ring-2 ring-indigo-200"
                      : "border-slate-300 text-slate-600",
                    marker?.tone === "visit1" && !isRobotHere && "border-amber-400",
                    marker?.tone === "visit2" && !isRobotHere && "border-violet-400",
                    marker?.tone === "goal" && !isRobotHere && "border-emerald-400"
                  )}
                >
                  {isRobotHere ? "🤖" : tick + 1}
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

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-white hover:bg-slate-50"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            type="button"
            disabled={stepIndex <= 0}
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-white disabled:opacity-40"
            aria-label="Previous step"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={stepIndex >= maxStep}
            onClick={() => setStepIndex((i) => Math.min(maxStep, i + 1))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-white disabled:opacity-40"
            aria-label="Next step"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="text-sm text-slate-700">
            Step {stepIndex} of {maxStep} · {tickLabel(currentTick)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          {movementStep ? (
            <>
              <StepCommandIcon command={movementStep.command} />
              <span>
                {tickLabel(movementStep.tickBefore)} → {tickLabel(movementStep.tickAfter)}
              </span>
              {!movementStep.correspondenceOk && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
                  mismatch
                </span>
              )}
            </>
          ) : (
            <span>
              At start · facing {evidence.startFacing}{" "}
              {FACING_ARROW[evidence.startFacing] ?? ""}
            </span>
          )}
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={maxStep}
        value={stepIndex}
        onChange={(e) => {
          setPlaying(false);
          setStepIndex(Number(e.target.value));
        }}
        className="w-full accent-indigo-600"
        aria-label="Replay step"
      />
    </div>
  );
}

function StepCommandIcon({ command }: { command: string }) {
  const tok = command as CommandToken;
  if (!["forward", "backward", "turn left", "turn right"].includes(tok)) return null;
  return <CommandIconSequence commands={[tok]} size={28} />;
}
