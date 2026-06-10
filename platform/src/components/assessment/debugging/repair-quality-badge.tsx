"use client";

import { cn } from "@/lib/utils";
import {
  REPAIR_QUALITY_META,
  type RepairQualityLevel,
} from "@/lib/assessment/program-diff-visual";

export function RepairQualityBadge({
  level,
  showScore,
  score,
  className,
}: {
  level: RepairQualityLevel;
  showScore?: boolean;
  score?: number;
  className?: string;
}) {
  const meta = REPAIR_QUALITY_META[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold backdrop-blur-sm",
        meta.borderClass,
        meta.textClass,
        "bg-white/50",
        className
      )}
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full", meta.dotClass)} aria-hidden />
      {level}
      {showScore && score != null && (
        <span className="font-normal opacity-60 tabular-nums">{score}%</span>
      )}
    </span>
  );
}
