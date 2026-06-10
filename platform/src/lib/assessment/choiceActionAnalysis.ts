/**
 * Choose-action (guided blank) level assessment — correct vs student button choices.
 */

import type { LevelGameplayConfig } from "@/lib/level-config";
import { LevelType } from "@prisma/client";
import { clampScore, masteryFromScore } from "@/lib/assessment/assessmentConfig";
import type { AttemptEvidenceInput } from "@/lib/assessment/assessmentTypes";
import { parseBlankAnswersFromMistakes } from "@/lib/assessment/evidenceExtractors";
import { buildTaskAssessmentConfig } from "@/lib/assessment/assessmentConfig";
import { analyzeObstacleCollisions } from "@/lib/assessment/obstacleAnalysis";
import { resolveAttemptProgram } from "@/lib/assessment/resolve-program";
import { simulateProgram } from "@/lib/assessment/routeAnalysis";
import type { RobotCommand } from "@/lib/assessment/assessmentTypes";
import { normalizeCommandToken } from "@/lib/command-icons";

export type ChoiceActionAnalysisResult = {
  available: boolean;
  isCorrect: boolean;
  score: number;
  level: ReturnType<typeof masteryFromScore>;
  programCommands: RobotCommand[];
  studentChoices: string[];
  correctChoices: string[];
  teacherExplanation: string;
  recommendation: string;
  hasObstacle: boolean;
  obstacleCollision: boolean;
  obstacleCollisionCount: number;
  obstacleCollisionSteps: number[];
  attemptedObstacleCells: { x: number; y: number }[];
  firstObstacleMistakeStep: number | null;
  obstacleAvoided: boolean;
};

function normalizeChoice(s: string): string {
  const n = normalizeCommandToken(s.trim().toLowerCase());
  return n ?? s.trim().toLowerCase();
}

export function analyzeChoiceAction(params: {
  levelConfig: LevelGameplayConfig;
  levelType?: LevelType;
  studentChoices: string[];
  correctChoices: string[];
  programCommands: RobotCommand[];
  attemptPassed?: boolean;
}): ChoiceActionAnalysisResult {
  const { levelConfig, levelType, studentChoices, correctChoices, programCommands, attemptPassed } =
    params;

  const blanks = levelConfig.blanks ?? [];
  const expected =
    correctChoices.length > 0
      ? correctChoices
      : blanks.map((b) => b.correctAnswer).filter(Boolean);

  const task = buildTaskAssessmentConfig("choice", levelConfig, [], levelType);
  const sim =
    programCommands.length > 0 ? simulateProgram(task, programCommands) : null;
  const obstacle = sim
    ? analyzeObstacleCollisions(sim, { hasObstacle: task.hasObstacle })
    : {
        hasObstacle: task.hasObstacle,
        obstacleAvoided: true,
        obstacleCollision: false,
        obstacleCollisionCount: 0,
        obstacleCollisionSteps: [],
        attemptedObstacleCells: [],
        firstObstacleMistakeStep: null,
      };

  if (expected.length === 0 && studentChoices.length === 0) {
    return {
      available: false,
      isCorrect: attemptPassed ?? false,
      score: attemptPassed ? 100 : 0,
      level: masteryFromScore(attemptPassed ? 100 : 0),
      programCommands,
      studentChoices,
      correctChoices: expected,
      teacherExplanation: "No blank answers were recorded for this attempt.",
      recommendation: "Ensure the game sends blankAnswers on level complete.",
      ...obstacle,
    };
  }

  const filled = studentChoices.length >= expected.length;
  const isCorrect =
    filled &&
    expected.every((ans, i) => normalizeChoice(studentChoices[i] ?? "") === normalizeChoice(ans));

  const score = isCorrect ? 100 : filled ? 35 : 15;
  const wrongIdx = expected.findIndex(
    (ans, i) => normalizeChoice(studentChoices[i] ?? "") !== normalizeChoice(ans)
  );

  let teacherExplanation: string;
  let recommendation: string;

  if (obstacle.obstacleCollision && obstacle.firstObstacleMistakeStep != null) {
    teacherExplanation = `Student tried to move through the obstacle at Step ${obstacle.firstObstacleMistakeStep}.`;
    recommendation =
      "Practice planning around blocked cells before filling in the next blank.";
  } else if (isCorrect) {
    teacherExplanation = obstacle.obstacleAvoided && obstacle.hasObstacle
      ? "The student chose the correct actions and the path avoids obstacles."
      : "The student chose the correct action for each blank in the program.";
    recommendation = "Assign a slightly harder choose-action level with two blanks or a turn.";
  } else if (!filled) {
    teacherExplanation = "The student did not complete all guided blanks before finishing.";
    recommendation = "Review how to fill each blank before pressing RUN.";
  } else {
    const studentPick = studentChoices[wrongIdx] ?? "—";
    const correctPick = expected[wrongIdx] ?? "—";
    teacherExplanation = `Blank ${wrongIdx + 1}: student chose "${studentPick}" but the correct action was "${correctPick}".`;
    if (
      (studentPick.includes("left") && correctPick.includes("right")) ||
      (studentPick.includes("right") && correctPick.includes("left"))
    ) {
      recommendation =
        "Practice left vs right turns from the robot's point of view before the next choose-action level.";
    } else if (
      (studentPick.includes("forward") && correctPick.includes("backward")) ||
      (studentPick.includes("backward") && correctPick.includes("forward"))
    ) {
      recommendation =
        "Review forward vs backward relative to the robot's facing direction.";
    } else {
      recommendation = "Retry a single-blank choose-action level with the same command types.";
    }
  }

  return {
    available: true,
    isCorrect,
    score: clampScore(score),
    level: masteryFromScore(score),
    programCommands,
    studentChoices,
    correctChoices: expected,
    teacherExplanation,
    recommendation,
    ...obstacle,
  };
}

export function buildChoiceActionFromAttempt(params: {
  levelConfig: LevelGameplayConfig;
  levelType?: LevelType;
  attempt: AttemptEvidenceInput;
}): ChoiceActionAnalysisResult {
  const { levelConfig, levelType, attempt } = params;
  const parsed = parseBlankAnswersFromMistakes(attempt.mistakes);
  const programCommands = resolveAttemptProgram({
    finalCommand: attempt.finalCommand,
    initialCommand: attempt.initialCommand,
    levelConfig,
    levelType,
    commandEvents: attempt.commandEvents,
  }) as RobotCommand[];

  const isCorrect =
    parsed.isCorrect != null ? parsed.isCorrect : attempt.passed;

  return analyzeChoiceAction({
    levelConfig,
    levelType,
    studentChoices: parsed.student,
    correctChoices: parsed.correct,
    programCommands,
    attemptPassed: isCorrect,
  });
}
