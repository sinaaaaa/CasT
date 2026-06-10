"use client";

import { useState } from "react";
import {
  Flag,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Compass,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CommandIconSequence } from "@/components/assessment/command-icon-sequence";
import { formatGridCell } from "@/lib/assessment/routeAnalysis";
import {
  flagPlacementOutcomeLabel,
  predictionDiagnosticCaption,
  predictionResultLabel,
  type PredictionAnalysisResult,
} from "@/lib/assessment/predictionAnalysis";
import { PredictionGridViz } from "@/components/assessment/prediction-grid-viz";
import type { Vec2 } from "@/lib/assessment/assessmentTypes";

export function PredictionAnalysisPanel({
  result,
  startPosition,
}: {
  result: PredictionAnalysisResult;
  startPosition?: Vec2 | null;
}) {
  const [showDetails, setShowDetails] = useState(false);

  const resultBadge = result.isCorrect
    ? "success"
    : result.detectedMistakeType === "oneStepCountingError"
      ? "warning"
      : "danger";

  const visibleSimulations = result.misconceptionMatches.filter((m) => {
    if (m.modelId === "correct") return true;
    if (m.modelId.startsWith("wrongStartDirection")) return showDetails;
    return (
      showDetails ||
      m.exactMatch ||
      m.modelId === "leftRightSwapped" ||
      m.modelId === "turnAsMove" ||
      m.modelId === "ignoreTurns"
    );
  });

  const showMap = startPosition != null;

  return (
    <Card className="overflow-hidden border-violet-300/60 shadow-md">
      <CardHeader className="border-b bg-gradient-to-r from-violet-50 via-white to-indigo-50/40 pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Flag className="h-5 w-5 text-violet-700" />
              Predicting robot movement
            </CardTitle>
            <CardDescription>
              Student flag vs where the robot ends after the given commands (not route efficiency).
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:min-w-[240px]">
            <div
              className={`rounded-xl border px-4 py-2.5 ${
                result.isCorrect
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-red-200 bg-red-50"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Item outcome
              </p>
              <p className="mt-0.5 flex items-center gap-2 text-base font-semibold">
                {result.isCorrect ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                {flagPlacementOutcomeLabel(result.isCorrect)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {result.isCorrect ? "100% game score" : "0% game score — flag not on simulated end cell"}
              </p>
            </div>
            <div
              className={`rounded-xl border px-4 py-2.5 ${
                result.isCorrect
                  ? "border-emerald-200/80 bg-emerald-50/50"
                  : resultBadge === "warning"
                    ? "border-amber-200 bg-amber-50"
                    : "border-violet-200 bg-violet-50/60"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Diagnostic insight
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <Badge variant={resultBadge} className="text-sm">
                  {predictionResultLabel(result)}
                </Badge>
                <span className="text-base font-semibold">{result.score}%</span>
              </div>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                {predictionDiagnosticCaption(result)}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {showMap && startPosition && (
            <div className="rounded-xl border bg-slate-50/80 p-4 lg:order-2">
              <p className="mb-3 text-sm font-semibold text-slate-900">Placement map</p>
              <PredictionGridViz
                startPosition={startPosition}
                studentFlag={result.studentFlagPosition}
                expectedPosition={result.expectedFinalPosition}
                misconceptionMatches={result.misconceptionMatches}
              />
            </div>
          )}

          <div className={`space-y-4 ${showMap ? "lg:order-1" : ""}`}>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Commands on the item
              </p>
              <div className="mt-3">
                <CommandIconSequence commands={result.givenCommands} size={40} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-rose-200/80 bg-rose-50/40 p-3">
                <p className="text-xs font-medium text-rose-900/80">Student flag</p>
                <p className="mt-1 text-base font-semibold text-rose-950">
                  {result.studentFlagPosition
                    ? formatGridCell(result.studentFlagPosition)
                    : "Not recorded"}
                </p>
              </div>
              <div className="rounded-xl border border-violet-200/80 bg-violet-50/40 p-3">
                <p className="text-xs font-medium text-violet-900/80">Expected (simulation)</p>
                <p className="mt-1 text-base font-semibold text-violet-950">
                  {result.expectedFinalPosition
                    ? formatGridCell(result.expectedFinalPosition)
                    : "—"}
                </p>
              </div>
            </div>

            {result.distanceFromExpected > 0 && !result.isCorrect && (
              <p className="text-sm text-muted-foreground">
                Distance from expected cell:{" "}
                <span className="font-medium text-slate-800">{result.distanceFromExpected}</span>{" "}
                {result.distanceFromExpected === 1 ? "step" : "steps"}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex gap-3 rounded-xl border border-violet-200 bg-violet-50/50 p-4">
            <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-violet-700" />
            <div>
              <p className="text-sm font-semibold text-violet-950">What this suggests</p>
              <p className="mt-1 text-sm leading-relaxed text-violet-900/90">
                {result.teacherExplanation}
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
            <Compass className="mt-0.5 h-5 w-5 shrink-0 text-indigo-700" />
            <div>
              <p className="text-sm font-semibold text-indigo-950">Recommended next</p>
              <p className="mt-1 text-sm leading-relaxed text-indigo-900/90">
                {result.recommendation}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground"
            onClick={() => setShowDetails((v) => !v)}
          >
            {showDetails ? (
              <>
                <ChevronUp className="h-4 w-4" /> Hide misconception models
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" /> Show misconception models
              </>
            )}
          </Button>

          {showDetails && (
            <div className="mt-3 overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Model</th>
                    <th className="px-3 py-2">End cell</th>
                    <th className="px-3 py-2">Distance</th>
                    <th className="px-3 py-2">Match</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSimulations.map((m) => (
                    <tr key={m.modelId} className="border-t">
                      <td className="px-3 py-2">{m.label}</td>
                      <td className="px-3 py-2">{formatGridCell(m.finalPosition)}</td>
                      <td className="px-3 py-2">{m.distance}</td>
                      <td className="px-3 py-2">
                        {m.exactMatch ? (
                          <Badge variant="success">Exact</Badge>
                        ) : m.distance <= 1 ? (
                          <Badge variant="warning">Close</Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
