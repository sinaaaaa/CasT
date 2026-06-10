/**
 * Teacher narrative generator — Behavior → Interpretation → Recommendation.
 */

import { masteryLabel } from "@/lib/assessment/assessmentConfig";
import { buildInterpretations } from "@/lib/assessment/teacherInterpretation";
import type {
  ConstructScore,
  GameplayEvidence,
  TaskAssessmentConfig,
  TeacherAssessmentSummary,
} from "@/lib/assessment/assessmentTypes";
import { masteryFromScore, clampScore } from "@/lib/assessment/assessmentConfig";

export function generateTeacherNarrative(params: {
  task: TaskAssessmentConfig;
  evidence: GameplayEvidence;
  constructScores: ConstructScore[];
  recommendations: string[];
}): TeacherAssessmentSummary {
  const { task, evidence, constructScores, recommendations } = params;

  const pr = evidence.predictionResult;
  const ca = evidence.choiceActionResult;

  const weighted =
    constructScores.length > 0
      ? constructScores.reduce((s, c) => s + c.score * (c.weight / 100), 0) /
        Math.max(
          1,
          constructScores.reduce((s, c) => s + c.weight / 100, 0)
        )
      : evidence.passed
        ? 72
        : 42;

  const overallScore = pr?.isCorrect
    ? 100
    : ca?.available
      ? clampScore(ca.score)
      : clampScore(pr?.score ?? weighted);
  const overallMastery = pr?.isCorrect || ca?.isCorrect
    ? ("advanced" as const)
    : masteryFromScore(overallScore);

  const confidence = clampScore(
    55 +
      (evidence.commandCount >= 1 ? 15 : 0) +
      (evidence.passed ? 15 : 0) +
      (constructScores.length > 0 ? 10 : 0) -
      (evidence.robotTouchCount > 5 ? 10 : 0)
  );

  const taskMastery = pr
    ? pr.isCorrect
      ? "Predicting Robot Movement: Student accurately predicted the robot's final position."
      : `Predicting Robot Movement: ${pr.teacherExplanation}`
    : ca?.available
      ? ca.isCorrect
        ? "Choose Action: Student selected the correct command for each blank."
        : `Choose Action: ${ca.teacherExplanation}`
      : evidence.passed
      ? `Met level goals (${masteryLabel(overallMastery)} CT profile)`
      : `Did not fully meet goals (${masteryLabel(overallMastery)} CT profile)`;

  const behaviors = [...evidence.behaviors];
  if (pr) {
    return {
      overallScore,
      overallMastery,
      confidence: clampScore(pr.isCorrect ? 92 : 70),
      taskMastery,
      behaviors: behaviors.slice(0, 10),
      interpretations: [pr.teacherExplanation],
      recommendations: [pr.recommendation],
      constructScores,
      routeComparison: null,
      numberLineEvidence: null,
      taskEnvironmentType: evidence.taskEnvironmentType,
      taskType: task.taskType,
      predictionResult: pr,
      choiceActionResult: null,
    };
  }
  if (ca?.available) {
    return {
      overallScore,
      overallMastery,
      confidence: clampScore(ca.isCorrect ? 90 : 68),
      taskMastery,
      behaviors: behaviors.slice(0, 10),
      interpretations: [ca.teacherExplanation],
      recommendations: [ca.recommendation],
      constructScores,
      routeComparison: null,
      numberLineEvidence: null,
      taskEnvironmentType: evidence.taskEnvironmentType,
      taskType: task.taskType,
      predictionResult: null,
      choiceActionResult: ca,
    };
  }
  if (task.taskEnvironmentType === "number-line") {
    behaviors.push("Assessment mode: number-line movement (not grid route efficiency).");
  }
  if (evidence.routeComparison) {
    const rc = evidence.routeComparison;
    const suffix =
      rc.extraCommands > 0
        ? ` — ${rc.extraCommands} extra command${rc.extraCommands === 1 ? "" : "s"} vs best route`
        : rc.extraTurns > 0
          ? ` — ${rc.extraTurns} extra turn${rc.extraTurns === 1 ? "" : "s"} vs best route`
          : "";
    behaviors.push(
      `Student program: ${rc.studentCommandCount} commands · Best route: ${rc.optimalCommandCount} commands${suffix}.`
    );
  }

  const interpretations = buildInterpretations(evidence, constructScores);

  return {
    overallScore,
    overallMastery,
    confidence,
    taskMastery,
    behaviors: behaviors.slice(0, 8),
    interpretations,
    recommendations,
    constructScores,
    routeComparison: evidence.routeComparison,
    numberLineEvidence: evidence.numberLineEvidence,
    taskEnvironmentType: task.taskEnvironmentType,
    taskType: task.taskType,
    predictionResult: evidence.predictionResult ?? null,
    choiceActionResult: evidence.choiceActionResult ?? null,
  };
}
