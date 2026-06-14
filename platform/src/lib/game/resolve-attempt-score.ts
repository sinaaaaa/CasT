import { LevelType } from "@prisma/client";
import { buildChoiceActionFromAttempt } from "@/lib/assessment/choiceActionAnalysis";
import { buildTaskAssessmentConfig } from "@/lib/assessment/assessmentConfig";
import { buildPredictionFromAttempt } from "@/lib/assessment/predictionAnalysis";
import {
  parseBlankAnswersFromMistakes,
  parseStudentFlagFromMistakes,
} from "@/lib/assessment/evidenceExtractors";
import { resolveAttemptProgram } from "@/lib/assessment/resolve-program";
import {
  programStopsOnGoalStrict,
  simulateProgram,
} from "@/lib/assessment/routeAnalysis";
import { levelGameplayConfigSchema, type LevelGameplayConfig } from "@/lib/level-config";

/** Unity JsonUtility may send 0/1 or string booleans — normalize for scoring. */
export function parseUnityBoolean(value: unknown): boolean | null {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  if (value === "true" || value === "TRUE") return true;
  if (value === "false" || value === "FALSE") return false;
  return null;
}

function mistakesRecord(mistakes: unknown): Record<string, unknown> | null {
  if (!mistakes || typeof mistakes !== "object" || Array.isArray(mistakes)) return null;
  return mistakes as Record<string, unknown>;
}

function parseLevelConfigForScoring(levelConfig: unknown): LevelGameplayConfig | null {
  const rawConfig =
    levelConfig && typeof levelConfig === "object"
      ? ({ levelName: "Level", ...(levelConfig as Record<string, unknown>) } as unknown)
      : levelConfig;
  const parsed = levelGameplayConfigSchema.safeParse(rawConfig);
  return parsed.success ? parsed.data : null;
}

/** Structured evidence Unity stores in mistakes JSON (flag, blanks, visit sequence). */
function resolvePassedFromMistakesEvidence(
  mistakes: unknown,
  levelType: LevelType
): boolean | null {
  const o = mistakesRecord(mistakes);
  if (!o) return null;

  if (levelType === LevelType.CHOOSE_BUTTONS) {
    const blanks = parseBlankAnswersFromMistakes(mistakes);
    if (blanks.isCorrect != null) return blanks.isCorrect;
  }

  const visit =
    o.objectVisit && typeof o.objectVisit === "object"
      ? (o.objectVisit as Record<string, unknown>)
      : null;
  if (visit && typeof visit.visitPattern === "string") {
    if (visit.visitPattern === "both") return true;
    // Partial visit telemetry is unreliable — route / flag analysis decides pass/fail.
  }

  const flagCell = parseStudentFlagFromMistakes(mistakes);
  const expectedCell =
    o.expectedCell && typeof o.expectedCell === "object"
      ? (o.expectedCell as { x?: number; y?: number })
      : null;
  if (
    flagCell &&
    expectedCell &&
    typeof expectedCell.x === "number" &&
    typeof expectedCell.y === "number" &&
    expectedCell.x >= 0 &&
    expectedCell.y >= 0
  ) {
    return flagCell.x === expectedCell.x && flagCell.y === expectedCell.y;
  }

  return null;
}

const ROUTE_SCORING_LEVEL_TYPES = new Set<LevelType>([
  LevelType.DRAG_ACTIONS,
  LevelType.DRAG_EDIT_PROGRAM,
]);

function resolvePassedFromRouteSimulation(params: {
  levelType: LevelType;
  levelConfig: unknown;
  finalCommand?: string | null;
  initialCommand?: string | null;
}): boolean | null {
  if (!ROUTE_SCORING_LEVEL_TYPES.has(params.levelType)) return null;

  const config = parseLevelConfigForScoring(params.levelConfig);
  if (!config) return null;

  const commands = resolveAttemptProgram({
    finalCommand: params.finalCommand ?? null,
    initialCommand: params.initialCommand ?? null,
    levelConfig: config,
    levelType: params.levelType,
  });
  if (commands.length === 0) return null;

  const task = buildTaskAssessmentConfig("live", config, [], params.levelType);
  const simulation = simulateProgram(task, commands);
  return programStopsOnGoalStrict(task, simulation);
}

function resolvePassedFromFlagPrediction(params: {
  levelType: LevelType;
  levelConfig: unknown;
  mistakes: unknown;
  finalCommand?: string | null;
  initialCommand?: string | null;
  attemptNumber?: number;
  unityPassed: boolean;
}): boolean | null {
  if (params.levelType !== LevelType.FLAG_PLACEMENT) return null;

  const config = parseLevelConfigForScoring(params.levelConfig);
  if (!config) return null;

  const flag = parseStudentFlagFromMistakes(params.mistakes);
  if (!flag) return null;

  const prediction = buildPredictionFromAttempt({
    levelId: "live",
    levelConfig: config,
    levelType: params.levelType,
    attempt: {
      attemptId: "",
      attemptNumber: params.attemptNumber ?? 1,
      passed: params.unityPassed,
      status: params.unityPassed ? "correct" : "incorrect",
      finalCommand: params.finalCommand ?? null,
      initialCommand: params.initialCommand ?? null,
      commandHistory: null,
      hintsUsed: 0,
      mistakes: params.mistakes,
      totalTimeSeconds: null,
      robotTouchCount: 0,
      commandEvents: [],
    },
  });

  if (!prediction.available) return null;
  return prediction.isCorrect;
}

function resolveIntroPassed(params: {
  levelType: LevelType;
  unityPassed: boolean;
  finalCommand?: string | null;
}): boolean | null {
  if (params.levelType !== LevelType.INTRO) return null;
  if (params.unityPassed) return true;
  const cmd = params.finalCommand?.trim().toLowerCase() ?? "";
  if (
    cmd.includes("completed") ||
    cmd.includes("intro") ||
    cmd.includes("level complete")
  ) {
    return true;
  }
  return null;
}

/** Normalize Unity / API score + passed for storage across all level types. */
export function resolveAttemptEndScore(params: {
  levelType: LevelType;
  levelConfig: unknown;
  passed?: unknown;
  score?: number | null;
  mistakes: unknown;
  finalCommand?: string | null;
  initialCommand?: string | null;
  attemptNumber?: number;
}): { score: number | null; passed: boolean } {
  const unityPassed = parseUnityBoolean(params.passed) ?? false;
  let resolvedPassed = unityPassed;
  let resolvedScore = params.score ?? null;

  const config = parseLevelConfigForScoring(params.levelConfig);

  if (params.levelType === LevelType.CHOOSE_BUTTONS && config) {
    const choice = buildChoiceActionFromAttempt({
      levelConfig: config,
      levelType: params.levelType,
      attempt: {
        attemptId: "",
        attemptNumber: params.attemptNumber ?? 1,
        passed: unityPassed,
        status: unityPassed ? "correct" : "incorrect",
        finalCommand: params.finalCommand ?? null,
        initialCommand: params.initialCommand ?? null,
        commandHistory: null,
        hintsUsed: 0,
        mistakes: params.mistakes,
        totalTimeSeconds: null,
        robotTouchCount: 0,
        commandEvents: [],
      },
    });

    const hasBlanks = (config.blanks?.length ?? 0) > 0;
    if (choice.available || hasBlanks) {
      const passed = choice.isCorrect || unityPassed;
      return { score: passed ? 100 : choice.score, passed };
    }
  }

  const evidencePassed = resolvePassedFromMistakesEvidence(params.mistakes, params.levelType);
  if (!resolvedPassed && evidencePassed === true) {
    resolvedPassed = true;
  } else if (resolvedPassed && evidencePassed === false) {
    resolvedPassed = false;
  }

  const introPassed = resolveIntroPassed({
    levelType: params.levelType,
    unityPassed,
    finalCommand: params.finalCommand,
  });
  if (!resolvedPassed && introPassed === true) resolvedPassed = true;

  const flagPassed = resolvePassedFromFlagPrediction({
    levelType: params.levelType,
    levelConfig: params.levelConfig,
    mistakes: params.mistakes,
    finalCommand: params.finalCommand,
    initialCommand: params.initialCommand,
    attemptNumber: params.attemptNumber,
    unityPassed,
  });
  if (!resolvedPassed && flagPassed === true) resolvedPassed = true;
  else if (
    resolvedPassed &&
    flagPassed === false &&
    !unityPassed &&
    params.levelType === LevelType.FLAG_PLACEMENT
  ) {
    resolvedPassed = false;
  }

  const routePassed = resolvePassedFromRouteSimulation({
    levelType: params.levelType,
    levelConfig: params.levelConfig,
    finalCommand: params.finalCommand,
    initialCommand: params.initialCommand,
  });
  if (!resolvedPassed && routePassed === true) resolvedPassed = true;
  else if (resolvedPassed && routePassed === false && !unityPassed) resolvedPassed = false;

  if (!resolvedPassed && (resolvedScore == null || resolvedScore >= 100)) {
    resolvedScore = 0;
  } else if (resolvedPassed && (resolvedScore == null || resolvedScore <= 0)) {
    resolvedScore = 100;
  }

  return { score: resolvedScore, passed: resolvedPassed };
}
