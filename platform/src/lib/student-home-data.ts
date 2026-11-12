import { prisma } from "@/lib/prisma";
import { getStudentProgress } from "@/lib/analytics";
import { getPlayableLevelsForStudent } from "@/lib/level-assignments";
import {
  levelGameplayConfigSchema,
  type LevelGameplayConfig,
} from "@/lib/level-config";
import { classroomItemName, studentItemNumber } from "@/lib/item-name";
import {
  difficultyLabel,
  resolveLevelTaskLabel,
  resolvePlayStatus,
} from "@/lib/student-ui";
import { resolveGameResumeLevel } from "@/lib/game-resume-level";
import { getStudentReplayLevelIds } from "@/lib/level-student-replay";
import type { LevelType } from "@prisma/client";

export async function getStudentHomeData(studentProfileId: string, studentCode: string) {
  const [progress, playableLevels, recentAttempts] = await Promise.all([
    getStudentProgress(studentProfileId),
    getPlayableLevelsForStudent(studentCode),
    prisma.levelAttempt.findMany({
      where: { studentId: studentProfileId, endedAt: { not: null } },
      orderBy: { endedAt: "desc" },
      take: 8,
      include: { level: true },
    }),
  ]);

  const progressByLevelId = new Map(progress.levels.map((l) => [l.levelId, l]));

  const playableRefs = playableLevels.map((level) => ({
    id: level.id,
    levelKey: level.levelKey,
    config: level.config,
  }));
  const [resume, replayLevelIds] = await Promise.all([
    resolveGameResumeLevel(studentProfileId, playableRefs).catch((e) => {
      console.warn("[student-home] resume resolve failed:", e);
      return null;
    }),
    getStudentReplayLevelIds(studentProfileId),
  ]);

  const levels = playableLevels.map((level, index) => {
    const cfg = levelGameplayConfigSchema.safeParse(level.config);
    const layoutMode = cfg.success
      ? (cfg.data as LevelGameplayConfig).layoutMode
      : undefined;
    const prog = progressByLevelId.get(level.id);
    const attempts = prog?.attempts ?? 0;
    const passed = prog?.passed ?? false;
    const queuedForReplay = replayLevelIds.has(level.id);
    const taskLabel = resolveLevelTaskLabel(level.levelType as LevelType, layoutMode, {
      geometryTask: cfg.success ? cfg.data.geometryPath?.studentTask : undefined,
    });
    const displayName = classroomItemName(level.name, index + 1, taskLabel);

    return {
      id: level.id,
      levelKey: level.levelKey,
      name: displayName,
      orderIndex: level.orderIndex,
      levelNumber: studentItemNumber(displayName, index + 1),
      difficulty: level.difficulty,
      difficultyLabel: difficultyLabel(level.difficulty),
      levelType: level.levelType as LevelType,
      taskLabel,
      status: resolvePlayStatus(attempts, passed && !queuedForReplay),
      attempts,
      score: prog?.score ?? null,
      passed,
      queuedForReplay,
    };
  });

  const passedLevels = levels.filter((l) => l.passed);

  const activity = recentAttempts.slice(0, 5).map((a) => ({
    id: a.id,
    levelName: levels.find((level) => level.id === a.levelId)?.name ?? classroomItemName(a.level.name, 1),
    passed: a.passed,
    score: a.score,
    endedAt: a.endedAt?.toISOString() ?? null,
  }));

  const nextLevel =
    resume != null
      ? levels.find((level) => level.levelKey === resume.resumeLevelKey) ?? null
      : null;

  return {
    stats: {
      levelsCompleted: passedLevels.length,
      totalLevels: levels.length,
      remainingLevels: Math.max(0, levels.length - passedLevels.length),
      completionPercent: progress.summary.completionPercent,
    },
    levels,
    activity,
    nextLevel,
  };
}
