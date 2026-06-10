/**
 * Post-attempt assessment hook — runs the stealth ECD engine (task-level evidence only).
 * Per-level CT construct weights are no longer used.
 */

import { analyzeStealthAssessment } from "@/lib/assessment/persist";

export async function analyzeAttemptConstructs(attemptId: string) {
  const stealth = await analyzeStealthAssessment(attemptId);
  if ("skipped" in stealth && stealth.skipped) {
    return {
      attemptId,
      performances: [],
      engine: "stealth-v1" as const,
      skipped: true,
      reason: stealth.reason,
    };
  }
  return {
    attemptId,
    performances: stealth.performances,
    engine: "stealth-v1" as const,
  };
}
