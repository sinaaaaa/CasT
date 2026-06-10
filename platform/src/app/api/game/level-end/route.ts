import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { gameApiUnauthorized, verifyGameApiKey } from "@/lib/game-api";
import {
  parseAttemptStatus,
  rebuildCommandHistory,
  syncRobotTouchStats,
} from "@/lib/game-service";
import { analyzeAttemptConstructs } from "@/lib/ct/scoring";
import { AttemptStatus, Prisma } from "@prisma/client";

export async function POST(request: NextRequest) {
  if (!verifyGameApiKey(request)) return gameApiUnauthorized();

  const body = await request.json();
  const {
    attemptId,
    status,
    passed,
    score,
    finalCommand,
    totalTimeSeconds,
    hintsUsed,
    mistakes,
    feedback,
    closedButtons,
    disabledButtons,
    assessment,
    objectVisit,
    resetCount,
    robotTouched,
    robotTouchCount,
    robotTouchDurationSeconds,
    assessmentExtras,
  } = body as {
    attemptId: string;
    status?: string;
    passed?: boolean;
    score?: number;
    finalCommand?: string;
    totalTimeSeconds?: number;
    hintsUsed?: number;
    mistakes?: unknown;
    feedback?: string;
    closedButtons?: string[];
    disabledButtons?: string[];
    objectVisit?: {
      startObjectType?: string;
      endObjectType?: string;
      reachedStart?: boolean;
      reachedEnd?: boolean;
      visitPattern?: "both" | "start_only" | "end_only" | "neither";
    };
    resetCount?: number;
    robotTouched?: boolean;
    robotTouchCount?: number;
    robotTouchDurationSeconds?: number;
    assessmentExtras?: Record<string, unknown>;
    assessment?: {
      mistakePattern?: string;
      assessmentNotes?: string;
      decomposition?: number;
      patternRecognition?: number;
      algorithmicThinking?: number;
      debugging?: number;
      abstraction?: number;
      persistence?: number;
      creativity?: number;
      totalScore?: number;
    };
  };

  if (!attemptId) {
    return Response.json({ error: "attemptId is required" }, { status: 400 });
  }

  const attempt = await prisma.levelAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt) return Response.json({ error: "Attempt not found" }, { status: 404 });

  const endedAt = new Date();
  const computedTime =
    totalTimeSeconds ??
    (attempt.startedAt ? (endedAt.getTime() - attempt.startedAt.getTime()) / 1000 : null);

  const parsedStatus = status ? parseAttemptStatus(status) : attempt.status;

  await syncRobotTouchStats(attemptId);

  const baseMessages = Array.isArray(mistakes) ? mistakes : mistakes != null ? [mistakes] : [];
  const extras =
    assessmentExtras && typeof assessmentExtras === "object" ? assessmentExtras : null;

  const mistakesPayload: Prisma.InputJsonValue = (() => {
    if (extras || objectVisit) {
      const flagCell =
        typeof extras?.flagCellX === "number" && typeof extras?.flagCellY === "number"
          ? { x: extras.flagCellX, y: extras.flagCellY }
          : undefined;
      const expectedCell =
        typeof extras?.expectedCellX === "number" && typeof extras?.expectedCellY === "number"
          ? { x: extras.expectedCellX, y: extras.expectedCellY }
          : undefined;
      return {
        messages: baseMessages,
        ...(objectVisit ? { objectVisit } : {}),
        ...(flagCell ? { flagCell } : {}),
        ...(expectedCell ? { expectedCell } : {}),
        ...(typeof extras?.flagPredictionCorrect === "boolean"
          ? { flagPredictionCorrect: extras.flagPredictionCorrect }
          : {}),
        ...(Array.isArray(extras?.blankAnswers)
          ? { blankAnswers: extras.blankAnswers }
          : {}),
        ...(Array.isArray(extras?.correctBlankAnswers)
          ? { correctBlankAnswers: extras.correctBlankAnswers }
          : {}),
        ...(typeof extras?.blankAnswersCorrect === "boolean"
          ? { blankAnswersCorrect: extras.blankAnswersCorrect }
          : {}),
      } as Prisma.InputJsonValue;
    }
    return ((mistakes ?? attempt.mistakes) as Prisma.InputJsonValue) ?? [];
  })();

  const updated = await prisma.levelAttempt.update({
    where: { id: attemptId },
    data: {
      endedAt,
      totalTimeSeconds: computedTime,
      status: parsedStatus,
      passed: passed ?? parsedStatus === AttemptStatus.CORRECT,
      score: score ?? attempt.score,
      finalCommand: finalCommand ?? attempt.finalCommand,
      hintsUsed: hintsUsed ?? attempt.hintsUsed,
      mistakes: mistakesPayload,
      feedback: feedback ?? attempt.feedback,
      closedButtons: (closedButtons ?? attempt.closedButtons) as Prisma.InputJsonValue,
      disabledButtons: (disabledButtons ?? attempt.disabledButtons) as Prisma.InputJsonValue,
      ...(typeof resetCount === "number" && resetCount >= 0
        ? { resetCount: Math.max(attempt.resetCount, resetCount) }
        : {}),
      ...(typeof robotTouched === "boolean" ? { robotTouched } : {}),
      ...(typeof robotTouchCount === "number"
        ? { robotTouchCount: Math.max(attempt.robotTouchCount, robotTouchCount) }
        : {}),
      ...(typeof robotTouchDurationSeconds === "number"
        ? {
            robotTouchDurationSeconds: Math.max(
              attempt.robotTouchDurationSeconds,
              robotTouchDurationSeconds
            ),
          }
        : {}),
    },
  });

  await rebuildCommandHistory(attemptId);

  if (assessment) {
    await prisma.assessmentResult.upsert({
      where: { attemptId },
      create: {
        attemptId,
        mistakePattern: assessment.mistakePattern,
        assessmentNotes: assessment.assessmentNotes,
        decomposition: assessment.decomposition,
        patternRecognition: assessment.patternRecognition,
        algorithmicThinking: assessment.algorithmicThinking,
        debugging: assessment.debugging,
        abstraction: assessment.abstraction,
        persistence: assessment.persistence,
        creativity: assessment.creativity,
        totalScore: assessment.totalScore ?? score,
      },
      update: {
        mistakePattern: assessment.mistakePattern,
        assessmentNotes: assessment.assessmentNotes,
        decomposition: assessment.decomposition,
        patternRecognition: assessment.patternRecognition,
        algorithmicThinking: assessment.algorithmicThinking,
        debugging: assessment.debugging,
        abstraction: assessment.abstraction,
        persistence: assessment.persistence,
        creativity: assessment.creativity,
        totalScore: assessment.totalScore ?? score,
      },
    });
  }

  try {
    await analyzeAttemptConstructs(attemptId);
  } catch (e) {
    console.warn("[level-end] CT construct analysis failed:", e);
  }

  return Response.json({ success: true, attempt: updated });
}
