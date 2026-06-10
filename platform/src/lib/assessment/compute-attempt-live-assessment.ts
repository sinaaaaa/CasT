import { levelGameplayConfigSchema } from "@/lib/level-config";
import {
  buildTaskAssessmentConfig,
  isChooseActionLevel,
  isDebuggingLevel,
  isFlagPredictionLevel,
  isPathBuildingLevel,
  resolveRouteStartCell,
  resolveTaskEnvironmentType,
} from "@/lib/assessment/assessmentConfig";
import { extractEvidence } from "@/lib/assessment/assessmentEngine";
import type {
  AttemptEvidenceInput,
  NumberLineEvidence,
  RouteComparison,
  TaskEnvironmentType,
} from "@/lib/assessment/assessmentTypes";
import { buildRouteInterpretation } from "@/lib/assessment/routeAnalysis";
import { buildNumberLineInterpretation } from "@/lib/assessment/numberLineAnalysis";
import {
  buildPredictionFromAttempt,
  type PredictionAnalysisResult,
} from "@/lib/assessment/predictionAnalysis";
import {
  buildChoiceActionFromAttempt,
  type ChoiceActionAnalysisResult,
} from "@/lib/assessment/choiceActionAnalysis";
import {
  buildDebuggingFromAttempt,
  type DebuggingAnalysisResult,
} from "@/lib/assessment/debuggingAnalysis";
import {
  buildPathBuildingFromAttempt,
  type PathBuildingAnalysisResult,
} from "@/lib/assessment/pathBuildingAnalysis";
import { programSupportsRouteAnalysis } from "@/lib/assessment/resolve-program";
import { LevelType } from "@prisma/client";

export type LiveAttemptAssessment = {
  taskEnvironmentType: TaskEnvironmentType;
  interpretation: string;
  supported: boolean;
  routeComparison: RouteComparison | null;
  numberLineEvidence: NumberLineEvidence | null;
  predictionResult: PredictionAnalysisResult | null;
  choiceActionResult: ChoiceActionAnalysisResult | null;
  debuggingResult: DebuggingAnalysisResult | null;
  pathBuildingResult: PathBuildingAnalysisResult | null;
  /** Robot start cell for grid maps (flag / route levels). */
  routeStartPosition: { x: number; y: number } | null;
  /** Simulated path if student ran the level starter program (drag-edit levels). */
  starterPath: { x: number; y: number }[];
  starterPathStates: import("@/lib/assessment/assessmentTypes").PathState[];
  studentPath: { x: number; y: number }[];
  optimalPath: { x: number; y: number }[];
  commandCount: number;
  optimalCommandCount: number;
};

/** Live assessment for teacher attempt page (grid route or number-line movement). */
export function computeAttemptLiveAssessment(params: {
  levelConfig: unknown;
  levelType: LevelType;
  attempt: AttemptEvidenceInput;
}): LiveAttemptAssessment {
  const parsed = levelGameplayConfigSchema.safeParse(params.levelConfig);
  if (!parsed.success) {
    return emptyLive("Level layout data is not available for assessment.");
  }

  const taskEnvironmentType = resolveTaskEnvironmentType(parsed.data);
  const task = buildTaskAssessmentConfig("live", parsed.data, [], params.levelType);

  if (isFlagPredictionLevel(parsed.data, params.levelType)) {
    task.compareWithOptimalRoute = false;
    const predictionResult = buildPredictionFromAttempt({
      levelId: "live",
      levelConfig: parsed.data,
      levelType: params.levelType,
      attempt: params.attempt,
    });
    const evidence = extractEvidence(task, params.attempt, params.levelType);
    const routeStart = resolveRouteStartCell(parsed.data).position;
    return {
      taskEnvironmentType: "grid",
      interpretation: predictionResult.teacherExplanation,
      supported: true,
      routeComparison: null,
      numberLineEvidence: null,
      predictionResult,
      choiceActionResult: null,
      debuggingResult: null,
      pathBuildingResult: null,
      routeStartPosition: routeStart,
      starterPath: [],
      starterPathStates: [],
      studentPath: evidence.simulation.path.length > 0 ? evidence.simulation.path : [routeStart],
      optimalPath: [],
      commandCount: predictionResult.givenCommands.length,
      optimalCommandCount: 0,
    };
  }

  if (isPathBuildingLevel(parsed.data, params.levelType)) {
    task.compareWithOptimalRoute = true;
    const pathBuildingResult = buildPathBuildingFromAttempt({
      levelConfig: parsed.data,
      levelType: params.levelType,
      attempt: params.attempt,
      task,
    });
    const routeStart = resolveRouteStartCell(parsed.data).position;
    return {
      taskEnvironmentType: "grid",
      interpretation: pathBuildingResult.teacherExplanation,
      supported: pathBuildingResult.available,
      routeComparison: null,
      numberLineEvidence: null,
      predictionResult: null,
      choiceActionResult: null,
      debuggingResult: null,
      pathBuildingResult,
      routeStartPosition: routeStart,
      starterPath: [],
      starterPathStates: [],
      studentPath: pathBuildingResult.studentPath,
      optimalPath: pathBuildingResult.shortestPath,
      commandCount: pathBuildingResult.commandCount,
      optimalCommandCount: pathBuildingResult.shortestCommandCount,
    };
  }

  if (isDebuggingLevel(parsed.data, params.levelType)) {
    task.compareWithOptimalRoute = false;
    const debuggingResult = buildDebuggingFromAttempt({
      levelConfig: parsed.data,
      levelType: params.levelType,
      attempt: params.attempt,
      task,
    });
    const routeStart = resolveRouteStartCell(parsed.data).position;
    return {
      taskEnvironmentType: "grid",
      interpretation: debuggingResult.teacherExplanation,
      supported: debuggingResult.available,
      routeComparison: null,
      numberLineEvidence: null,
      predictionResult: null,
      choiceActionResult: null,
      debuggingResult,
      pathBuildingResult: null,
      routeStartPosition: routeStart,
      starterPath: debuggingResult.originalPath,
      starterPathStates: debuggingResult.originalPathStates ?? [],
      studentPath: debuggingResult.studentPath,
      optimalPath: debuggingResult.optimalPath,
      commandCount: debuggingResult.studentProgram.length,
      optimalCommandCount: debuggingResult.correctProgram.length,
    };
  }

  if (isChooseActionLevel(parsed.data, params.levelType)) {
    task.compareWithOptimalRoute = false;
    const choiceActionResult = buildChoiceActionFromAttempt({
      levelConfig: parsed.data,
      levelType: params.levelType,
      attempt: params.attempt,
    });
    const evidence = extractEvidence(task, params.attempt, params.levelType);
    return {
      taskEnvironmentType: "grid",
      interpretation: choiceActionResult.teacherExplanation,
      supported: choiceActionResult.available,
      routeComparison: null,
      numberLineEvidence: null,
      predictionResult: null,
      choiceActionResult,
      debuggingResult: null,
      pathBuildingResult: null,
      routeStartPosition: resolveRouteStartCell(parsed.data).position,
      starterPath: [],
      starterPathStates: [],
      studentPath: evidence.simulation.path,
      optimalPath: [],
      commandCount: choiceActionResult.programCommands.length,
      optimalCommandCount: 0,
    };
  }

  if (taskEnvironmentType === "number-line") {
    task.compareWithOptimalRoute = false;
    const evidence = extractEvidence(task, params.attempt, params.levelType);
    const nl = evidence.numberLineEvidence;
    return {
      taskEnvironmentType: "number-line",
      interpretation: buildNumberLineInterpretation(nl, evidence.passed),
      supported: true,
      routeComparison: null,
      numberLineEvidence: nl,
      predictionResult: null,
      choiceActionResult: null,
      debuggingResult: null,
      pathBuildingResult: null,
      routeStartPosition: resolveRouteStartCell(parsed.data).position,
      starterPath: [],
      starterPathStates: [],
      studentPath: evidence.simulation.path,
      optimalPath: [],
      commandCount: evidence.commandCount,
      optimalCommandCount: nl?.optimalMoveCount ?? 0,
    };
  }

  const supported = programSupportsRouteAnalysis(parsed.data, params.levelType);
  if (!supported) {
    return {
      ...emptyLive("This level type does not include grid movement for route comparison."),
      taskEnvironmentType: "grid",
    };
  }

  task.compareWithOptimalRoute = true;
  const evidence = extractEvidence(task, params.attempt, params.levelType);
  const rc = evidence.routeComparison;

  return {
    taskEnvironmentType: "grid",
    interpretation: buildRouteInterpretation(rc, evidence.simulation.passed),
    supported: true,
    routeComparison: rc,
    numberLineEvidence: null,
    predictionResult: null,
    choiceActionResult: null,
    debuggingResult: null,
    pathBuildingResult: null,
    routeStartPosition: resolveRouteStartCell(parsed.data).position,
    starterPath: [],
    starterPathStates: [],
    studentPath: evidence.simulation.path,
    optimalPath: rc?.optimalPath ?? [],
    commandCount: evidence.commandCount,
    optimalCommandCount: evidence.optimalCommandCount,
  };
}

function emptyLive(interpretation: string): LiveAttemptAssessment {
  return {
    taskEnvironmentType: "grid",
    interpretation,
    supported: false,
    routeComparison: null,
    numberLineEvidence: null,
    predictionResult: null,
    choiceActionResult: null,
    debuggingResult: null,
    pathBuildingResult: null,
    routeStartPosition: null,
    starterPath: [],
    starterPathStates: [],
    studentPath: [],
    optimalPath: [],
    commandCount: 0,
    optimalCommandCount: 0,
  };
}