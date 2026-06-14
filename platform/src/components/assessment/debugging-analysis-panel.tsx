"use client";

import { useState } from "react";
import { Bug, Stethoscope, PlayCircle, Map } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssessmentPanelHeader } from "@/components/assessment/assessment-panel-header";
import { PanelRecommendation } from "@/components/assessment/panel-recommendation";
import { DebuggingPathSection } from "@/components/assessment/debugging/debugging-path-section";
import { DebuggingRouteCompare } from "@/components/assessment/debugging/debugging-route-compare";
import { ProgramDiffVisualizer } from "@/components/assessment/debugging/program-diff-visualizer";
import { RepairOutcomeBanner } from "@/components/assessment/debugging/repair-outcome-banner";
import { RouteReplayPlayer } from "@/components/assessment/route-replay-player";
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

  const hasRouteCompare =
    result.correctPath.length > 1 || result.optimalPath.length > 1;
  const hasMaps = hasRouteCompare || hasPaths;
  const canReplay = result.studentPath.length > 1;

  return (
    <Card className="overflow-hidden border-slate-200/70 shadow-sm">
      <AssessmentPanelHeader
        icon={Bug}
        title="Fixing the program"
        subtitle="How the student's repair compares with a correct fix."
      />

      <CardContent className="space-y-6 pt-6">
        <RepairOutcomeBanner result={result} />

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
            <ProgramDiffVisualizer
              result={result}
              activeStep={activeStep}
              onStepHover={setActiveStep}
            />
          </TabsContent>

          {canReplay && (
            <TabsContent value="replay">
              <RouteReplayPlayer
                path={result.studentPath}
                pathStates={result.studentPathStates}
                commands={result.studentProgram}
                routeStartPosition={result.routeStartPosition}
                routeGoalPosition={result.routeGoalPosition}
                goalLabel={result.goalLabel}
                studentEndPosition={result.studentEndPosition}
                objectMarkers={result.objectMarkers}
                collisions={result.attemptedObstacleCells}
                attemptedObstacleCell={result.attemptedObstacleCells[0] ?? null}
                title="Replay the student's repair"
              />
            </TabsContent>
          )}

          {hasMaps && (
            <TabsContent value="maps" className="space-y-6">
              {hasRouteCompare && (
                <DebuggingRouteCompare result={result} activeStep={activeStep} />
              )}
              {hasPaths && (
                <DebuggingPathSection
                  result={result}
                  activeStep={activeStep}
                  defaultOpen
                />
              )}
            </TabsContent>
          )}
        </Tabs>

        <PanelRecommendation>{result.recommendation}</PanelRecommendation>
      </CardContent>
    </Card>
  );
}
