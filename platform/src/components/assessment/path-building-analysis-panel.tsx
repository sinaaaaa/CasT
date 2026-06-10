"use client";

import { useState } from "react";
import { Route, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PathOutcomeBanner } from "@/components/assessment/path-building/path-outcome-banner";
import { PathProgramCompare } from "@/components/assessment/path-building/path-program-compare";
import { PathMapSection } from "@/components/assessment/path-building/path-map-section";
import type { PathBuildingAnalysisResult } from "@/lib/assessment/pathBuildingAnalysis";

function taskSubLabels(result: PathBuildingAnalysisResult): string[] {
  const labels: string[] = [];
  if (result.hasMultipleGoals) labels.push("Two-goal path");
  if (result.hasObstacle) labels.push("Obstacle path");
  if (result.compareWithOptimalRoute) labels.push("Shortest-route challenge");
  return labels;
}

export function PathBuildingAnalysisPanel({
  result,
}: {
  result: PathBuildingAnalysisResult;
}) {
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const subLabels = taskSubLabels(result);

  return (
    <Card className="overflow-hidden border-sky-200/50 shadow-lg shadow-sky-900/5">
      <CardHeader className="border-b border-sky-100/80 bg-gradient-to-br from-sky-50/90 via-white to-cyan-50/40 px-6 py-4">
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15">
            <Route className="h-4 w-4 text-sky-800" />
          </span>
          Building a Path
        </CardTitle>
        {subLabels.length > 0 && (
          <p className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {subLabels.map((l) => (
              <span
                key={l}
                className="rounded-full border border-sky-200/80 bg-white/80 px-2 py-0.5"
              >
                {l}
              </span>
            ))}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-8 bg-gradient-to-b from-slate-50/30 to-white pt-6">
        <PathOutcomeBanner result={result} />

        <PathProgramCompare
          result={result}
          activeStep={activeStep}
          onStepHover={setActiveStep}
        />

        <PathMapSection result={result} activeStep={activeStep} />

        {result.stageAnalysis.length > 0 && (
          <section className="rounded-xl border border-slate-200/60 bg-white/60 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Stage analysis</h3>
            <ul className="mt-3 space-y-2">
              {result.stageAnalysis.map((stage) => (
                <li
                  key={stage.stage}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 text-sm"
                >
                  <span>
                    Stage {stage.stage}: {stage.from} → {stage.to}
                  </span>
                  <span
                    className={
                      stage.reached ? "text-emerald-700 font-medium" : "text-amber-800"
                    }
                  >
                    {stage.reached ? "Reached" : stage.exactIssue ?? "Not reached"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="flex gap-3 rounded-xl border border-sky-100/80 bg-sky-50/25 p-4">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-900/70">
              Recommendation
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">{result.recommendation}</p>
          </div>
        </footer>
      </CardContent>
    </Card>
  );
}
