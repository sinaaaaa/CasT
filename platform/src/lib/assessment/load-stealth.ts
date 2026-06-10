import { prisma } from "@/lib/prisma";
import type { StealthAssessmentPayload } from "@/components/assessment/stealth-assessment-panel";
import type { RouteComparison, TeacherAssessmentSummary } from "@/lib/assessment/assessmentTypes";
import type { PredictionAnalysisResult } from "@/lib/assessment/predictionAnalysis";
import type { ChoiceActionAnalysisResult } from "@/lib/assessment/choiceActionAnalysis";
import type { ConstructScore } from "@/lib/assessment/assessmentTypes";

function asStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((x): x is string => typeof x === "string");
}

function asConstructScores(val: unknown): ConstructScore[] {
  if (!Array.isArray(val)) return [];
  return val.filter(
    (x): x is ConstructScore =>
      x != null &&
      typeof x === "object" &&
      typeof (x as ConstructScore).slug === "string" &&
      typeof (x as ConstructScore).score === "number"
  );
}

/** Normalize DB JSON so UI never reads undefined arrays. */
function normalizeTeacherSummary(
  raw: unknown,
  row: {
    overallScore: number;
    overallMastery: string;
    confidence: number;
  }
): TeacherAssessmentSummary {
  const s =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Partial<TeacherAssessmentSummary>)
      : {};

  return {
    overallScore: typeof s.overallScore === "number" ? s.overallScore : row.overallScore,
    overallMastery:
      (s.overallMastery as TeacherAssessmentSummary["overallMastery"]) ?? row.overallMastery,
    confidence: typeof s.confidence === "number" ? s.confidence : row.confidence,
    taskMastery: typeof s.taskMastery === "string" ? s.taskMastery : "Assessment summary",
    behaviors: asStringArray(s.behaviors),
    interpretations: asStringArray(s.interpretations),
    recommendations: asStringArray(s.recommendations),
    constructScores: asConstructScores(s.constructScores),
    routeComparison: (s.routeComparison as RouteComparison | null) ?? null,
    numberLineEvidence: s.numberLineEvidence ?? null,
    taskEnvironmentType: s.taskEnvironmentType ?? "grid",
    taskType: s.taskType ?? "algorithmic-thinking",
    predictionResult: s.predictionResult ?? null,
    choiceActionResult: s.choiceActionResult ?? null,
  };
}

/** Load stealth assessment row; returns null if table missing or no row. */
export async function loadStealthAssessmentForAttempt(
  attemptId: string
): Promise<StealthAssessmentPayload | null> {
  try {
    const row = await prisma.stealthAssessmentResult.findUnique({
      where: { attemptId },
    });
    if (!row) return null;
    const evidence = row.evidence as {
      predictionResult?: PredictionAnalysisResult | null;
      choiceActionResult?: ChoiceActionAnalysisResult | null;
      metrics?: {
        resetCount?: number;
        robotTouched?: boolean;
        robotTouchCount?: number;
        wrongTurns?: number;
        collisions?: number;
      };
    } | null;

    const summary = normalizeTeacherSummary(row.teacherSummary, {
      overallScore: row.overallScore,
      overallMastery: row.overallMastery,
      confidence: row.confidence,
    });

    if (evidence?.predictionResult) {
      summary.predictionResult = evidence.predictionResult;
    }
    if (evidence?.choiceActionResult) {
      summary.choiceActionResult = evidence.choiceActionResult;
    }

    return {
      assessmentVersion: row.assessmentVersion,
      overallScore: row.overallScore,
      overallMastery: row.overallMastery,
      confidence: row.confidence,
      taskType: row.taskType,
      summary,
      routeAnalysis: (row.routeAnalysis as RouteComparison | null) ?? null,
      evidenceMetrics: evidence?.metrics,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("StealthAssessmentResult") && msg.includes("does not exist")) {
      console.warn(
        "[loadStealthAssessment] Table missing — run prisma/migrations/add_stealth_assessment_result.sql"
      );
      return null;
    }
    throw e;
  }
}
