import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { gameApiUnauthorized, verifyGameApiKey } from "@/lib/game-api";
import {
  rebuildCommandHistory,
  syncRobotTouchStats,
} from "@/lib/game-service";
import { resolveAttemptEndScore } from "@/lib/game/resolve-attempt-score";
import { resolveAttemptDurationSeconds } from "@/lib/game/resolve-attempt-duration";
import { analyzeAttemptConstructs } from "@/lib/ct/scoring";
import { parsePlaySlot } from "@/lib/attempt-mistakes";
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

  const attempt = await prisma.levelAttempt.findUnique({
    where: { id: attemptId },
    include: { level: true },
  });
  if (!attempt) return Response.json({ error: "Attempt not found" }, { status: 404 });

  const endedAt = new Date();
  const computedTime = resolveAttemptDurationSeconds({
    totalTimeSeconds,
    startedAt: attempt.startedAt,
    endedAt,
  });

  await syncRobotTouchStats(attemptId);

  const storedPlaySlot = parsePlaySlot(attempt.mistakes);

  const baseMessages = Array.isArray(mistakes) ? mistakes : mistakes != null ? [mistakes] : [];
  const extras =
    assessmentExtras && typeof assessmentExtras === "object" ? assessmentExtras : null;

  const mistakesPayload: Prisma.InputJsonValue = (() => {
    if (extras || objectVisit) {
      const flagCell =
        typeof extras?.flagCellX === "number" &&
        typeof extras?.flagCellY === "number" &&
        extras.flagCellX >= 0 &&
        extras.flagCellY >= 0
          ? { x: extras.flagCellX, y: extras.flagCellY }
          : undefined;
      const expectedCell =
        typeof extras?.expectedCellX === "number" &&
        typeof extras?.expectedCellY === "number" &&
        extras.expectedCellX >= 0 &&
        extras.expectedCellY >= 0
          ? { x: extras.expectedCellX, y: extras.expectedCellY }
          : undefined;
      const playSlotFromExtras =
        typeof extras?.playSlot === "number" && extras.playSlot >= 1 ? extras.playSlot : null;
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
        ...(typeof extras?.inLevelRunNumber === "number" && extras.inLevelRunNumber >= 1
          ? { inLevelRunNumber: extras.inLevelRunNumber }
          : {}),
        ...(typeof extras?.maxLevelRuns === "number" && extras.maxLevelRuns >= 1
          ? { maxLevelRuns: extras.maxLevelRuns }
          : {}),
        ...(storedPlaySlot != null ? { playSlot: storedPlaySlot } : {}),
        ...(playSlotFromExtras != null ? { playSlot: playSlotFromExtras } : {}),
      } as Prisma.InputJsonValue;
    }
    return ((mistakes ?? attempt.mistakes) as Prisma.InputJsonValue) ?? [];
  })();

  const { score: resolvedScore, passed: resolvedPassed } = resolveAttemptEndScore({
    levelType: attempt.level.levelType,
    levelConfig: attempt.level.config,
    passed,
    score: score ?? attempt.score,
    mistakes: mistakesPayload,
    finalCommand: finalCommand ?? attempt.finalCommand,
    initialCommand: attempt.initialCommand,
    attemptNumber: attempt.attemptNumber,
  });

  const resolvedStatus = resolvedPassed ? AttemptStatus.CORRECT : AttemptStatus.INCORRECT;

  const updated = await prisma.levelAttempt.update({
    where: { id: attemptId },
    data: {
      endedAt,
      totalTimeSeconds: computedTime,
      status: resolvedStatus,
      passed: resolvedPassed,
      score: resolvedScore ?? attempt.score,
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
