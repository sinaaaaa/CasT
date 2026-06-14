"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, GitCompareArrows, Plus, Minus } from "lucide-react";
import type { DebuggingAnalysisResult } from "@/lib/assessment/debuggingAnalysis";
import { ComparisonUsedBanner } from "@/components/assessment/comparison-used-banner";
import { ProgramDiffTrack } from "@/components/assessment/debugging/command-diff-chip";
import { comparisonTargetLabel } from "@/lib/assessment/comparison-target";
import {
  baselineProgramSlots,
  buildFirstMistakeMessages,
  buildStudentProgramDisplay,
  programsEqual,
  referenceFixSlots,
} from "@/lib/assessment/program-diff-visual";
import { cn } from "@/lib/utils";

export function ProgramDiffVisualizer({
  result,
  activeStep,
  onStepHover,
}: {
  result: DebuggingAnalysisResult;
  activeStep: number | null;
  onStepHover: (step: number | null) => void;
}) {
  const referenceCommands =
    result.selectedComparisonRoute.length > 0
      ? result.selectedComparisonRoute
      : result.closestWorkingFix?.commands ??
        (result.correctProgram.length > 0 ? result.correctProgram : null);

  const [showAll, setShowAll] = useState(false);

  const shortestFix = result.preferredWorkingFix?.commands ?? null;
  const closestFix = result.closestWorkingFix?.commands ?? null;

  const canShowShortest =
    shortestFix &&
    referenceCommands &&
    !programsEqual(shortestFix, referenceCommands);

  const canShowClosest =
    closestFix &&
    referenceCommands &&
    !programsEqual(closestFix, referenceCommands) &&
    (!shortestFix || !programsEqual(closestFix, shortestFix));

  // Default to the essentials (starter · student · how it should look). The extra
  // reference programs add clutter, so they live behind a toggle.
  const showShortest = showAll && canShowShortest;
  const showClosest = showAll && canShowClosest;
  const hasExtraPrograms = Boolean(canShowShortest || canShowClosest);

  const extraColumns = (showShortest ? 1 : 0) + (showClosest ? 1 : 0);

  const firstMistakeStep = result.firstMistakeStep;
  const semantic = result.semanticIssue;
  const mistakeMessages = useMemo(
    () =>
      buildFirstMistakeMessages(firstMistakeStep, {
        studentLength: result.studentProgram.length,
        repairStatus: result.repairStatus,
        passedGoal: semantic?.issueType === "passed_goal",
        suppressMissingAfterStep: semantic?.suppressMissingSummary,
      }),
    [
      firstMistakeStep,
      result.studentProgram.length,
      result.repairStatus,
      semantic?.issueType,
      semantic?.suppressMissingSummary,
    ]
  );

  const studentDisplay = useMemo(
    () =>
      buildStudentProgramDisplay({
        student: result.studentProgram,
        reference: referenceCommands ?? result.originalProgram,
        firstMistakeStep,
        obstacleSteps: result.obstacleCollisionSteps,
        softenAfterFirstMistake: true,
        suppressMissingSummary: semantic?.suppressMissingSummary ?? false,
        highlightExtraAfterGoalStep: semantic?.highlightExtraAfterGoalStep ?? null,
        issueHints: {
          stoppedEarly:
            result.stoppedBeforeGoal &&
            result.repairStatus !== "wrongTurnFix" &&
            semantic?.issueType !== "passed_goal",
          passedGoal:
            result.passedThroughGoal || semantic?.issueType === "passed_goal",
          wrongOrder: result.wrongOrderComparedToFix,
        },
      }),
    [
      result.studentProgram,
      referenceCommands,
      result.originalProgram,
      firstMistakeStep,
      result.obstacleCollisionSteps,
      result.stoppedBeforeGoal,
      result.passedThroughGoal,
      result.wrongOrderComparedToFix,
      result.repairStatus,
      semantic?.suppressMissingSummary,
      semantic?.highlightExtraAfterGoalStep,
      semantic?.issueType,
    ]
  );

  const alternateValid =
    result.bugFixed &&
    referenceCommands &&
    !programsEqual(result.studentProgram, referenceCommands);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GitCompareArrows className="h-4 w-4 text-amber-700" />
          <h3 className="text-sm font-semibold text-slate-900">Program comparison</h3>
        </div>
        <div className="flex items-center gap-3">
          <p className="hidden text-xs text-muted-foreground sm:block">
            Hover a command to highlight its step
          </p>
          {hasExtraPrograms && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              {showAll ? (
                <>
                  <Minus className="h-3 w-3" /> Fewer
                </>
              ) : (
                <>
                  <Plus className="h-3 w-3" /> Show all programs
                </>
              )}
            </button>
          )}
        </div>
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

      <div
        className={cn(
          "grid gap-3",
          extraColumns >= 2
            ? "sm:grid-cols-2 xl:grid-cols-5"
            : extraColumns === 1
              ? "sm:grid-cols-2 xl:grid-cols-4"
              : "xl:grid-cols-3"
        )}
      >
        <ProgramDiffTrack
          label="Starter (buggy)"
          sublabel="Item initial program"
          slots={baselineProgramSlots(result.originalProgram)}
          onStepHover={onStepHover}
          activeStep={activeStep}
        />
        <div className="space-y-2">
          <ProgramDiffTrack
            label="Student repair"
            sublabel={`Compared to ${comparisonTargetLabel(result.comparisonUsed).toLowerCase()}`}
            slots={studentDisplay.slots}
            onStepHover={onStepHover}
            activeStep={activeStep}
          />
          {studentDisplay.missingSummary && (
            <p className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-2 py-1.5 text-xs text-amber-950">
              {studentDisplay.missingSummary}
            </p>
          )}
        </div>
        {referenceCommands ? (
          <>
            <ProgramDiffTrack
              label="How it should look"
              sublabel={comparisonTargetLabel(result.comparisonUsed)}
              slots={referenceFixSlots(referenceCommands)}
              onStepHover={onStepHover}
              activeStep={activeStep}
            />
            {showClosest && closestFix && (
              <ProgramDiffTrack
                label="Closest correct way"
                sublabel="Another comparison"
                slots={referenceFixSlots(closestFix)}
                onStepHover={onStepHover}
                activeStep={activeStep}
              />
            )}
            {showShortest && shortestFix && (
              <ProgramDiffTrack
                label="Best (shortest) way"
                sublabel={`${shortestFix.length} commands · fewest needed`}
                slots={referenceFixSlots(shortestFix)}
                onStepHover={onStepHover}
                activeStep={activeStep}
              />
            )}
          </>
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-sm text-muted-foreground sm:col-span-2">
            No working fix path found for this level.
          </div>
        )}
      </div>

      {alternateValid && (
        <p className="rounded-lg border border-teal-200/80 bg-teal-50/60 px-2 py-1.5 text-center text-xs font-medium text-teal-900">
          Alternate valid repair
        </p>
      )}

      {result.obstacleCollision && result.firstObstacleMistakeStep != null && (
        <p className="rounded-lg border border-red-200/80 bg-red-50/60 px-3 py-2 text-sm text-red-950">
          Hit obstacle at Step {result.firstObstacleMistakeStep} — this command tried to move into a
          blocked space.
        </p>
      )}
    </section>
  );
}
