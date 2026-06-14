"use client";

import { MetricInfo } from "@/components/assessment/metric-info";
import type { GlossaryKey } from "@/lib/assessment/assessmentGlossary";

export type DiagnosticScoreVariant =
  | "flag"
  | "pathBuilding"
  | "debugging"
  | "numberLine"
  | "choice"
  | "route"
  | "general";

const VARIANT_KEYS: Record<DiagnosticScoreVariant, GlossaryKey> = {
  general: "diagnosticScore",
  flag: "diagnosticScoreFlag",
  pathBuilding: "diagnosticScorePathBuilding",
  debugging: "diagnosticScoreDebugging",
  numberLine: "diagnosticScoreNumberLine",
  choice: "diagnosticScoreChoice",
  route: "diagnosticScoreRoute",
};

export function DiagnosticScoreInfo({ variant = "general" }: { variant?: DiagnosticScoreVariant }) {
  return <MetricInfo metric={VARIANT_KEYS[variant]} />;
}

export function ItemOutcomeInfo() {
  return <MetricInfo metric="itemOutcome" />;
}
