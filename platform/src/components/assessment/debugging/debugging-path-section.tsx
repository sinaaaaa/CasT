"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Map } from "lucide-react";
import {
  AssessmentGridMap,
  GridMapLegend,
  RouteMapAnchorBar,
} from "@/components/assessment/assessment-grid-map";
import type { DebuggingAnalysisResult } from "@/lib/assessment/debuggingAnalysis";
import { buildFirstMistakeMessages } from "@/lib/assessment/program-diff-visual";

const staticMap = { animatePath: false as const };

export function DebuggingPathSection({
  result,
  activeStep,
  defaultOpen = false,
}: {
  result: DebuggingAnalysisResult;
  activeStep: number | null;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const hasPaths =
    result.originalPath.length > 1 ||
    result.studentPath.length > 1 ||
    result.correctPath.length > 1;

  if (!hasPaths) return null;

  const firstMistakeStep = result.firstMistakeStep;
  const mistakeMessages = buildFirstMistakeMessages(firstMistakeStep, {
    studentLength: result.studentProgram.length,
    repairStatus: result.repairStatus,
  });
  const attemptedObstacle = result.attemptedObstacleCells[0] ?? null;

  const mapProps = {
    routeStartPosition: result.routeStartPosition,
    routeGoalPosition: result.routeGoalPosition,
    goalLabel: result.goalLabel,
    studentEndPosition: result.studentEndPosition,
    objectMarkers: result.objectMarkers,
    ...staticMap,
  };

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-b from-slate-50/80 to-white">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-100/50"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Map className="h-4 w-4 text-slate-600" />
          Full robot paths (starter · student · closest fix)
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="space-y-4 border-t border-slate-200/80 p-4">
          <RouteMapAnchorBar
            routeStartPosition={result.routeStartPosition}
            routeGoalPosition={result.routeGoalPosition}
            goalLabel={result.goalLabel}
            studentEndPosition={result.studentEndPosition}
          />
          <GridMapLegend compact />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {result.originalPath.length > 1 && (
              <AssessmentGridMap
                title="Starter path"
                subtitle="Buggy program"
                path={result.originalPath}
                pathStates={result.originalPathStates}
                collisions={[]}
                pathClass="bg-slate-500"
                borderClass="border-slate-300/80 bg-white/95"
                highlightStep={activeStep}
                pulseGoal
                dimmed={activeStep != null}
                {...mapProps}
                studentEndPosition={result.originalPath[result.originalPath.length - 1]}
              />
            )}
            {result.studentPath.length > 1 && (
              <AssessmentGridMap
                title="Student path"
                subtitle={
                  mistakeMessages?.pathMapSubtitle ?? "After the student's repair"
                }
                path={result.studentPath}
                pathStates={result.studentPathStates}
                collisions={result.attemptedObstacleCells}
                pathClass="bg-sky-500"
                borderClass="border-sky-200/80 bg-white/95 ring-1 ring-sky-100"
                highlightStep={activeStep}
                fadeAfterStep={firstMistakeStep}
                attemptedObstacleCell={attemptedObstacle}
                pulseGoal
                {...mapProps}
              />
            )}
            {result.correctPath.length > 1 && (
              <AssessmentGridMap
                title="Closest fix path"
                subtitle={
                  result.closestWorkingFix?.isShortest
                    ? "Shortest valid program"
                    : "Closest valid route"
                }
                path={result.correctPath}
                collisions={[]}
                pathClass="bg-emerald-500"
                borderClass="border-emerald-200/80 bg-white/95"
                highlightStep={activeStep}
                pulseGoal
                dimmed={activeStep != null}
                {...mapProps}
                studentEndPosition={result.routeGoalPosition}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
