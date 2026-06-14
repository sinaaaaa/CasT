"use client";

import { Route } from "lucide-react";
import { AssessmentGridMap } from "@/components/assessment/assessment-grid-map";
import type { DebuggingAnalysisResult } from "@/lib/assessment/debuggingAnalysis";
import { comparisonTargetLabel } from "@/lib/assessment/comparison-target";
import { programsEqual } from "@/lib/assessment/program-diff-visual";

/** Selected diagnosis route vs BFS shortest — static maps for quick review. */
export function DebuggingRouteCompare({
  result,
  activeStep,
}: {
  result: DebuggingAnalysisResult;
  activeStep: number | null;
}) {
  const referencePath = result.correctPath;
  const referenceCommands =
    result.selectedComparisonRoute.length > 0
      ? result.selectedComparisonRoute
      : result.correctProgram;
  const shortestPath = result.optimalPath;
  const shortestCommands = result.preferredWorkingFix?.commands ?? [];

  const showShortest =
    shortestPath.length > 1 &&
    shortestCommands.length > 0 &&
    referenceCommands.length > 0 &&
    !programsEqual(shortestCommands, referenceCommands);

  if (referencePath.length <= 1 && shortestPath.length <= 1) return null;

  const mapProps = {
    routeStartPosition: result.routeStartPosition,
    routeGoalPosition: result.routeGoalPosition,
    goalLabel: result.goalLabel,
    studentEndPosition: result.routeGoalPosition,
    objectMarkers: result.objectMarkers,
    animatePath: false as const,
    pulseGoal: true,
    highlightStep: activeStep,
    dimmed: activeStep != null,
  };

  return (
    <section className="space-y-3">
      <div className="flex items-start gap-2">
        <Route className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Route comparison</h3>
          <p className="text-xs text-muted-foreground">
            {showShortest
              ? `${comparisonTargetLabel(result.comparisonUsed)} vs BFS shortest path`
              : comparisonTargetLabel(result.comparisonUsed)}
          </p>
        </div>
      </div>
      <div className={showShortest ? "grid gap-3 md:grid-cols-2" : "max-w-md"}>
        {referencePath.length > 1 && (
          <AssessmentGridMap
            title="How it should look"
            subtitle={`${referenceCommands.length} commands · ${comparisonTargetLabel(result.comparisonUsed).toLowerCase()}`}
            path={referencePath}
            collisions={[]}
            pathClass="bg-emerald-500"
            borderClass="border-emerald-200/80 bg-white/95"
            {...mapProps}
          />
        )}
        {showShortest && (
          <AssessmentGridMap
            title="Best (shortest) way"
            subtitle={`${shortestCommands.length} commands · fewest needed`}
            path={shortestPath}
            collisions={[]}
            pathClass="bg-amber-400"
            borderClass="border-amber-200/80 bg-white/95"
            {...mapProps}
          />
        )}
      </div>
    </section>
  );
}
