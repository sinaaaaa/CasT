"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from "lucide-react";
import { AssessmentGridMap } from "@/components/assessment/assessment-grid-map";
import type { PathState, Vec2 } from "@/lib/assessment/assessmentTypes";
import type { GridObjectMarker } from "@/lib/assessment/assessmentConfig";
import {
  COMMAND_ARIA_LABELS,
  COMMAND_ICON_PATHS,
  type CommandToken,
} from "@/lib/command-icons";
import { cn } from "@/lib/utils";

const STEP_INTERVAL_MS = 850;

/**
 * "Replay this attempt" — steps the robot through its program one command at a
 * time so anyone can watch what happened. Drives the grid map's reveal/highlight
 * by the current step; no new rendering logic needed.
 */
export function RouteReplayPlayer({
  path,
  pathStates,
  commands = [],
  routeStartPosition,
  routeGoalPosition,
  goalLabel = "goal",
  studentEndPosition,
  objectMarkers = [],
  collisions = [],
  attemptedObstacleCell = null,
  pathClass = "bg-sky-500",
  borderClass = "border-sky-200/80 bg-sky-50/30",
  title = "Replay",
  subtitle = "Watch the robot run, one command at a time",
}: {
  path: Vec2[];
  pathStates?: PathState[];
  commands?: CommandToken[];
  routeStartPosition: Vec2;
  routeGoalPosition: Vec2;
  goalLabel?: string;
  studentEndPosition?: Vec2 | null;
  objectMarkers?: GridObjectMarker[];
  collisions?: Vec2[];
  attemptedObstacleCell?: Vec2 | null;
  pathClass?: string;
  borderClass?: string;
  title?: string;
  subtitle?: string;
}) {
  const maxStep = Math.max(0, path.length - 1);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => {
    if (!playing) {
      clearTimer();
      return;
    }
    timer.current = setInterval(() => {
      setStep((s) => {
        if (s >= maxStep) {
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, STEP_INTERVAL_MS);
    return clearTimer;
  }, [playing, maxStep, clearTimer]);

  const togglePlay = () => {
    if (step >= maxStep) {
      setStep(0);
      setPlaying(true);
    } else {
      setPlaying((p) => !p);
    }
  };

  const goTo = (next: number) => {
    setPlaying(false);
    setStep(Math.min(maxStep, Math.max(0, next)));
  };

  if (maxStep < 1) return null;

  // commands[i] produced the position at path[i + 1]; the "current command" is
  // the one that moved the robot into the cell now highlighted.
  const currentCommand = step > 0 ? commands[step - 1] : undefined;
  const atGoal =
    step === maxStep &&
    studentEndPosition != null &&
    studentEndPosition.x === routeGoalPosition.x &&
    studentEndPosition.y === routeGoalPosition.y;

  return (
    <div className="space-y-3 rounded-xl border border-sky-200/70 bg-white/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-700">
            <Play className="h-3.5 w-3.5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="text-[11px] text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium tabular-nums text-slate-700">
          Step {step} of {maxStep}
        </div>
      </div>

      <AssessmentGridMap
        title={`Robot position after Step ${step}`}
        subtitle={
          step === 0
            ? "At the start"
            : currentCommand
              ? `Just ran: ${COMMAND_ARIA_LABELS[currentCommand]}`
              : `After Step ${step}`
        }
        path={path}
        pathStates={pathStates}
        collisions={collisions}
        pathClass={pathClass}
        borderClass={borderClass}
        routeStartPosition={routeStartPosition}
        routeGoalPosition={routeGoalPosition}
        goalLabel={goalLabel}
        studentEndPosition={studentEndPosition}
        objectMarkers={objectMarkers}
        attemptedObstacleCell={attemptedObstacleCell}
        animatePath={false}
        highlightStep={step}
        fadeAfterStep={step}
        pulseGoal={atGoal}
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => goTo(step - 1)}
          disabled={step === 0}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
          aria-label="Step back"
        >
          <SkipBack className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={togglePlay}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-sky-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-sky-700"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <>
              <Pause className="h-4 w-4" /> Pause
            </>
          ) : step >= maxStep ? (
            <>
              <RotateCcw className="h-4 w-4" /> Replay
            </>
          ) : (
            <>
              <Play className="h-4 w-4" /> Play
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => goTo(step + 1)}
          disabled={step >= maxStep}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
          aria-label="Step forward"
        >
          <SkipForward className="h-4 w-4" />
        </button>

        <input
          type="range"
          min={0}
          max={maxStep}
          value={step}
          onChange={(e) => goTo(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-sky-600"
          aria-label="Scrub through steps"
        />

        {currentCommand && (
          <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700">
            <Image
              src={COMMAND_ICON_PATHS[currentCommand]}
              alt=""
              width={16}
              height={16}
              className="object-contain"
            />
            {COMMAND_ARIA_LABELS[currentCommand]}
          </span>
        )}
      </div>
    </div>
  );
}
