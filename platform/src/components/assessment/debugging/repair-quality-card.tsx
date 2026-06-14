"use client";

import type { DebuggingAnalysisResult } from "@/lib/assessment/debuggingAnalysis";
import { DiagnosticScoreInfo } from "@/components/assessment/diagnostic-score-info";
import { RepairQualityBadge } from "@/components/assessment/debugging/repair-quality-badge";
import {
  REPAIR_QUALITY_META,
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

  const explanation = repairQualityExplanation(level, {
    bugFixed: result.bugFixed,
    passedThroughGoal: result.passedThroughGoal,
    stoppedBeforeGoal: result.stoppedBeforeGoal,
    repairStatus: result.repairStatus,
  });

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
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <RepairQualityBadge level={level} showScore score={result.score} />
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            Diagnostic score
            <DiagnosticScoreInfo variant="debugging" />
          </span>
        </div>
      </div>
    </div>
  );
}
