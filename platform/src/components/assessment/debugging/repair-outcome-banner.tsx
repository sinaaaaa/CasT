"use client";

import type { DebuggingAnalysisResult } from "@/lib/assessment/debuggingAnalysis";
import { RepairQualityCard } from "@/components/assessment/debugging/repair-quality-card";
import { CompactDiagnosisPanel } from "@/components/assessment/debugging/compact-diagnosis-panel";

/** Top-of-panel repair summary: quality card + compact insight chips. */
export function RepairOutcomeBanner({ result }: { result: DebuggingAnalysisResult }) {
  return (
    <div className="space-y-3">
      <RepairQualityCard result={result} />
      <CompactDiagnosisPanel result={result} />
    </div>
  );
}
