"use client";

import type { PathBuildingAnalysisResult } from "@/lib/assessment/pathBuildingAnalysis";
import { PathQualityCard } from "@/components/assessment/path-building/path-quality-card";
import { CompactPathDiagnosis } from "@/components/assessment/path-building/compact-path-diagnosis";

export function PathOutcomeBanner({ result }: { result: PathBuildingAnalysisResult }) {
  return (
    <div className="space-y-3">
      <PathQualityCard result={result} />
      <CompactPathDiagnosis result={result} />
    </div>
  );
}
