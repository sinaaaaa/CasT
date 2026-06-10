import { prisma } from "@/lib/prisma";
import { masteryFromScore } from "@/lib/ct/constructs";

export type ConstructScoreRow = {
  constructId: string;
  slug: string;
  name: string;
  color: string;
  avgScore: number;
  masteryPercent: number;
  masteryLevel: string;
  attemptCount: number;
};

function aggregatePerformances(
  rows: { constructId: string; score: number; construct: { slug: string; name: string; color: string } }[]
): ConstructScoreRow[] {
  const map = new Map<
    string,
    { slug: string; name: string; color: string; total: number; count: number }
  >();
  for (const r of rows) {
    const cur = map.get(r.constructId) ?? {
      slug: r.construct.slug,
      name: r.construct.name,
      color: r.construct.color,
      total: 0,
      count: 0,
    };
    cur.total += r.score;
    cur.count += 1;
    map.set(r.constructId, cur);
  }
  return [...map.entries()].map(([constructId, v]) => {
    const avg = v.count > 0 ? Math.round(v.total / v.count) : 0;
    return {
      constructId,
      slug: v.slug,
      name: v.name,
      color: v.color,
      avgScore: avg,
      masteryPercent: avg,
      masteryLevel: masteryFromScore(avg),
      attemptCount: v.count,
    };
  });
}

export async function getStudentCTPerformance(studentId: string) {
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    include: { classMemberships: { include: { class: true } } },
  });
  if (!student) return null;

  const performances = await prisma.studentConstructPerformance.findMany({
    where: { studentId },
    include: { construct: true, attempt: { include: { level: true } } },
    orderBy: { analyzedAt: "asc" },
  });

  const byConstruct = aggregatePerformances(performances);
  const sorted = [...byConstruct].sort((a, b) => b.avgScore - a.avgScore);
  const strongest = sorted[0] ?? null;
  const weakest = sorted.length > 0 ? sorted[sorted.length - 1] : null;

  const progressOverTime = buildProgressSeries(performances);

  const levelIds = [...new Set(performances.map((p) => p.levelId))];
  const recommendedLevels = await prisma.level.findMany({
    where: {
      published: true,
      constructMappings: {
        some: {
          constructId: weakest ? { equals: weakest.constructId } : undefined,
        },
      },
    },
    orderBy: { orderIndex: "asc" },
    take: 5,
    select: { id: true, levelKey: true, name: true, orderIndex: true },
  });

  return {
    student: {
      id: student.id,
      displayName: student.displayName,
      externalId: student.externalId,
    },
    constructs: byConstruct,
    strongest,
    weakest,
    overallMastery:
      byConstruct.length > 0
        ? Math.round(byConstruct.reduce((s, c) => s + c.avgScore, 0) / byConstruct.length)
        : 0,
    progressOverTime,
    recentFeedback: performances.slice(-8).reverse().map((p) => ({
      constructName: p.construct.name,
      levelName: p.attempt.level.name,
      score: p.score,
      feedback: p.feedback,
      analyzedAt: p.analyzedAt,
    })),
    recommendedLevels: weakest ? recommendedLevels : [],
  };
}

export async function getClassCTPerformance(classId: string) {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    include: { students: { include: { student: true } } },
  });
  if (!cls) return null;

  const studentIds = cls.students.map((s) => s.studentId);
  const performances = await prisma.studentConstructPerformance.findMany({
    where: { studentId: { in: studentIds } },
    include: { construct: true },
  });

  const classByConstruct = aggregatePerformances(performances);

  const perStudent = studentIds.map((sid) => {
    const rows = performances.filter((p) => p.studentId === sid);
    const agg = aggregatePerformances(rows);
    const student = cls.students.find((s) => s.studentId === sid)?.student;
    return {
      studentId: sid,
      displayName: student?.displayName ?? "Student",
      overallMastery:
        agg.length > 0 ? Math.round(agg.reduce((s, c) => s + c.avgScore, 0) / agg.length) : 0,
      constructs: agg,
    };
  });

  return {
    class: { id: cls.id, name: cls.name },
    constructs: classByConstruct,
    students: perStudent.sort((a, b) => b.overallMastery - a.overallMastery),
  };
}

export async function getLevelCTReport(levelId: string, scopeClassIds?: string[] | null) {
  const level = await prisma.level.findUnique({
    where: { id: levelId },
    include: {
      constructMappings: { include: { construct: true }, orderBy: { weightPercent: "desc" } },
    },
  });
  if (!level) return null;

  let studentFilter: { studentId?: { in: string[] } } = {};
  if (scopeClassIds !== undefined) {
    if (scopeClassIds === null) {
      studentFilter = {};
    } else if (scopeClassIds.length === 0) {
      studentFilter = { studentId: { in: [] } };
    } else {
      const members = await prisma.classStudent.findMany({
        where: { classId: { in: scopeClassIds } },
        select: { studentId: true },
      });
      const ids = [...new Set(members.map((m) => m.studentId))];
      studentFilter = ids.length ? { studentId: { in: ids } } : { studentId: { in: [] } };
    }
  }

  const performances = await prisma.studentConstructPerformance.findMany({
    where: { levelId, ...studentFilter },
    include: { construct: true },
  });

  return {
    level: { id: level.id, name: level.name, levelKey: level.levelKey },
    mappings: level.constructMappings,
    constructs: aggregatePerformances(performances),
  };
}

export async function getTeacherCTOverview(scopeClassIds?: string[] | null) {
  let studentFilter: { studentId?: { in: string[] } } = {};
  if (scopeClassIds !== undefined) {
    if (scopeClassIds === null) {
      studentFilter = {};
    } else if (scopeClassIds.length === 0) {
      studentFilter = { studentId: { in: [] } };
    } else {
      const members = await prisma.classStudent.findMany({
        where: { classId: { in: scopeClassIds } },
        select: { studentId: true },
      });
      const ids = [...new Set(members.map((m) => m.studentId))];
      studentFilter = ids.length ? { studentId: { in: ids } } : { studentId: { in: [] } };
    }
  }

  const performances = await prisma.studentConstructPerformance.findMany({
    where: studentFilter,
    include: { construct: true },
  });
  const constructs = aggregatePerformances(performances);

  const classWhere =
    scopeClassIds === null
      ? {}
      : scopeClassIds?.length
        ? { id: { in: scopeClassIds } }
        : scopeClassIds !== undefined
          ? { id: { in: [] as string[] } }
          : {};

  const classes = await prisma.class.findMany({
    where: classWhere,
    include: { students: { include: { student: true } } },
  });
  const classSummaries = await Promise.all(
    classes.map(async (c) => {
      const data = await getClassCTPerformance(c.id);
      return {
        classId: c.id,
        className: c.name,
        overallMastery: data?.constructs.length
          ? Math.round(
              data.constructs.reduce((s, x) => s + x.avgScore, 0) / data.constructs.length
            )
          : 0,
        studentCount: c.students.length,
      };
    })
  );
  return { constructs, classSummaries };
}

function buildProgressSeries(
  performances: {
    analyzedAt: Date;
    score: number;
    construct: { name: string };
  }[]
) {
  const byWeek = new Map<string, { total: number; count: number; label: string }>();
  for (const p of performances) {
    const d = p.analyzedAt;
    const key = `${d.getFullYear()}-W${Math.ceil((d.getDate() + 1) / 7)}`;
    const cur = byWeek.get(key) ?? { total: 0, count: 0, label: d.toLocaleDateString() };
    cur.total += p.score;
    cur.count += 1;
    byWeek.set(key, cur);
  }
  return [...byWeek.entries()]
    .map(([, v]) => ({
      label: v.label,
      avgScore: v.count > 0 ? Math.round(v.total / v.count) : 0,
    }))
    .slice(-12);
}
