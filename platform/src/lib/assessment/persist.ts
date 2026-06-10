/**
 * Persist stealth assessment (task-level evidence and teacher summary).
 */

import { prisma } from "@/lib/prisma";
import { levelGameplayConfigSchema } from "@/lib/level-config";
import { runStealthAssessment } from "@/lib/assessment/assessmentEngine";
import { ASSESSMENT_VERSION } from "@/lib/assessment/assessmentConfig";
import type { AttemptEvidenceInput } from "@/lib/assessment/assessmentTypes";
import type { Prisma } from "@prisma/client";

export async function analyzeStealthAssessment(attemptId: string) {
  const attempt = await prisma.levelAttempt.findUnique({
    where: { id: attemptId },
    include: {
      commandEvents: { orderBy: { sequence: "asc" } },
      level: true,
    },
  });

  if (!attempt) throw new Error("Attempt not found");

  const parsed = levelGameplayConfigSchema.safeParse(attempt.level.config);
  if (!parsed.success) {
    return { attemptId, skipped: true as const, reason: "Invalid level config", performances: [] };
  }

  const input: AttemptEvidenceInput = {
    attemptId: attempt.id,
    attemptNumber: attempt.attemptNumber,
    passed: attempt.passed,
    status: attempt.status,
    finalCommand: attempt.finalCommand,
    initialCommand: attempt.initialCommand,
    commandHistory: attempt.commandHistory,
    hintsUsed: attempt.hintsUsed,
    mistakes: attempt.mistakes,
    totalTimeSeconds: attempt.totalTimeSeconds,
    robotTouched: attempt.robotTouched,
    robotTouchCount: attempt.robotTouchCount,
    resetCount: attempt.resetCount,
    firstRobotTouchAt: attempt.firstRobotTouchAt,
    startedAt: attempt.startedAt,
    commandEvents: attempt.commandEvents.map((e) => ({
      command: e.command,
      action: e.action,
    })),
  };

  const output = runStealthAssessment({
    taskId: attempt.levelId,
    levelConfig: parsed.data,
    levelType: attempt.level.levelType,
    attempt: input,
  });

  const constructScoresJson = [] as unknown as Prisma.InputJsonValue;
  const evidenceJson = {
    predictionResult: output.evidence.predictionResult ?? null,
    choiceActionResult: output.evidence.choiceActionResult ?? null,
    metrics: {
      commandCount: output.evidence.commandCount,
      optimalCommandCount: output.evidence.optimalCommandCount,
      efficiencyRatio: output.evidence.efficiencyRatio,
      wrongTurns: output.evidence.wrongTurns,
      collisions: output.evidence.collisions,
      unnecessaryMoves: output.evidence.unnecessaryMoves,
      directionAccuracy: output.evidence.directionAccuracy,
      goalCompletion: output.evidence.goalCompletion,
      subgoalCompletion: output.evidence.subgoalCompletion,
      correctGoalOrder: output.evidence.correctGoalOrder,
      sequenceCoherence: output.evidence.sequenceCoherence,
      obstacleAvoidance: output.evidence.obstacleAvoidance,
      routeRecovery: output.evidence.routeRecovery,
      routeDeviation: output.evidence.routeDeviation,
      predictionAccuracy: output.evidence.predictionAccuracy,
      resetCount: output.evidence.resetCount,
      robotTouched: output.evidence.robotTouched,
      robotTouchCount: output.evidence.robotTouchCount,
      taskEnvironmentType: output.evidence.taskEnvironmentType,
      numberLine:
        output.evidence.numberLineEvidence != null
          ? {
              startTick: output.evidence.numberLineEvidence.startTick,
              endTick: output.evidence.numberLineEvidence.endTick,
              goalTick: output.evidence.numberLineEvidence.goalTick,
              visitObjectSequence:
                output.evidence.numberLineEvidence.visitObjectSequence,
              visit1: output.evidence.numberLineEvidence.visit1,
              visit2: output.evidence.numberLineEvidence.visit2,
              correctVisitOrder:
                output.evidence.numberLineEvidence.correctVisitOrder,
              startPositionRecognition:
                output.evidence.numberLineEvidence.startPositionRecognition,
              directionAccuracy: output.evidence.numberLineEvidence.directionAccuracy,
              stepCountingAccuracy:
                output.evidence.numberLineEvidence.stepCountingAccuracy,
              arrowToMovementCorrespondence:
                output.evidence.numberLineEvidence.arrowToMovementCorrespondence,
              movementSequencing: output.evidence.numberLineEvidence.movementSequencing,
              orientationUnderstanding:
                output.evidence.numberLineEvidence.orientationUnderstanding,
            }
          : null,
    },
    behaviors: output.evidence.behaviors,
    simulation: {
      commandCount: output.evidence.simulation.commandCount,
      passed: output.evidence.simulation.passed,
      reachedGoals: output.evidence.simulation.reachedGoals,
      path: output.evidence.simulation.path,
    },
  } as Prisma.InputJsonValue;

  const routeAnalysisJson = (output.evidence.routeComparison ??
    null) as unknown as Prisma.InputJsonValue;

  const teacherSummaryJson = output.summary as unknown as Prisma.InputJsonValue;
  const recommendationsJson = output.summary.recommendations as Prisma.InputJsonValue;

  try {
    await prisma.stealthAssessmentResult.upsert({
    where: { attemptId },
    create: {
      attemptId,
      studentId: attempt.studentId,
      levelId: attempt.levelId,
      assessmentVersion: ASSESSMENT_VERSION,
      overallScore: output.summary.overallScore,
      overallMastery: output.summary.overallMastery,
      confidence: output.summary.confidence,
      taskType: output.taskConfig.taskType,
      constructScores: constructScoresJson,
      evidence: evidenceJson,
      routeAnalysis: routeAnalysisJson,
      teacherSummary: teacherSummaryJson,
      recommendations: recommendationsJson,
    },
    update: {
      assessmentVersion: ASSESSMENT_VERSION,
      overallScore: output.summary.overallScore,
      overallMastery: output.summary.overallMastery,
      confidence: output.summary.confidence,
      taskType: output.taskConfig.taskType,
      constructScores: constructScoresJson,
      evidence: evidenceJson,
      routeAnalysis: routeAnalysisJson,
      teacherSummary: teacherSummaryJson,
      recommendations: recommendationsJson,
    },
  });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("StealthAssessmentResult") && msg.includes("does not exist")) {
      console.warn(
        "[analyzeStealthAssessment] StealthAssessmentResult table missing. Run: npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/add_stealth_assessment_result.sql"
      );
      return { attemptId, skipped: true as const, reason: "StealthAssessmentResult table missing", performances: [] };
    }
    throw e;
  }

  return { attemptId, output, performances: [] };
}
