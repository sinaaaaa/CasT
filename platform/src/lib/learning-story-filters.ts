import { AttemptStatus, LevelType } from "@prisma/client";
import type { LevelGameplayConfig } from "@/lib/level-config";
import { isNumberLineLayout } from "@/lib/level-config";
import {
  isDebuggingLevel,
  isFlagPredictionLevel,
  isPathBuildingLevel,
} from "@/lib/assessment/assessmentConfig";

export type StoryTaskKey =
  | "number-line"
  | "debugging"
  | "path-building"
  | "prediction"
  | "choose-action"
  | "other";

export type StoryOutcomeKey = "correct" | "incorrect" | "incomplete";

export const STORY_TASK_LABELS: Record<StoryTaskKey, string> = {
  "number-line": "Number line",
  debugging: "Debugging",
  "path-building": "Path building",
  prediction: "Prediction",
  "choose-action": "Choose action",
  other: "Other",
};

export function resolveStoryTaskKey(
  level: { levelType: LevelType; config: unknown },
  stealth: { taskType?: string; teacherSummary?: unknown } | null | undefined
): StoryTaskKey {
  const config = (level.config ?? {}) as LevelGameplayConfig;
  const summary = stealth?.teacherSummary as
    | { taskEnvironmentType?: string; taskType?: string }
    | null
    | undefined;
  const env =
    summary?.taskEnvironmentType ??
    config.assessment?.taskEnvironmentType ??
    (isNumberLineLayout(config) ? "number-line" : "grid");

  if (env === "number-line") return "number-line";

  if (isDebuggingLevel(config, level.levelType)) return "debugging";
  if (isPathBuildingLevel(config, level.levelType)) return "path-building";
  if (isFlagPredictionLevel(config, level.levelType)) return "prediction";
  if (level.levelType === LevelType.CHOOSE_BUTTONS) return "choose-action";

  const taskType = stealth?.taskType ?? summary?.taskType ?? config.assessment?.taskType;
  if (taskType === "debugging") return "debugging";
  if (taskType === "prediction") return "prediction";

  return "other";
}

export function resolveStoryOutcomeKey(attempt: {
  passed: boolean;
  status: AttemptStatus;
}): StoryOutcomeKey {
  if (attempt.status === AttemptStatus.INCOMPLETE) return "incomplete";
  if (attempt.passed || attempt.status === AttemptStatus.CORRECT) return "correct";
  return "incorrect";
}
