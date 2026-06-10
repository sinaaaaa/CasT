/**
 * Stealth CT assessment (ECD) — public API.
 */

export * from "@/lib/assessment/assessmentTypes";
export * from "@/lib/assessment/assessmentConfig";
export * from "@/lib/assessment/comparison-target";
export * from "@/lib/assessment/routeAnalysis";
export * from "@/lib/assessment/numberLineAnalysis";
export * from "@/lib/assessment/compute-attempt-live-assessment";
export * from "@/lib/assessment/assessmentEngine";
export * from "@/lib/assessment/assessmentNarratives";
export * from "@/lib/assessment/teacherInterpretation";
export { analyzeStealthAssessment } from "@/lib/assessment/persist";
export * from "@/lib/assessment/predictionAnalysis";
export {
  isFlagPredictionLevel,
  isChooseActionLevel,
  isDebuggingLevel,
  isDragEditProgramLevel,
  isEditStarterProgramLevel,
  isPathBuildingLevel,
} from "@/lib/assessment/assessmentConfig";
export {
  analyzeObstacleCollisions,
  extractObstacleCells,
  levelHasObstacles,
  type ObstacleCollisionReport,
} from "@/lib/assessment/obstacleAnalysis";
export {
  buildStudentProgramDisplay,
  classifyStepCommandMismatch,
  commandMismatchChipLabel,
  findFirstCommandMistakeStep,
  resolveFirstMistakeStep,
  type CommandChipLabel,
  type StepCommandMismatchKind,
  type StudentProgramDisplay,
} from "@/lib/assessment/program-diff-visual";
export {
  analyzePathBuilding,
  buildPathBuildingFromAttempt,
  type PathBuildingAnalysisResult,
  type PathMistakeType,
  type RouteQualityLevel,
} from "@/lib/assessment/pathBuildingAnalysis";
export {
  analyzeDebuggingTask,
  buildDebuggingFromAttempt,
  debuggingStrategyLabel,
  type DebuggingAnalysisResult,
  type DebuggingStrategy,
  type RepairStatus,
} from "@/lib/assessment/debuggingAnalysis";
export {
  analyzeEditStarterDebugging,
  buildWorkingFixOptions,
  generateExactRepairDiagnosis,
} from "@/lib/assessment/editStarterDebuggingAnalysis";
export {
  analyzeGoalRelationship,
  programStopsOnGoalStrict,
  resolveStrictGoalPosition,
} from "@/lib/assessment/routeAnalysis";
export {
  resolveAttemptProgram,
  resolveStarterProgram,
  parseLastSubmittedProgramFromHistory,
} from "@/lib/assessment/resolve-program";
export * from "@/lib/assessment/choiceActionAnalysis";
export {
  interpretSemanticIssue,
  semanticIssueChipLabel,
  defaultSemanticInterpretation,
  type SemanticInterpretation,
  type SemanticIssueType,
} from "@/lib/assessment/semanticInterpretation";
// Note: per-level CT construct weights (LevelCTConstruct) are no longer used for scoring.
