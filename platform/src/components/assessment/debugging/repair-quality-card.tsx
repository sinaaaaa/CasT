"use client";

import type { DebuggingAnalysisResult } from "@/lib/assessment/debuggingAnalysis";
import { RepairQualityBadge } from "@/components/assessment/debugging/repair-quality-badge";
import {
  REPAIR_QUALITY_META,
  goalOutcomeHeadline,
  programsEqual,
  repairQualityExplanation,
  resolveRepairQuality,
} from "@/lib/assessment/program-diff-visual";
import { cn } from "@/lib/utils";

export function RepairQualityCard({ result }: { result: DebuggingAnalysisResult }) {
  const fixCommands =
    result.closestWorkingFix?.commands ??
    (result.correctProgram.length > 0 ? result.correctProgram : null);

  const level = resolveRepairQuality({
    repairStatus: result.repairStatus,
    bugFixed: result.bugFixed,
    score: result.score,
    studentProgram: result.studentProgram,
    preferredFix: fixCommands,
    programsEqualStarter: programsEqual(
      result.originalProgram,
      result.studentProgram
    ),
  });

  const meta = REPAIR_QUALITY_META[level];
  const goal = goalOutcomeHeadline({
    bugFixed: result.bugFixed,
    passedThroughGoal: result.passedThroughGoal,
    stoppedBeforeGoal: result.stoppedBeforeGoal,
    distanceFromGoal: result.distanceFromGoal,
    repairStatus: result.repairStatus,
    goalLabel: result.goalLabel,
  });

  const explanation = repairQualityExplanation(level, {
    bugFixed: result.bugFixed,
    passedThroughGoal: result.passedThroughGoal,
    stoppedBeforeGoal: result.stoppedBeforeGoal,
    repairStatus: result.repairStatus,
  });

  const goalToneIcon = {
    success: "text-green-600",
    warning: "text-amber-600",
    danger: "text-red-600",
  }[goal.tone];

  return (
    <div
      className={cn(
        "rounded-2xl border bg-gradient-to-br p-5 shadow-sm backdrop-blur-md",
        meta.borderClass,
        meta.cardGradient
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Repair quality
      </p>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className={cn("mt-1.5 h-3 w-3 shrink-0 rounded-full", meta.dotClass)}
            aria-hidden
          />
          <div>
            <h3 className={cn("text-xl font-bold tracking-tight", meta.textClass)}>
              {level}
            </h3>
            <p className="mt-1 max-w-lg text-sm leading-snug text-slate-600">
              {explanation}
            </p>
          </div>
        </div>
        <RepairQualityBadge level={level} showScore score={result.score} />
      </div>

      <div
        className={cn(
          "mt-4 flex items-start gap-2 rounded-xl border bg-white/55 px-3 py-2.5 text-sm backdrop-blur-sm",
          goal.tone === "success" && "border-green-200/60",
          goal.tone === "warning" && "border-amber-200/60",
          goal.tone === "danger" && "border-red-200/50"
        )}
      >
        <span className={cn("font-semibold", goalToneIcon)} aria-hidden>
          {goal.tone === "success" ? "✓" : "⚠"}
        </span>
        <div>
          <span className="font-semibold text-slate-900">{goal.label}</span>
          <span className="text-slate-600"> — {goal.detail}</span>
        </div>
      </div>
    </div>
  );
}
