"use client";

import type { RouteComparison, TeacherAssessmentSummary } from "@/lib/assessment/assessmentTypes";
import { TeacherAssessmentReport } from "@/components/assessment/teacher-assessment-report";
import { PredictionAnalysisPanel } from "@/components/assessment/prediction-analysis-panel";
import { ChoiceActionAnalysisPanel } from "@/components/assessment/choice-action-analysis-panel";

export type StealthAssessmentPayload = {
  assessmentVersion: string;
  overallScore: number;
  overallMastery: string;
  confidence: number;
  taskType: string;
  summary: TeacherAssessmentSummary;
  routeAnalysis: RouteComparison | null;
  evidenceMetrics?: {
    resetCount?: number;
    robotTouched?: boolean;
    robotTouchCount?: number;
    wrongTurns?: number;
    collisions?: number;
  };
  visitLabels?: string[];
};

export function StealthAssessmentPanel({ data }: { data: StealthAssessmentPayload }) {
  const pr = data.summary.predictionResult;
  if (pr?.available) {
    return <PredictionAnalysisPanel result={pr} />;
  }
  const ca = data.summary.choiceActionResult;
  if (ca?.available) {
    return <ChoiceActionAnalysisPanel result={ca} />;
  }

  return (
    <TeacherAssessmentReport
      data={data}
      extra={{
        resetCount: data.evidenceMetrics?.resetCount,
        robotTouched: data.evidenceMetrics?.robotTouched,
        robotTouchCount: data.evidenceMetrics?.robotTouchCount,
        wrongTurns: data.evidenceMetrics?.wrongTurns,
        collisions: data.evidenceMetrics?.collisions,
        visitLabels: data.visitLabels,
      }}
    />
  );
}
