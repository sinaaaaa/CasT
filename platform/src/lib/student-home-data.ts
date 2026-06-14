import { prisma } from "@/lib/prisma";
import { getStudentProgress } from "@/lib/analytics";
import { getPlayableLevelsForStudent } from "@/lib/level-assignments";
import {
  levelGameplayConfigSchema,
  type LevelGameplayConfig,
} from "@/lib/level-config";
import {
  difficultyLabel,
  resolveLevelTaskLabel,
  resolvePlayStatus,
} from "@/lib/student-ui";
import { buildPlayableLevelProgress } from "@/lib/game-resume-level";
import { pickNextPlayableLevel } from "@/lib/resolve-next-playable-level";
import type { LevelType } from "@prisma/client";

function computeStreak(attemptDates: Date[]): number {
  if (attemptDates.length === 0) return 0;

  const dayKeys = new Set(
    attemptDates.map((d) => {
      const x = new Date(d);
      return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
    })
  );

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (dayKeys.has(key)) streak++;
    else if (i > 0) break;
  }
  return streak;
}

function computeStars(
  levels: { passed: boolean; score: number | null }[]
): number {
  return levels.reduce((sum, l) => {
    if (!l.passed) return sum;
    if (l.score == null) return sum + 2;
    if (l.score >= 90) return sum + 3;
    if (l.score >= 70) return sum + 2;
    return sum + 1;
  }, 0);
}

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

  const playableProgress = await buildPlayableLevelProgress(
    studentProfileId,
    playableLevels.map((level) => ({ id: level.id, levelKey: level.levelKey }))
  );
  const nextPlayable = pickNextPlayableLevel(playableProgress);

  const levels = playableLevels.map((level, index) => {
    const cfg = levelGameplayConfigSchema.safeParse(level.config);
    const layoutMode = cfg.success
      ? (cfg.data as LevelGameplayConfig).layoutMode
      : undefined;
    const prog = progressByLevelId.get(level.id);
    const attempts = prog?.attempts ?? 0;
    const passed = prog?.passed ?? false;

    return {
      id: level.id,
      levelKey: level.levelKey,
      name: level.name,
      orderIndex: level.orderIndex,
      levelNumber: index + 1,
      difficulty: level.difficulty,
      difficultyLabel: difficultyLabel(level.difficulty),
      levelType: level.levelType as LevelType,
      taskLabel: resolveLevelTaskLabel(level.levelType as LevelType, layoutMode),
      status: resolvePlayStatus(attempts, passed),
      attempts,
      score: prog?.score ?? null,
      passed,
    };
  });

  const passedLevels = levels.filter((l) => l.passed);
  const challengesSolved = passedLevels.length;

  const streak = computeStreak(
    recentAttempts.filter((a) => a.passed).map((a) => a.endedAt!)
  );

  const starsEarned = computeStars(
    progress.levels.map((l) => ({ passed: l.passed, score: l.score }))
  );

  const activity = recentAttempts.slice(0, 5).map((a) => ({
    id: a.id,
    levelName: a.level.name,
    passed: a.passed,
    score: a.score,
    endedAt: a.endedAt?.toISOString() ?? null,
  }));

  const nextLevel =
    nextPlayable != null
      ? levels.find((level) => level.id === nextPlayable.id) ?? null
      : null;

  return {
    stats: {
      levelsCompleted: challengesSolved,
      currentStreak: streak,
      starsEarned,
      challengesSolved,
      completionPercent: progress.summary.completionPercent,
    },
    levels,
    activity,
    nextLevel,
  };
}
