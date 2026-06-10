"use client";

import type { PathBuildingAnalysisResult } from "@/lib/assessment/pathBuildingAnalysis";
import { cn } from "@/lib/utils";

function InsightChip({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warn" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2",
        tone === "default" && "border-slate-200/80 bg-white/80",
        tone === "warn" && "border-amber-200/80 bg-amber-50/60",
        tone === "danger" && "border-red-200/80 bg-red-50/50"
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

export function CompactPathDiagnosis({ result }: { result: PathBuildingAnalysisResult }) {
  const mistakeTone =
    result.mistakeType === "none" ? "default" : result.reachedGoal ? "warn" : "danger";

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {result.firstMistakeLabel && (
        <InsightChip label="First mistake" value={result.firstMistakeLabel} tone="warn" />
      )}
      <InsightChip label="Exact issue" value={result.exactIssue} tone={mistakeTone} />
      <InsightChip label="Robot outcome" value={result.robotOutcome} />
      {result.stageAnalysis.length > 0 && (
        <InsightChip
          label="Stages"
          value={
            result.stageAnalysis.every((s) => s.reached)
              ? "Both goals completed in order"
              : result.stageAnalysis.filter((s) => s.reached).length === 1
                ? "First goal only"
                : "Goals not completed"
          }
        />
      )}
    </div>
  );
}
