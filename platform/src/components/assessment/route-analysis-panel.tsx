"use client";

import { useState } from "react";
import { Map, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MetricInfo } from "@/components/assessment/metric-info";
import { RouteComparisonViz } from "@/components/assessment/route-comparison-viz";
import {
  AssessmentGridMap,
  GridMapLegend,
  RouteMapAnchorBar,
} from "@/components/assessment/assessment-grid-map";
import type { GridObjectMarker } from "@/lib/assessment/assessmentConfig";
import { VisitPathDiagram } from "@/components/assessment/visit-path-diagram";
import { CommandIconSequence } from "@/components/assessment/command-icon-sequence";
import type { CommandToken } from "@/lib/command-icons";
import type { RouteComparison } from "@/lib/assessment/assessmentTypes";

export type RouteAnalysisPanelProps = {
  attemptId: string;
  routeComparison: RouteComparison | null;
  interpretation: string;
  supported: boolean;
  commandProgram?: string | null;
  visitLabels?: string[];
  /** Edit starter program levels — show level starter vs student program. */
  isDragEditLevel?: boolean;
  starterProgram?: CommandToken[];
  studentProgram?: CommandToken[];
  starterPath?: { x: number; y: number }[];
  starterPathStates?: import("@/lib/assessment/assessmentTypes").PathState[];
  /** Fallback paths when routeComparison is null (e.g. legacy attempts). */
  studentPath?: { x: number; y: number }[];
  optimalPath?: { x: number; y: number }[];
  routeStartPosition?: { x: number; y: number } | null;
  routeGoalPosition?: { x: number; y: number } | null;
  routeGoalLabel?: string;
  objectMarkers?: GridObjectMarker[];
};

export function RouteAnalysisPanel({
  attemptId,
  routeComparison,
  interpretation,
  supported,
  visitLabels,
  isDragEditLevel,
  starterProgram,
  studentProgram,
  starterPath,
  starterPathStates,
  studentPath,
  optimalPath,
  routeStartPosition,
  routeGoalPosition,
  routeGoalLabel = "goal",
  objectMarkers = [],
}: RouteAnalysisPanelProps) {
  const start = routeStartPosition ?? { x: 0, y: 0 };
  const goal = routeGoalPosition ?? start;
  const [busy, setBusy] = useState(false);

  async function reanalyze() {
    setBusy(true);
    try {
      await fetch("/api/ct/analyze-attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId }),
      });
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-lg">Route comparison</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{interpretation}</CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-sky-300/60 shadow-md">
      <CardHeader className="border-b bg-gradient-to-r from-sky-50 to-indigo-50/50">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Map className="h-5 w-5 text-sky-700" />
              Student route vs best route
              <MetricInfo metric="routeComparison" />
            </CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              {isDragEditLevel
                ? "Compares the student’s edited program to the item goal on the grid. Violet = win cell (e.g. bed), not where the path happens to end."
                : "Compares full command programs using the same rules as the game. Violet = level goal cell."}
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={reanalyze} disabled={busy}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${busy ? "animate-spin" : ""}`} />
            Re-analyze
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        <p className="rounded-lg border border-sky-200/80 bg-sky-50 px-4 py-3 text-sm leading-relaxed text-sky-950">
          {interpretation}
        </p>

        {routeComparison ? (
          <RouteComparisonViz
            comparison={routeComparison}
            starterPath={isDragEditLevel ? starterPath : undefined}
            starterPathStates={isDragEditLevel ? starterPathStates : undefined}
            goalLabel={routeGoalLabel}
            objectMarkers={objectMarkers}
          />
        ) : isDragEditLevel &&
          ((studentPath?.length ?? 0) > 1 ||
            (starterPath?.length ?? 0) > 1 ||
            (optimalPath?.length ?? 0) > 1) ? (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <RouteMapAnchorBar
              routeStartPosition={start}
              routeGoalPosition={goal}
              goalLabel={routeGoalLabel}
              studentEndPosition={
                studentPath?.length ? studentPath[studentPath.length - 1] : null
              }
            />
            <GridMapLegend />
            <div
              className={`grid gap-4 ${
                (starterPath?.length ?? 0) > 1 && (optimalPath?.length ?? 0) > 1
                  ? "md:grid-cols-3"
                  : "md:grid-cols-2"
              }`}
            >
              {(starterPath?.length ?? 0) > 1 && (
                <AssessmentGridMap
                  title="Starter program path"
                  subtitle="Initial yellow-strip program"
                  path={starterPath!}
                  pathStates={starterPathStates}
                  collisions={[]}
                  pathClass="bg-slate-500"
                  borderClass="border-slate-300 bg-white"
                  routeStartPosition={start}
                  routeGoalPosition={goal}
                  goalLabel={routeGoalLabel}
                  objectMarkers={objectMarkers}
                  studentEndPosition={starterPath![starterPath!.length - 1]}
                />
              )}
              {(studentPath?.length ?? 0) > 1 && (
                <AssessmentGridMap
                  title="Student path"
                  subtitle="Student’s edited program"
                  path={studentPath!}
                  collisions={[]}
                  pathClass="bg-sky-500"
                  borderClass="border-sky-200 bg-white"
                  routeStartPosition={start}
                  routeGoalPosition={goal}
                  goalLabel={routeGoalLabel}
                  objectMarkers={objectMarkers}
                  studentEndPosition={studentPath![studentPath!.length - 1]}
                />
              )}
              {(optimalPath?.length ?? 0) > 1 && (
                <AssessmentGridMap
                  title="Best path"
                  subtitle="Shortest command sequence"
                  path={optimalPath!}
                  collisions={[]}
                  pathClass="bg-amber-400"
                  borderClass="border-amber-200 bg-white"
                  routeStartPosition={start}
                  routeGoalPosition={goal}
                  goalLabel={routeGoalLabel}
                  objectMarkers={objectMarkers}
                  studentEndPosition={goal}
                />
              )}
            </div>
          </div>
        ) : isDragEditLevel ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            No program was recorded for this attempt. Ask the student to press RUN before finishing,
            or check the command timeline below.
          </p>
        ) : null}

        {isDragEditLevel && (starterProgram?.length || studentProgram?.length) ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Item starter program
              </p>
              <div className="mt-2">
                {starterProgram?.length ? (
                  <CommandIconSequence commands={starterProgram} size={36} />
                ) : (
                  <p className="text-sm text-muted-foreground">Not recorded</p>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-900">
                Student program (last RUN)
              </p>
              <div className="mt-2">
                {studentProgram?.length ? (
                  <CommandIconSequence commands={studentProgram} size={36} />
                ) : (
                  <p className="text-sm text-amber-800">No RUN recorded — use command timeline below</p>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {visitLabels && visitLabels.length >= 2 && <VisitPathDiagram labels={visitLabels} />}

        {!routeComparison && !isDragEditLevel ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            No program was recorded for this attempt. Route comparison needs commands from the yellow
            strip or the item starter program.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
