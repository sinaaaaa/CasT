"use client";

import { useState } from "react";
import { Route, Stethoscope, PlayCircle, Map } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssessmentPanelHeader } from "@/components/assessment/assessment-panel-header";
import { PanelRecommendation } from "@/components/assessment/panel-recommendation";
import { PathOutcomeBanner } from "@/components/assessment/path-building/path-outcome-banner";
import { PathProgramCompare } from "@/components/assessment/path-building/path-program-compare";
import { PathMapSection } from "@/components/assessment/path-building/path-map-section";
import { RouteReplayPlayer } from "@/components/assessment/route-replay-player";
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

  const canReplay = result.studentPath.length > 1;
  const hasMaps =
    result.studentPath.length > 1 ||
    result.closestValidPath.length > 1 ||
    result.shortestPath.length > 1;

  return (
    <Card className="overflow-hidden border-slate-200/70 shadow-sm">
      <AssessmentPanelHeader
        icon={Route}
        title="Building a path"
        subtitle="The route the student built compared with a correct way to the goal."
        badges={
          subLabels.length > 0
            ? subLabels.map((l) => (
                <Badge key={l} variant="outline" className="font-normal text-muted-foreground">
                  {l}
                </Badge>
              ))
            : undefined
        }
      />

      <CardContent className="space-y-6 pt-6">
        <PathOutcomeBanner result={result} />

        <Tabs defaultValue="diagnosis" className="w-full">
          <TabsList>
            <TabsTrigger value="diagnosis" className="gap-1.5">
              <Stethoscope className="h-4 w-4" />
              What happened
            </TabsTrigger>
            {canReplay && (
              <TabsTrigger value="replay" className="gap-1.5">
                <PlayCircle className="h-4 w-4" />
                Replay
              </TabsTrigger>
            )}
            {hasMaps && (
              <TabsTrigger value="maps" className="gap-1.5">
                <Map className="h-4 w-4" />
                Maps
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="diagnosis" className="space-y-6">
            <PathProgramCompare
              result={result}
              activeStep={activeStep}
              onStepHover={setActiveStep}
            />

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
          </TabsContent>

          {canReplay && (
            <TabsContent value="replay">
              <RouteReplayPlayer
                path={result.studentPath}
                pathStates={result.studentPathStates}
                commands={result.studentCommands}
                routeStartPosition={result.routeStartPosition}
                routeGoalPosition={result.routeGoalPosition}
                goalLabel={result.goalLabel}
                studentEndPosition={result.studentEndPosition}
                objectMarkers={result.objectMarkers}
                collisions={result.attemptedObstacleCells}
                attemptedObstacleCell={result.attemptedObstacleCells[0] ?? null}
                title="Replay this attempt"
              />
            </TabsContent>
          )}

          {hasMaps && (
            <TabsContent value="maps">
              <PathMapSection result={result} activeStep={activeStep} defaultOpen />
            </TabsContent>
          )}
        </Tabs>

        <PanelRecommendation>{result.recommendation}</PanelRecommendation>
      </CardContent>
    </Card>
  );
}
