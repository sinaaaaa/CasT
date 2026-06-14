import { AttemptStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { formatItemDisplayName } from "@/lib/item-display";
import { formatAttemptRunLabel, parseAttemptRunMeta } from "@/lib/attempt-mistakes";
import { levelsForTeachersWhere, getClassTeacherProfileIds, levelScopeWhere, type TeacherScope } from "@/lib/class-access";
import { prisma } from "@/lib/prisma";
import { resolveAttemptDurationSeconds } from "@/lib/game/resolve-attempt-duration";
import type { RouteComparison } from "@/lib/assessment/assessmentTypes";
import {
  resolveStoryOutcomeKey,
  resolveStoryTaskKey,
  STORY_TASK_LABELS,
  type StoryOutcomeKey,
  type StoryTaskKey,
} from "@/lib/learning-story-filters";

export type { StoryOutcomeKey, StoryTaskKey } from "@/lib/learning-story-filters";

export type LearningStoryRoutePreview = {
  studentPath: { x: number; y: number }[];
  routeStartPosition: { x: number; y: number };
  routeGoalPosition: { x: number; y: number };
  collisionPoints: { x: number; y: number }[];
};

function routePreviewFromComparison(
  rc: RouteComparison | null | undefined
): LearningStoryRoutePreview | null {
  if (!rc?.studentPath || rc.studentPath.length < 2) return null;
  return {
    studentPath: rc.studentPath.map((p) => ({ x: p.x, y: p.y })),
    routeStartPosition: rc.routeStartPosition ?? rc.startPosition,
    routeGoalPosition: rc.routeGoalPosition ?? rc.endPosition,
    collisionPoints: (rc.collisionPoints ?? []).map((p) => ({ x: p.x, y: p.y })),
  };
}

/** Two or more of the last three finished attempts did not pass. */
export function studentNeedsCheckIn(
  attempts: { passed: boolean; endedAt: Date | null }[]
): boolean {
  const recent = attempts.slice(0, 3);
  return recent.filter((a) => !a.passed && a.endedAt).length >= 2;
}

function extractRoutePreview(
  stealth:
    | { routeAnalysis?: unknown; teacherSummary?: unknown }
    | null
    | undefined
): LearningStoryRoutePreview | null {
  if (!stealth) return null;
  const fromRoute = routePreviewFromComparison(
    stealth.routeAnalysis as RouteComparison | null | undefined
  );
  if (fromRoute) return fromRoute;
  const summary = stealth.teacherSummary as { routeComparison?: RouteComparison } | null;
  return routePreviewFromComparison(summary?.routeComparison ?? null);
}

export async function getTeacherDashboardStats(filters?: {
  classId?: string;
  levelId?: string;
  from?: Date;
  to?: Date;
  /** When set (non-null array), limit stats to students in these classes. Empty array = no students. */
  scopeClassIds?: string[] | null;
}) {
  let classStudentIds: string[] | undefined;
  if (filters?.classId) {
    const members = await prisma.classStudent.findMany({
      where: { classId: filters.classId },
      select: { studentId: true },
    });
    classStudentIds = members.map((m) => m.studentId);
  } else if (filters?.scopeClassIds != null) {
    if (filters.scopeClassIds.length === 0) {
      classStudentIds = [];
    } else {
      const members = await prisma.classStudent.findMany({
        where: { classId: { in: filters.scopeClassIds } },
        select: { studentId: true },
      });
      classStudentIds = [...new Set(members.map((m) => m.studentId))];
    }
  }

  const where = {
    ...(classStudentIds
      ? { studentId: { in: classStudentIds } }
      : filters?.classId
        ? { classId: filters.classId }
        : {}),
    ...(filters?.levelId ? { levelId: filters.levelId } : {}),
    ...(filters?.from || filters?.to
      ? {
          startedAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
  };

  const [studentCount, attempts, levels] = await Promise.all([
    classStudentIds !== undefined
      ? classStudentIds.length
      : prisma.studentProfile.count({ where: { isArchived: false } }),
    prisma.levelAttempt.findMany({
      where,
      include: { student: true, level: true, assessmentResult: true, stealthAssessment: true },
      orderBy: { startedAt: "desc" },
    }),
    prisma.level.count(),
  ]);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const todayAttempts = attempts.filter(
    (a) => a.startedAt >= startOfToday && a.startedAt < endOfToday
  );
  const todayStudentIds = new Set(todayAttempts.map((a) => a.studentId));

  const completed = attempts.filter((a) => a.endedAt != null);
  const passed = attempts.filter((a) => a.passed);
  const failed = attempts.filter(
    (a) => a.status === AttemptStatus.INCORRECT || (a.endedAt && !a.passed)
  );
  const avgScore =
    completed.length > 0
      ? completed.reduce((s, a) => s + (a.score ?? 0), 0) / completed.length
      : 0;
  const completedDurations = completed
    .map((a) =>
      resolveAttemptDurationSeconds({
        totalTimeSeconds: a.totalTimeSeconds,
        startedAt: a.startedAt,
        endedAt: a.endedAt,
      })
    )
    .filter((t): t is number => t != null);
  const avgTime =
    completedDurations.length > 0
      ? completedDurations.reduce((s, t) => s + t, 0) / completedDurations.length
      : 0;

  const studentAttemptMap = new Map<string, typeof attempts>();
  for (const a of attempts) {
    const list = studentAttemptMap.get(a.studentId) ?? [];
    list.push(a);
    studentAttemptMap.set(a.studentId, list);
  }

  const needsHelp = [...studentAttemptMap.values()].filter((list) =>
    studentNeedsCheckIn(list)
  ).length;

  const levelFailCounts = new Map<
    string,
    { name: string; orderIndex: number; count: number }
  >();
  for (const a of attempts) {
    if (!a.endedAt || a.passed) continue;
    const key = a.levelId;
    const cur = levelFailCounts.get(key) ?? {
      name: a.level.name,
      orderIndex: a.level.orderIndex,
      count: 0,
    };
    cur.count += 1;
    levelFailCounts.set(key, cur);
  }
  const mostLevelFailRaw =
    [...levelFailCounts.values()].sort((a, b) => b.count - a.count || a.orderIndex - b.orderIndex)[0]
      ?.name ?? null;
  const mostLevelFail = mostLevelFailRaw ? formatItemDisplayName(mostLevelFailRaw) : null;

  const statusCounts = {
    correct: attempts.filter((a) => a.status === AttemptStatus.CORRECT).length,
    incorrect: attempts.filter((a) => a.status === AttemptStatus.INCORRECT).length,
    incomplete: attempts.filter((a) => a.status === AttemptStatus.INCOMPLETE).length,
  };

  const timeByLevel = new Map<
    string,
    { name: string; orderIndex: number; total: number; count: number }
  >();
  for (const a of completed) {
    const key = a.levelId;
    const cur = timeByLevel.get(key) ?? {
      name: a.level.name,
      orderIndex: a.level.orderIndex,
      total: 0,
      count: 0,
    };
    cur.total += a.totalTimeSeconds ?? 0;
    cur.count += 1;
    timeByLevel.set(key, cur);
  }

  const thinkingCounts = new Map<string, number>();
  for (const a of completed) {
    const summary = a.stealthAssessment?.teacherSummary as
      | { behaviors?: unknown; recommendations?: unknown }
      | null
      | undefined;
    const behaviors = Array.isArray(summary?.behaviors)
      ? summary?.behaviors.filter((x): x is string => typeof x === "string")
      : [];
    for (const b of behaviors) {
      const key = b.trim();
      if (!key) continue;
      thinkingCounts.set(key, (thinkingCounts.get(key) ?? 0) + 1);
    }
  }

  const topThinkingPatterns = [...thinkingCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const learningStories = attempts.slice(0, 12).map((a) => {
    const summary = a.stealthAssessment?.teacherSummary as
      | { interpretations?: unknown; recommendations?: unknown; behaviors?: unknown }
      | null
      | undefined;
    const interpretations = Array.isArray(summary?.interpretations)
      ? summary?.interpretations.filter((x): x is string => typeof x === "string")
      : [];
    const recommendations = Array.isArray(summary?.recommendations)
      ? summary?.recommendations.filter((x): x is string => typeof x === "string")
      : [];
    const behaviors = Array.isArray(summary?.behaviors)
      ? summary?.behaviors.filter((x): x is string => typeof x === "string")
      : [];

    const headline =
      interpretations[0]?.trim() ||
      (a.passed
        ? "Robot reached the goal."
        : a.endedAt
          ? "Robot didn’t finish on the goal."
          : "Attempt started but not finished yet.");

    const understood = behaviors
      .filter((b) => /stopped on|avoided|built a working path|fixed/i.test(b))
      .slice(0, 2);

    const difficulty =
      behaviors.find((b) => /passed|stopped before|hit obstacle|wrong/i.test(b)) ??
      a.assessmentResult?.mistakePattern ??
      null;

    const taskKey = resolveStoryTaskKey(a.level, a.stealthAssessment);
    const outcomeKey = resolveStoryOutcomeKey(a);

    return {
      id: a.id,
      student: a.student.displayName,
      level: formatItemDisplayName(a.level.name),
      passed: a.passed,
      status: a.status,
      startedAt: a.startedAt,
      totalTimeSeconds: a.totalTimeSeconds,
      headline,
      difficulty,
      understood,
      nextStep: recommendations[0]?.trim() ?? null,
      behaviors,
      routePreview: extractRoutePreview(a.stealthAssessment),
      taskKey,
      taskLabel: STORY_TASK_LABELS[taskKey],
      outcomeKey,
    };
  });

  const levelDifficulty = await prisma.level.findMany({
    orderBy: { orderIndex: "asc" },
    include: {
      attempts: {
        where,
        select: { passed: true, score: true },
      },
    },
  });

  return {
    studentCount,
    levelCount: levels,
    totalAttempts: attempts.length,
    completedLevels: passed.length,
    failedLevels: failed.length,
    avgScore: Math.round(avgScore),
    avgTimeSeconds: Math.round(avgTime),
    needsHelp,
    classSnapshot: {
      activeStudentsToday: todayStudentIds.size,
      attemptsToday: todayAttempts.length,
      mostLevelFail,
      needsSupport: needsHelp,
    },
    thinkingPatterns: topThinkingPatterns,
    learningStories,
    statusCounts,
    timeByLevel: [...timeByLevel.values()]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((v) => ({
        level: formatItemDisplayName(v.name),
        avgSeconds: v.count ? Math.round(v.total / v.count) : 0,
      })),
    levelDifficulty: levelDifficulty.map((l) => {
      const passRate =
        l.attempts.length > 0
          ? Math.round((l.attempts.filter((a) => a.passed).length / l.attempts.length) * 100)
          : 0;
      const avg =
        l.attempts.length > 0
          ? Math.round(l.attempts.reduce((s, a) => s + (a.score ?? 0), 0) / l.attempts.length)
          : 0;
      return {
        level: formatItemDisplayName(l.name),
        passRate,
        avgScore: avg,
        difficulty: l.difficulty,
      };
    }),
    recentAttempts: attempts.slice(0, 15).map((a) => ({
      id: a.id,
      student: a.student.displayName,
      studentExportId: a.student.externalId?.trim() || a.studentId,
      level: formatItemDisplayName(a.level.name),
      status: a.status,
      passed: a.passed,
      score: a.score,
      startedAt: a.startedAt,
      totalTimeSeconds: a.totalTimeSeconds,
    })),
  };
}

export async function getStudentProgress(studentProfileId: string) {
  const levels = await prisma.level.findMany({ orderBy: { orderIndex: "asc" } });
  const attempts = await prisma.levelAttempt.findMany({
    where: { studentId: studentProfileId },
    include: { level: true, assessmentResult: true },
    orderBy: { startedAt: "desc" },
  });

  const byLevel = new Map<string, (typeof attempts)[number][]>();
  for (const a of attempts) {
    const list = byLevel.get(a.levelId) ?? [];
    list.push(a);
    byLevel.set(a.levelId, list);
  }

  const levelProgress = levels.map((level) => {
    const levelAttempts = byLevel.get(level.id) ?? [];
    const endedAttempts = levelAttempts.filter((a) => a.endedAt != null);
    const statusAttempts = endedAttempts.length > 0 ? endedAttempts : levelAttempts;
    const best = statusAttempts.find((a) => a.passed) ?? statusAttempts[0];
    const levelPassed = levelAttempts.some((a) => a.passed);
    return {
      levelId: level.id,
      levelKey: level.levelKey,
      name: formatItemDisplayName(level.name),
      orderIndex: level.orderIndex,
      attempts: levelAttempts.length,
      status: levelPassed
        ? AttemptStatus.CORRECT
        : (best?.status ?? AttemptStatus.INCOMPLETE),
      passed: levelPassed,
      score: best?.score ?? null,
      totalTimeSeconds: best?.totalTimeSeconds ?? null,
      feedback: best?.feedback ?? null,
      finalCommand: best?.finalCommand ?? null,
      lastAttemptAt: levelAttempts[0]?.startedAt ?? null,
    };
  });

  const passed = levelProgress.filter((l) => l.passed).length;
  const failed = levelProgress.filter(
    (l) => l.attempts > 0 && !l.passed && l.status === AttemptStatus.INCORRECT
  ).length;

  return {
    summary: {
      totalLevels: levels.length,
      passed,
      failed,
      incomplete: levels.length - passed - failed,
      completionPercent: levels.length ? Math.round((passed / levels.length) * 100) : 0,
    },
    levels: levelProgress,
    history: attempts.map((a) => ({
      id: a.id,
      level: formatItemDisplayName(a.level.name),
      levelKey: a.level.levelKey,
      levelId: a.levelId,
      attemptNumber: a.attemptNumber,
      status: a.status,
      passed: a.passed,
      score: a.score,
      startedAt: a.startedAt,
      endedAt: a.endedAt,
      totalTimeSeconds: a.totalTimeSeconds,
    })),
  };
}

export type ClassItemProgress = {
  levelId: string;
  levelKey: string;
  name: string;
  orderIndex: number;
  studentsPassed: number;
  studentsFailed: number;
  studentsIncomplete: number;
  passRate: number;
  totalAttempts: number;
  avgScore: number | null;
  avgTimeSeconds: number | null;
};

export type ClassStudentProgressRow = {
  studentId: string;
  externalId: string | null;
  displayName: string;
  passed: number;
  failed: number;
  incomplete: number;
  completionPercent: number;
};

export type ClassStudentItemCell = {
  studentId: string;
  externalId: string | null;
  studentName: string;
  levelId: string;
  itemName: string;
  orderIndex: number;
  status: "Passed" | "Failed" | "Not started";
  attempts: number;
  score: number | null;
};

export type ClassProgressReport = {
  class: { id: string; name: string; code: string };
  studentCount: number;
  summary: {
    totalItems: number;
    passed: number;
    failed: number;
    incomplete: number;
    completionPercent: number;
    totalAttempts: number;
    passedAttempts: number;
    failedAttempts: number;
  };
  items: ClassItemProgress[];
  students: ClassStudentProgressRow[];
  cells: ClassStudentItemCell[];
};

function summarizeStudentLevelAttempts(
  levelAttempts: { passed: boolean; status: AttemptStatus; endedAt: Date | null }[]
): { passed: boolean; failed: boolean; incomplete: boolean } {
  if (levelAttempts.length === 0) {
    return { passed: false, failed: false, incomplete: true };
  }
  const passed = levelAttempts.some((a) => a.passed);
  if (passed) {
    return { passed: true, failed: false, incomplete: false };
  }
  const ended = levelAttempts.filter((a) => a.endedAt != null);
  const best = (ended.length > 0 ? ended : levelAttempts)[0];
  const failed = best?.status === AttemptStatus.INCORRECT;
  return { passed: false, failed, incomplete: !failed };
}

/** Aggregate pass/fail per item and per student for one class (mirrors student profile report). */
export async function getClassProgress(classId: string): Promise<ClassProgressReport | null> {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: {
      id: true,
      name: true,
      code: true,
      students: {
        select: {
          student: { select: { id: true, displayName: true, externalId: true } },
        },
      },
    },
  });
  if (!cls) return null;

  const students = cls.students.map((m) => m.student);
  const studentIds = students.map((s) => s.id);
  const studentCount = students.length;

  const levels = await prisma.level.findMany({
    where: {
      isArchived: false,
      ...levelsForTeachersWhere(await getClassTeacherProfileIds(classId)),
    },
    orderBy: { orderIndex: "asc" },
  });

  const attempts =
    studentIds.length > 0
      ? await prisma.levelAttempt.findMany({
          where: { studentId: { in: studentIds } },
          include: { level: true },
          orderBy: { startedAt: "desc" },
        })
      : [];

  const attemptsByStudentLevel = new Map<string, typeof attempts>();
  for (const a of attempts) {
    const key = `${a.studentId}:${a.levelId}`;
    const list = attemptsByStudentLevel.get(key) ?? [];
    list.push(a);
    attemptsByStudentLevel.set(key, list);
  }

  let aggregatePassed = 0;
  let aggregateFailed = 0;
  let aggregateIncomplete = 0;

  const studentRows: ClassStudentProgressRow[] = students.map((student) => {
    let passed = 0;
    let failed = 0;
    let incomplete = 0;

    for (const level of levels) {
      const levelAttempts = attemptsByStudentLevel.get(`${student.id}:${level.id}`) ?? [];
      const outcome = summarizeStudentLevelAttempts(levelAttempts);
      if (outcome.passed) passed += 1;
      else if (outcome.failed) failed += 1;
      else incomplete += 1;
    }

    aggregatePassed += passed;
    aggregateFailed += failed;
    aggregateIncomplete += incomplete;

    const totalItems = levels.length;
    return {
      studentId: student.id,
      externalId: student.externalId,
      displayName: student.displayName,
      passed,
      failed,
      incomplete,
      completionPercent: totalItems ? Math.round((passed / totalItems) * 100) : 0,
    };
  });

  const items: ClassItemProgress[] = levels.map((level) => {
    let studentsPassed = 0;
    let studentsFailed = 0;
    let studentsIncomplete = 0;
    let totalAttempts = 0;
    let scoreSum = 0;
    let scoreCount = 0;
    let timeSum = 0;
    let timeCount = 0;

    for (const student of students) {
      const levelAttempts = attemptsByStudentLevel.get(`${student.id}:${level.id}`) ?? [];
      totalAttempts += levelAttempts.length;
      const outcome = summarizeStudentLevelAttempts(levelAttempts);
      if (outcome.passed) studentsPassed += 1;
      else if (outcome.failed) studentsFailed += 1;
      else studentsIncomplete += 1;

      for (const a of levelAttempts) {
        if (a.score != null) {
          scoreSum += a.score;
          scoreCount += 1;
        }
        if (a.totalTimeSeconds != null) {
          timeSum += a.totalTimeSeconds;
          timeCount += 1;
        }
      }
    }

    return {
      levelId: level.id,
      levelKey: level.levelKey,
      name: formatItemDisplayName(level.name),
      orderIndex: level.orderIndex,
      studentsPassed,
      studentsFailed,
      studentsIncomplete,
      passRate: studentCount ? Math.round((studentsPassed / studentCount) * 100) : 0,
      totalAttempts,
      avgScore: scoreCount ? Math.round(scoreSum / scoreCount) : null,
      avgTimeSeconds: timeCount ? Math.round(timeSum / timeCount) : null,
    };
  });

  const totalCells = studentCount * levels.length;
  const passedAttempts = attempts.filter((a) => a.passed).length;
  const failedAttempts = attempts.filter(
    (a) => a.status === AttemptStatus.INCORRECT || (a.endedAt && !a.passed)
  ).length;

  const cells: ClassStudentItemCell[] = [];
  for (const student of students) {
    for (const level of levels) {
      const levelAttempts = attemptsByStudentLevel.get(`${student.id}:${level.id}`) ?? [];
      const outcome = summarizeStudentLevelAttempts(levelAttempts);
      const status: ClassStudentItemCell["status"] = outcome.passed
        ? "Passed"
        : outcome.failed
          ? "Failed"
          : "Not started";
      const best = levelAttempts.find((a) => a.passed) ?? levelAttempts[0];
      cells.push({
        studentId: student.id,
        externalId: student.externalId,
        studentName: student.displayName,
        levelId: level.id,
        itemName: formatItemDisplayName(level.name),
        orderIndex: level.orderIndex,
        status,
        attempts: levelAttempts.length,
        score: best?.score ?? null,
      });
    }
  }

  return {
    class: { id: cls.id, name: cls.name, code: cls.code },
    studentCount,
    summary: {
      totalItems: levels.length,
      passed: aggregatePassed,
      failed: aggregateFailed,
      incomplete: aggregateIncomplete,
      completionPercent: totalCells ? Math.round((aggregatePassed / totalCells) * 100) : 0,
      totalAttempts: attempts.length,
      passedAttempts,
      failedAttempts,
    },
    items,
    students: studentRows.sort((a, b) => a.displayName.localeCompare(b.displayName)),
    cells,
  };
}

export async function getAllClassesProgress(
  classIds?: string[] | null
): Promise<ClassProgressReport[]> {
  const where =
    classIds == null
      ? {}
      : classIds.length === 0
        ? { id: { in: [] as string[] } }
        : { id: { in: classIds } };
  const classes = await prisma.class.findMany({
    where,
    orderBy: { name: "asc" },
    select: { id: true },
  });
  const reports = await Promise.all(classes.map((c) => getClassProgress(c.id)));
  return reports.filter((r): r is ClassProgressReport => r != null);
}

export type ItemAttemptExportRow = {
  attemptId: string;
  studentId: string;
  studentName: string;
  externalId: string | null;
  attemptNumber: number;
  inLevelRunNumber: number | null;
  maxLevelRuns: number | null;
  attemptLabel: string;
  status: AttemptStatus;
  passed: boolean;
  score: number | null;
  totalTimeSeconds: number | null;
  startedAt: Date;
  endedAt: Date | null;
  finalCommand: string | null;
  resetCount: number;
  robotTouched: boolean;
  robotTouchCount: number;
};

export type ItemStudentSummaryRow = {
  studentId: string;
  studentName: string;
  externalId: string | null;
  status: string;
  attempts: number;
  bestScore: number | null;
  totalTimeSeconds: number | null;
};

export type ItemProgressReport = {
  item: {
    id: string;
    levelKey: string;
    name: string;
    orderIndex: number;
    difficulty: number;
    levelType: string;
    published: boolean;
  };
  summary: {
    totalAttempts: number;
    passedAttempts: number;
    failedAttempts: number;
    incompleteAttempts: number;
    passRate: number;
    avgScore: number | null;
    uniqueStudents: number;
    studentsPassed: number;
    studentsFailed: number;
    studentsNotStarted: number;
    avgTimeSeconds: number | null;
  };
  students: ItemStudentSummaryRow[];
  attempts: ItemAttemptExportRow[];
};

export async function getItemProgressReport(
  levelId: string,
  filters?: { classId?: string; studentIds?: string[]; scopeClassIds?: string[] | null }
): Promise<ItemProgressReport | null> {
  const level = await prisma.level.findFirst({
    where: { OR: [{ id: levelId }, { levelKey: levelId }] },
  });
  if (!level) return null;

  let studentFilterIds = filters?.studentIds;
  if (filters?.classId) {
    const members = await prisma.classStudent.findMany({
      where: { classId: filters.classId },
      select: { studentId: true },
    });
    studentFilterIds = members.map((m) => m.studentId);
  } else if (filters?.scopeClassIds != null) {
    if (filters.scopeClassIds.length === 0) {
      studentFilterIds = [];
    } else {
      const members = await prisma.classStudent.findMany({
        where: { classId: { in: filters.scopeClassIds } },
        select: { studentId: true },
      });
      studentFilterIds = [...new Set(members.map((m) => m.studentId))];
    }
  }

  const attempts = await prisma.levelAttempt.findMany({
    where: {
      levelId: level.id,
      ...(studentFilterIds !== undefined
        ? studentFilterIds.length
          ? { studentId: { in: studentFilterIds } }
          : { studentId: { in: [] as string[] } }
        : {}),
    },
    include: {
      student: { select: { id: true, displayName: true, externalId: true } },
    },
    orderBy: { startedAt: "desc" },
  });

  const studentsInScope =
    studentFilterIds !== undefined
      ? await prisma.studentProfile.findMany({
          where: {
            isArchived: false,
            ...(studentFilterIds.length ? { id: { in: studentFilterIds } } : { id: { in: [] as string[] } }),
          },
          orderBy: { displayName: "asc" },
        })
      : await prisma.studentProfile.findMany({
          where: {
            isArchived: false,
            ...(attempts.length > 0
              ? { id: { in: [...new Set(attempts.map((a) => a.studentId))] } }
              : {}),
          },
          orderBy: { displayName: "asc" },
        });

  const attemptsByStudent = new Map<string, typeof attempts>();
  for (const a of attempts) {
    const list = attemptsByStudent.get(a.studentId) ?? [];
    list.push(a);
    attemptsByStudent.set(a.studentId, list);
  }

  const studentRows: ItemStudentSummaryRow[] = studentsInScope.map((student) => {
    const studentAttempts = attemptsByStudent.get(student.id) ?? [];
    const outcome = summarizeStudentLevelAttempts(studentAttempts);
    const status: string = outcome.passed
      ? "Passed"
      : outcome.failed
        ? "Failed"
        : studentAttempts.length > 0
          ? "In progress"
          : "Not started";
    const best = studentAttempts.find((a) => a.passed) ?? studentAttempts[0];
    const tryCount = studentAttempts.length;
    const statusWithTries =
      tryCount > 1 ? `${status} (${tryCount} tries)` : status;
    return {
      studentId: student.id,
      studentName: student.displayName,
      externalId: student.externalId,
      status: statusWithTries,
      attempts: studentAttempts.length,
      bestScore: best?.score ?? null,
      totalTimeSeconds: best?.totalTimeSeconds ?? null,
    };
  });

  const passedAttempts = attempts.filter((a) => a.passed).length;
  const failedAttempts = attempts.filter((a) => a.status === AttemptStatus.INCORRECT).length;
  const incompleteAttempts = attempts.filter((a) => a.status === AttemptStatus.INCOMPLETE).length;
  const scored = attempts.filter((a) => a.score != null);
  const timed = attempts
    .map((a) => ({
      attempt: a,
      duration: resolveAttemptDurationSeconds({
        totalTimeSeconds: a.totalTimeSeconds,
        startedAt: a.startedAt,
        endedAt: a.endedAt,
      }),
    }))
    .filter((row): row is { attempt: (typeof attempts)[number]; duration: number } =>
      row.duration != null
    );
  const avgScore =
    scored.length > 0
      ? Math.round(scored.reduce((s, a) => s + (a.score ?? 0), 0) / scored.length)
      : null;
  const avgTimeSeconds =
    timed.length > 0
      ? Math.round(timed.reduce((s, row) => s + row.duration, 0) / timed.length)
      : null;

  return {
    item: {
      id: level.id,
      levelKey: level.levelKey,
      name: formatItemDisplayName(level.name),
      orderIndex: level.orderIndex,
      difficulty: level.difficulty,
      levelType: level.levelType,
      published: level.published,
    },
    summary: {
      totalAttempts: attempts.length,
      passedAttempts,
      failedAttempts,
      incompleteAttempts,
      passRate: attempts.length ? Math.round((passedAttempts / attempts.length) * 100) : 0,
      avgScore,
      uniqueStudents: new Set(attempts.map((a) => a.studentId)).size,
      studentsPassed: studentRows.filter((s) => s.status.startsWith("Passed")).length,
      studentsFailed: studentRows.filter((s) => s.status.startsWith("Failed")).length,
      studentsNotStarted: studentRows.filter((s) => s.status === "Not started").length,
      avgTimeSeconds,
    },
    students: studentRows,
    attempts: attempts.map((a) => {
      const runMeta = parseAttemptRunMeta(a.mistakes);
      return {
        attemptId: a.id,
        studentId: a.studentId,
        studentName: a.student.displayName,
        externalId: a.student.externalId,
        attemptNumber: a.attemptNumber,
        inLevelRunNumber: runMeta.inLevelRunNumber,
        maxLevelRuns: runMeta.maxLevelRuns,
        attemptLabel: formatAttemptRunLabel(a.attemptNumber, runMeta),
        status: a.status,
        passed: a.passed,
        score: a.score,
        totalTimeSeconds: a.totalTimeSeconds,
        startedAt: a.startedAt,
        endedAt: a.endedAt,
        finalCommand: a.finalCommand,
        resetCount: a.resetCount,
        robotTouched: a.robotTouched,
        robotTouchCount: a.robotTouchCount,
      };
    }),
  };
}

export type AllItemsSummaryRow = {
  levelId: string;
  levelKey: string;
  name: string;
  orderIndex: number;
  difficulty: number;
  published: boolean;
  totalAttempts: number;
  passedAttempts: number;
  failedAttempts: number;
  passRate: number;
  avgScore: number | null;
  avgTimeSeconds: number | null;
  uniqueStudents: number;
};

/** One row per item — for items hub / analytics Excel export. */
export async function getAllItemsProgressSummary(
  scope?: TeacherScope | null
): Promise<AllItemsSummaryRow[]> {
  let scopedStudentIds: string[] | null | undefined;
  if (scope !== undefined && scope !== null) {
    if (scope.classIds === null) {
      scopedStudentIds = null;
    } else if (scope.classIds.length === 0) {
      scopedStudentIds = [];
    } else {
      const members = await prisma.classStudent.findMany({
        where: { classId: { in: scope.classIds } },
        select: { studentId: true },
      });
      scopedStudentIds = [...new Set(members.map((m) => m.studentId))];
    }
  }

  const attemptWhere =
    scopedStudentIds === undefined
      ? {}
      : scopedStudentIds === null
        ? {}
        : scopedStudentIds.length > 0
          ? { studentId: { in: scopedStudentIds } }
          : { studentId: { in: [] as string[] } };

  const levelWhere: Prisma.LevelWhereInput = { isArchived: false };
  if (scope !== undefined && scope !== null && !scope.isAdmin) {
    Object.assign(levelWhere, levelScopeWhere(scope));
  } else if (scope !== null && scope !== undefined && scope.classIds?.length === 0) {
    levelWhere.id = { in: [] };
  }

  const levels = await prisma.level.findMany({
    where: levelWhere,
    orderBy: { orderIndex: "asc" },
    include: {
      attempts: {
        where: attemptWhere,
        select: {
          passed: true,
          status: true,
          score: true,
          totalTimeSeconds: true,
          studentId: true,
        },
      },
    },
  });

  return levels.map((level) => {
    const attempts = level.attempts;
    const passedAttempts = attempts.filter((a) => a.passed).length;
    const failedAttempts = attempts.filter((a) => a.status === AttemptStatus.INCORRECT).length;
    const scored = attempts.filter((a) => a.score != null);
    const timed = attempts.filter((a) => a.totalTimeSeconds != null);
    return {
      levelId: level.id,
      levelKey: level.levelKey,
      name: formatItemDisplayName(level.name),
      orderIndex: level.orderIndex,
      difficulty: level.difficulty,
      published: level.published,
      totalAttempts: attempts.length,
      passedAttempts,
      failedAttempts,
      passRate: attempts.length ? Math.round((passedAttempts / attempts.length) * 100) : 0,
      avgScore:
        scored.length > 0
          ? Math.round(scored.reduce((s, a) => s + (a.score ?? 0), 0) / scored.length)
          : null,
      avgTimeSeconds:
        timed.length > 0
          ? Math.round(timed.reduce((s, a) => s + (a.totalTimeSeconds ?? 0), 0) / timed.length)
          : null,
      uniqueStudents: new Set(attempts.map((a) => a.studentId)).size,
    };
  });
}

