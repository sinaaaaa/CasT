"use client";

import { useState } from "react";
import { Bug, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DebuggingPathSection } from "@/components/assessment/debugging/debugging-path-section";
import { DebuggingRouteCompare } from "@/components/assessment/debugging/debugging-route-compare";
import { ProgramDiffVisualizer } from "@/components/assessment/debugging/program-diff-visualizer";
import { RepairOutcomeBanner } from "@/components/assessment/debugging/repair-outcome-banner";
import type { DebuggingAnalysisResult } from "@/lib/assessment/debuggingAnalysis";

export function DebuggingAnalysisPanel({
  result,
}: {
  result: DebuggingAnalysisResult;
}) {
  const [activeStep, setActiveStep] = useState<number | null>(null);

  const hasPaths =
    result.showPathDetails &&
    (result.originalPath.length > 1 ||
      result.studentPath.length > 1 ||
      result.correctPath.length > 1);

  return (
    <Card className="overflow-hidden border-amber-200/50 shadow-lg shadow-amber-900/5">
      <CardHeader className="border-b border-amber-100/80 bg-gradient-to-br from-amber-50/90 via-white to-orange-50/40 px-6 py-4 backdrop-blur-sm">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15">
            <Bug className="h-4 w-4 text-amber-800" />
          </span>
          Edit starter program — debugging assessment
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6 bg-gradient-to-b from-slate-50/30 to-white pt-6">
        <RepairOutcomeBanner result={result} />

        <ProgramDiffVisualizer
          result={result}
          activeStep={activeStep}
          onStepHover={setActiveStep}
        />

        {(result.correctPath.length > 1 || result.optimalPath.length > 1) && (
          <DebuggingRouteCompare result={result} activeStep={activeStep} />
        )}

        {hasPaths && (
          <DebuggingPathSection
            result={result}
            activeStep={activeStep}
            defaultOpen={false}
          />
        )}

        <footer className="flex gap-3 rounded-xl border border-amber-100/80 bg-amber-50/25 p-4 backdrop-blur-sm">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/70">
              Recommended next
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">{result.recommendation}</p>
          </div>
        </footer>
      </CardContent>
    </Card>
  );
}
