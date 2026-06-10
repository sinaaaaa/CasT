import type { AttemptEvidenceInput } from "@/lib/assessment/assessmentTypes";
import type { RouteComparison } from "@/lib/assessment/assessmentTypes";
import type { ChoiceActionAnalysisResult } from "@/lib/assessment/choiceActionAnalysis";
import type { DebuggingAnalysisResult } from "@/lib/assessment/debuggingAnalysis";
import type { PathBuildingAnalysisResult } from "@/lib/assessment/pathBuildingAnalysis";
import {
  computeAttemptLiveAssessment,
  type LiveAttemptAssessment,
} from "@/lib/assessment/compute-attempt-live-assessment";
import { LevelType } from "@prisma/client";

export type LiveRouteAnalysis = {
  taskEnvironmentType: LiveAttemptAssessment["taskEnvironmentType"];
  routeComparison: RouteComparison | null;
  numberLineEvidence: LiveAttemptAssessment["numberLineEvidence"];
  predictionResult: LiveAttemptAssessment["predictionResult"];
  choiceActionResult: ChoiceActionAnalysisResult | null;
  debuggingResult: DebuggingAnalysisResult | null;
  pathBuildingResult: PathBuildingAnalysisResult | null;
  routeStartPosition: { x: number; y: number } | null;
  starterPath: { x: number; y: number }[];
  starterPathStates: LiveAttemptAssessment["starterPathStates"];
  studentPath: { x: number; y: number }[];
  optimalPath: { x: number; y: number }[];
  commandCount: number;
  optimalCommandCount: number;
  interpretation: string;
  supported: boolean;
};

/** @deprecated Use computeAttemptLiveAssessment — kept for imports. */
export function computeAttemptRouteAnalysis(params: {
  levelConfig: unknown;
  levelType: LevelType;
  attempt: AttemptEvidenceInput;
}): LiveRouteAnalysis {
  const live = computeAttemptLiveAssessment(params);
  return {
    taskEnvironmentType: live.taskEnvironmentType,
    routeComparison: live.routeComparison,
    numberLineEvidence: live.numberLineEvidence,
    predictionResult: live.predictionResult,
    choiceActionResult: live.choiceActionResult,
    debuggingResult: live.debuggingResult,
    pathBuildingResult: live.pathBuildingResult,
    routeStartPosition: live.routeStartPosition,
    starterPath: live.starterPath,
    starterPathStates: live.starterPathStates,
    studentPath: live.studentPath,
    optimalPath: live.optimalPath,
    commandCount: live.commandCount,
    optimalCommandCount: live.optimalCommandCount,
    interpretation: live.interpretation,
    supported: live.supported,
  };
}
