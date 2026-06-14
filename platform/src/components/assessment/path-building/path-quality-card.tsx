"use client";

import { motion } from "framer-motion";
import { DiagnosticScoreInfo } from "@/components/assessment/diagnostic-score-info";
import type { PathBuildingAnalysisResult } from "@/lib/assessment/pathBuildingAnalysis";
import { cn } from "@/lib/utils";

const QUALITY_STYLES: Record<
  PathBuildingAnalysisResult["routeQuality"],
  { ring: string; bg: string; text: string }
> = {
  "Exact Route": {
    ring: "ring-emerald-400/40",
    bg: "from-emerald-50 to-white",
    text: "text-emerald-900",
  },
  "Valid Route": {
    ring: "ring-emerald-300/40",
    bg: "from-emerald-50/80 to-white",
    text: "text-emerald-900",
  },
  "Valid but Extra Commands": {
    ring: "ring-sky-300/40",
    bg: "from-sky-50 to-white",
    text: "text-sky-950",
  },
  "Close Route": {
    ring: "ring-amber-300/50",
    bg: "from-amber-50 to-white",
    text: "text-amber-950",
  },
  "Partial Route": {
    ring: "ring-orange-300/40",
    bg: "from-orange-50 to-white",
    text: "text-orange-950",
  },
  "Incorrect Route": {
    ring: "ring-red-300/40",
    bg: "from-red-50 to-white",
    text: "text-red-950",
  },
  "Goal Order Error": {
    ring: "ring-violet-300/40",
    bg: "from-violet-50 to-white",
    text: "text-violet-950",
  },
  "Obstacle Collision": {
    ring: "ring-rose-300/40",
    bg: "from-rose-50 to-white",
    text: "text-rose-950",
  },
};

export function PathQualityCard({ result }: { result: PathBuildingAnalysisResult }) {
  const style = QUALITY_STYLES[result.routeQuality];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border bg-gradient-to-br p-4 shadow-sm ring-1",
        style.ring,
        style.bg
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Route result
      </p>
      <p className={cn("mt-1 text-xl font-semibold tracking-tight", style.text)}>
        {result.routeQuality}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-slate-700">{result.whatHappened}</p>
      <p className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <span>
          Diagnostic score {result.score}% · {result.commandCount} commands
          {result.compareWithOptimalRoute && result.shortestCommandCount > 0
            ? ` · shortest ${result.shortestCommandCount}`
            : ""}
        </span>
        <DiagnosticScoreInfo variant="pathBuilding" />
      </p>
    </motion.div>
  );
}
