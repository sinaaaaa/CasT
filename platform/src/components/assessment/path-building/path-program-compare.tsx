"use client";

import { useMemo } from "react";
import { AlertTriangle, GitCompareArrows } from "lucide-react";
import { ProgramDiffTrack } from "@/components/assessment/debugging/command-diff-chip";
import { ComparisonUsedBanner } from "@/components/assessment/comparison-used-banner";
import type { PathBuildingAnalysisResult } from "@/lib/assessment/pathBuildingAnalysis";
import { comparisonTargetLabel } from "@/lib/assessment/comparison-target";
import {
  buildFirstMistakeMessages,
  buildStudentProgramDisplay,
  programsEqual,
  referenceFixSlots,
} from "@/lib/assessment/program-diff-visual";

export function PathProgramCompare({
  result,
  activeStep,
  onStepHover,
}: {
  result: PathBuildingAnalysisResult;
  activeStep: number | null;
  onStepHover: (step: number | null) => void;
}) {
  const reference =
    result.selectedReferenceRoute.length > 0
      ? result.selectedReferenceRoute
      : result.closestValidRoute.length > 0
        ? result.closestValidRoute
        : result.shortestRoute;

  const firstMistakeStep = result.firstMistakeStep;
  const semantic = result.semanticIssue;

  const mistakeMessages = useMemo(
    () =>
      buildFirstMistakeMessages(firstMistakeStep, {
        passedGoal: semantic.issueType === "passed_goal",
        suppressMissingAfterStep: semantic.suppressMissingSummary,
      }),
    [firstMistakeStep, semantic.issueType, semantic.suppressMissingSummary]
  );

  const studentDisplay = useMemo(
    () =>
      buildStudentProgramDisplay({
        student: result.studentCommands,
        reference,
        firstMistakeStep,
        obstacleSteps: result.obstacleCollisionSteps,
        softenAfterFirstMistake: true,
        suppressMissingSummary: semantic.suppressMissingSummary,
        highlightExtraAfterGoalStep: semantic.highlightExtraAfterGoalStep,
        issueHints: {
          passedGoal:
            result.passedThroughGoal || semantic.issueType === "passed_goal",
          stoppedEarly:
            result.mistakeType === "missingForward" &&
            semantic.issueType !== "passed_goal",
          wrongOrder:
            result.mistakeType === "wrongCommandOrder" ||
            result.mistakeType === "goalOrderError",
        },
      }),
    [
      result.studentCommands,
      reference,
      firstMistakeStep,
      result.obstacleCollisionSteps,
      result.passedThroughGoal,
      result.mistakeType,
      semantic.suppressMissingSummary,
      semantic.highlightExtraAfterGoalStep,
      semantic.issueType,
    ]
  );

  const showShortest =
    result.shortestRoute.length > 0 && !programsEqual(reference, result.shortestRoute);

  if (result.studentCommands.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GitCompareArrows className="h-4 w-4 text-sky-700" />
          <h3 className="text-sm font-semibold text-slate-900">Programs compared</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Hover a command to highlight its step on the grid
        </p>
      </div>

      <ComparisonUsedBanner
        comparisonUsed={result.comparisonUsed}
        comparisonReason={result.comparisonReason}
      />

      {mistakeMessages && (
        <p className="flex items-center gap-2 rounded-lg border border-amber-300/70 bg-amber-50/80 px-3 py-2 text-sm font-medium text-amber-950">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          {mistakeMessages.label}
        </p>
      )}

      {studentDisplay.missingSummary && (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-2 text-sm text-amber-950">
          {studentDisplay.missingSummary}
        </p>
      )}

      <div className={`grid gap-3 ${showShortest ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
        <ProgramDiffTrack
          label="Student route"
          sublabel={`Compared to ${comparisonTargetLabel(result.comparisonUsed).toLowerCase()}`}
          slots={studentDisplay.slots}
          onStepHover={onStepHover}
          activeStep={activeStep}
        />
        <ProgramDiffTrack
          label="Reference for diagnosis"
          sublabel={comparisonTargetLabel(result.comparisonUsed)}
          slots={referenceFixSlots(reference)}
          onStepHover={onStepHover}
          activeStep={activeStep}
        />
        {showShortest && (
          <ProgramDiffTrack
            label="Shortest path (BFS)"
            sublabel={`${result.shortestRoute.length} commands`}
            slots={referenceFixSlots(result.shortestRoute)}
            onStepHover={onStepHover}
            activeStep={activeStep}
          />
        )}
      </div>
    </section>
  );
}
