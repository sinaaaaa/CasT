"use client";

import { Scale } from "lucide-react";
import {
  comparisonTargetLabel,
  type ComparisonTargetType,
} from "@/lib/assessment/comparison-target";

export function ComparisonUsedBanner({
  comparisonUsed,
  comparisonReason,
}: {
  comparisonUsed: ComparisonTargetType;
  comparisonReason: string;
}) {
  if (!comparisonReason) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 text-sm">
      <Scale className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" aria-hidden />
      <div>
        <p className="font-medium text-slate-900">
          Comparison used: {comparisonTargetLabel(comparisonUsed)}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{comparisonReason}</p>
      </div>
    </div>
  );
}
