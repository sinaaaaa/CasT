"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, GitCompareArrows, Lightbulb, Plus, Minus } from "lucide-react";
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
import { BlockProgramView } from "@/components/assessment/block-program-view";
import type { DebugBlockView } from "@/lib/assessment/debugBlockView";

function BlockModeComparison({
  view,
  firstMistakeStep,
  activeStep,
  onStepHover,
}: {
  view: DebugBlockView;
  firstMistakeStep: number | null;
  activeStep: number | null;
  onStepHover: (step: number | null) => void;
}) {
  return (
    <div className="space-y-4">
      {view.studentWorks ? (
        <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-sm font-medium text-emerald-900">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
          The student&apos;s blocks reach the goal — no block needs to change.
        </p>
      ) : view.firstMistakeText ? (
        <p className="flex items-center gap-2 rounded-lg border border-amber-300/70 bg-amber-50/80 px-3 py-2 text-sm font-medium text-amber-950">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          {view.firstMistakeText}
        </p>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-3">
        <BlockProgramView
          label="Starter (given)"
          sublabel="Item initial program"
          blocks={view.starter}
          activeStep={activeStep}
          onStepHover={onStepHover}
        />
        <BlockProgramView
          label="Student's program"
          sublabel="As built in the yellow strip"
          blocks={view.student}
          marks={view.studentMarks}
          notes={view.studentNotes}
          firstMistakeStep={view.studentWorks ? null : firstMistakeStep}
          activeStep={activeStep}
          onStepHover={onStepHover}
        />
        {view.reference ? (
          <BlockProgramView
            label={view.referenceLabel}
            sublabel={view.referenceSublabel}
            blocks={view.reference}
            marks={view.referenceMarks}
          />
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-sm text-muted-foreground">
            {view.referenceSublabel || "No block-level fix found."} Switch to Robot moves to see an arrow-level fix.
          </div>
        )}
      </div>

      {view.fixes.length > 0 && (
        <section className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <Lightbulb className="h-3.5 w-3.5 text-indigo-500" />
            Smallest block fix{view.fixes.length === 1 ? "" : "es"}
          </h4>
          <ol className="mt-1.5 space-y-1 text-sm text-slate-700">
            {view.fixes.map((f, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-semibold text-indigo-600">{i === 0 ? "Best" : "Or"}</span>
                <span>{f}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <p className="text-[11px] text-slate-400">
        Bags and Chunks are shown the way the student placed them. Numbers are robot moves — the same
        steps used in Replay and the robot-moves view.
      </p>
    </div>
  );
}

export function ProgramDiffVisualizer({
  result,
  activeStep,
  onStepHover,
  blockView,
}: {
  result: DebuggingAnalysisResult;
  activeStep: number | null;
  onStepHover: (step: number | null) => void;
  /** Bags / Chunks kept whole — shown by default when the item uses them. */
  blockView?: DebugBlockView | null;
}) {
  const [mode, setMode] = useState<"blocks" | "moves">(blockView ? "blocks" : "moves");
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
          {blockView && (
            <div
              role="tablist"
              aria-label="Program view"
              className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium"
            >
              {(
                [
                  ["blocks", "Blocks as built"],
                  ["moves", "Robot moves"],
                ] as const
              ).map(([value, text]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={mode === value}
                  onClick={() => setMode(value)}
                  className={cn(
                    "rounded-md px-2.5 py-1 transition-colors",
                    mode === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {text}
                </button>
              ))}
            </div>
          )}
          <p className="hidden text-xs text-muted-foreground lg:block">
            Hover a command to highlight its step
          </p>
          {mode === "moves" && hasExtraPrograms && (
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

      {mode === "blocks" && blockView ? (
        <BlockModeComparison
          view={blockView}
          firstMistakeStep={firstMistakeStep}
          activeStep={activeStep}
          onStepHover={onStepHover}
        />
      ) : (
        <>
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
        </>
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
