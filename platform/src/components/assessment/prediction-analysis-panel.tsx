"use client";

import { Flag, CheckCircle2, XCircle, Lightbulb, Map, Stethoscope } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssessmentPanelHeader } from "@/components/assessment/assessment-panel-header";
import { DiagnosticScoreInfo, ItemOutcomeInfo } from "@/components/assessment/diagnostic-score-info";
import { PanelRecommendation } from "@/components/assessment/panel-recommendation";
import { CommandIconSequence } from "@/components/assessment/command-icon-sequence";
import { formatGridCell } from "@/lib/assessment/routeAnalysis";
import {
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
  const resultBadge = result.isCorrect
    ? "success"
    : result.detectedMistakeType === "oneStepCountingError"
      ? "warning"
      : "danger";

  const showMap = startPosition != null;
  const hasModels = result.misconceptionMatches.length > 0;

  return (
    <Card className="overflow-hidden border-slate-200/70 shadow-sm">
      <AssessmentPanelHeader
        icon={Flag}
        title="Predicting robot movement"
        subtitle="Where the student placed the flag vs where the robot actually stops."
        badges={
          <>
            <Badge
              variant={result.isCorrect ? "success" : "danger"}
              className="gap-1 text-sm"
            >
              {result.isCorrect ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              {result.isCorrect ? "Correct" : "Incorrect"}
              <ItemOutcomeInfo />
            </Badge>
            <Badge variant={resultBadge} className="gap-1 text-sm">
              {predictionResultLabel(result)} · {result.score}%
              <DiagnosticScoreInfo variant="flag" />
            </Badge>
          </>
        }
      />

      <CardContent className="space-y-6 pt-6">
        <Tabs defaultValue="what" className="w-full">
          <TabsList>
            <TabsTrigger value="what" className="gap-1.5">
              <Stethoscope className="h-4 w-4" />
              What happened
            </TabsTrigger>
            {showMap && (
              <TabsTrigger value="map" className="gap-1.5">
                <Map className="h-4 w-4" />
                Placement map
              </TabsTrigger>
            )}
            {hasModels && (
              <TabsTrigger value="models" className="gap-1.5">
                <Lightbulb className="h-4 w-4" />
                Misconception models
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="what" className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
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
              <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/40 p-3">
                <p className="text-xs font-medium text-indigo-900/80">
                  Where the robot stops
                </p>
                <p className="mt-1 text-base font-semibold text-indigo-950">
                  {result.expectedFinalPosition
                    ? formatGridCell(result.expectedFinalPosition)
                    : "—"}
                </p>
              </div>
            </div>

            {result.distanceFromExpected > 0 && !result.isCorrect && (
              <p className="text-sm text-muted-foreground">
                Distance from the correct cell:{" "}
                <span className="font-medium text-slate-800">
                  {result.distanceFromExpected}
                </span>{" "}
                {result.distanceFromExpected === 1 ? "step" : "steps"}
              </p>
            )}

            <div className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
              <div>
                <p className="text-sm font-semibold text-slate-900">What this suggests</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-700">
                  {result.teacherExplanation}
                </p>
                <p className="mt-2 text-xs leading-snug text-muted-foreground">
                  {predictionDiagnosticCaption(result)}
                </p>
              </div>
            </div>
          </TabsContent>

          {showMap && startPosition && (
            <TabsContent value="map">
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <PredictionGridViz
                  startPosition={startPosition}
                  studentFlag={result.studentFlagPosition}
                  expectedPosition={result.expectedFinalPosition}
                  misconceptionMatches={result.misconceptionMatches}
                />
              </div>
            </TabsContent>
          )}

          {hasModels && (
            <TabsContent value="models">
              <p className="mb-3 text-sm text-muted-foreground">
                Each model simulates a common misconception and shows where the robot would
                end up. A close match hints at how the student may be thinking.
              </p>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Model</th>
                      <th className="px-3 py-2">End cell</th>
                      <th className="px-3 py-2">Distance</th>
                      <th className="px-3 py-2">Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.misconceptionMatches.map((m) => (
                      <tr key={m.modelId} className="border-t border-slate-100">
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
            </TabsContent>
          )}
        </Tabs>

        <PanelRecommendation>{result.recommendation}</PanelRecommendation>
      </CardContent>
    </Card>
  );
}
