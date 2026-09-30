import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  assertLevelReadAccess,
  getScopedStudentIds,
  resolveTeacherScope,
} from "@/lib/class-access";
import { prisma } from "@/lib/prisma";
import { formatDuration, formatPercent } from "@/lib/utils";
import { TeacherShell } from "@/components/teacher/teacher-shell";
import {
  LevelDetailTabs,
  type LevelDetailPayload,
} from "@/components/teacher/level-detail-tabs";
import { type LevelAttemptRow } from "@/components/assessment/level-attempts-table";
import { LEVEL_TYPE_LABELS, levelGameplayConfigSchema } from "@/lib/level-config";
import { AttemptStatus } from "@prisma/client";
import { formatAttemptRunLabel, parseAttemptRunMeta } from "@/lib/attempt-mistakes";
import { resolveAttemptDurationSeconds } from "@/lib/game/resolve-attempt-duration";
import { buildGeometryPathAnalysisFromAttempt } from "@/lib/assessment/geometryPathAnalysis";
import { isGeometryPathLevel } from "@/lib/assessment/assessmentConfig";
import { buildProgramStructureAnalysis } from "@/lib/assessment/programStructureAnalysis";

async function LevelDetailContent({ id }: { id: string }) {
  const session = await getServerSession(authOptions);
  const scope = await resolveTeacherScope(session!.user);
  const scopedStudentIds = await getScopedStudentIds(scope);

  const level = await prisma.level.findFirst({
    where: { OR: [{ id }, { levelKey: id }] },
  });
  if (!level) notFound();
  if (!assertLevelReadAccess(scope, level)) notFound();

  const attempts = await prisma.levelAttempt.findMany({
    where: {
      levelId: level.id,
      ...(scopedStudentIds === null
        ? {}
        : scopedStudentIds.length
          ? { studentId: { in: scopedStudentIds } }
          : { studentId: { in: [] as string[] } }),
    },
    include: { student: true },
    orderBy: { startedAt: "desc" },
  });

  const passed = attempts.filter((a) => a.passed).length;
  const passRate = attempts.length > 0 ? Math.round((passed / attempts.length) * 100) : 0;
  const scored = attempts.filter((a) => a.score != null);
  const avgScore =
    scored.length > 0
      ? Math.round(scored.reduce((s, a) => s + (a.score ?? 0), 0) / scored.length)
      : null;
  const timedAttempts = attempts
    .map((a) =>
      resolveAttemptDurationSeconds({
        totalTimeSeconds: a.totalTimeSeconds,
        startedAt: a.startedAt,
        endedAt: a.endedAt,
      })
    )
    .filter((t): t is number => t != null);
  const avgTime =
    timedAttempts.length > 0
      ? timedAttempts.reduce((s, t) => s + t, 0) / timedAttempts.length
      : 0;

  const chartData = [
    { name: "Correct", value: attempts.filter((a) => a.status === AttemptStatus.CORRECT || a.passed).length },
    { name: "Incorrect", value: attempts.filter((a) => a.status === AttemptStatus.INCORRECT).length },
    { name: "Incomplete", value: attempts.filter((a) => a.status === AttemptStatus.INCOMPLETE).length },
  ];

  const rows: LevelAttemptRow[] = attempts.map((a) => {
    const runMeta = parseAttemptRunMeta(a.mistakes);
    return {
      id: a.id,
      studentId: a.studentId,
      studentName: a.student.displayName,
      attemptNumber: a.attemptNumber,
      inLevelRunNumber: runMeta.inLevelRunNumber,
      maxLevelRuns: runMeta.maxLevelRuns,
      attemptLabel: formatAttemptRunLabel(a.attemptNumber, runMeta),
      status: a.status,
      passed: a.passed,
      score: a.score,
      totalTimeSeconds: resolveAttemptDurationSeconds({
        totalTimeSeconds: a.totalTimeSeconds,
        startedAt: a.startedAt,
        endedAt: a.endedAt,
      }),
      robotTouched: a.robotTouched,
      robotTouchCount: a.robotTouchCount,
      startedAt: a.startedAt.toISOString(),
    };
  });

  const parsedConfig = levelGameplayConfigSchema.safeParse(level.config);
  const endedAttempts = attempts.filter((a) => a.endedAt != null);
  const structures = parsedConfig.success
    ? endedAttempts.map((a) => ({
        passed: a.passed,
        ps: buildProgramStructureAnalysis({
          config: parsedConfig.data,
          levelType: level.levelType,
          mistakes: a.mistakes,
          finalCommand: a.finalCommand,
          passed: a.passed,
        }),
      }))
    : [];
  const macroRuns = structures.filter((s) => s.ps.usesMacros && s.ps.source === "unity" && s.ps.final.length > 0);
  const pctOf = (count: number, total: number) => (total > 0 ? Math.round((count / total) * 100) : null);

  let programStructureMetrics: LevelDetailPayload["programStructureMetrics"] = null;
  if (structures[0]?.ps.available) {
    const sample = structures[0].ps;
    const starterRuns = structures.filter((s) => s.ps.hasStarter && s.ps.editStrategy != null);
    const unchanged = starterRuns.filter((s) => s.ps.starterUnchanged);
    const edited = starterRuns.filter((s) => !s.ps.starterUnchanged);
    const strategyCounts = new Map<string, number>();
    for (const s of starterRuns) {
      const label = s.ps.editStrategyLabel ?? "Other";
      strategyCounts.set(label, (strategyCounts.get(label) ?? 0) + 1);
    }
    const macroUse = new Map<
      string,
      { name: string; kind: "bag" | "chunk"; color?: string; runs: number; uses: number }
    >();
    for (const row of sample.macroRows) {
      macroUse.set(row.token, { name: row.name, kind: row.kind, color: row.color, runs: 0, uses: 0 });
    }
    for (const s of macroRuns) {
      for (const row of s.ps.macroRows) {
        if (row.inFinal === 0) continue;
        const entry = macroUse.get(row.token) ?? {
          name: row.name,
          kind: row.kind,
          color: row.color,
          runs: 0,
          uses: 0,
        };
        entry.runs += 1;
        entry.uses += row.inFinal;
        macroUse.set(row.token, entry);
      }
    }
    const macroList = [...macroUse.values()];
    programStructureMetrics = {
      hasStarter: sample.hasStarter,
      usesMacros: sample.usesMacros,
      runsAnalyzed: structures.length,
      starterRuns: starterRuns.length,
      pctStarterUnchanged: pctOf(unchanged.length, starterRuns.length),
      avgEdits: starterRuns.length
        ? Math.round(
            (starterRuns.reduce((n, s) => n + s.ps.addedCount + s.ps.removedCount, 0) / starterRuns.length) * 10
          ) / 10
        : null,
      passRateUnchanged: pctOf(unchanged.filter((s) => s.passed).length, unchanged.length),
      passRateEdited: pctOf(edited.filter((s) => s.passed).length, edited.length),
      strategies: [...strategyCounts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count),
      macroRuns: macroRuns.length,
      pctUsingAnyMacro: pctOf(macroRuns.filter((s) => s.ps.macroBlocksInFinal > 0).length, macroRuns.length),
      avgMacroSharePct: macroRuns.length
        ? Math.round(macroRuns.reduce((n, s) => n + (s.ps.macroSharePct ?? 0), 0) / macroRuns.length)
        : null,
      macros: macroList
        .filter((m) => m.runs > 0)
        .sort((a, b) => b.runs - a.runs)
        .map((m) => ({
          name: m.name,
          kind: m.kind,
          color: m.color,
          pctRuns: pctOf(m.runs, macroRuns.length) ?? 0,
          uses: m.uses,
        })),
      unusedMacros: macroRuns.length ? macroList.filter((m) => m.runs === 0).map((m) => m.name) : [],
    };
  }

  let geometryMetrics: LevelDetailPayload["geometryMetrics"] = null;
  if (parsedConfig.success && isGeometryPathLevel(parsedConfig.data, level.levelType)) {
    const analyses = attempts.map((a) =>
      buildGeometryPathAnalysisFromAttempt({
        config: parsedConfig.data,
        levelType: level.levelType,
        mistakes: a.mistakes,
        passed: a.passed,
      })
    );
    const withTel = analyses.filter((x) => x.hasTelemetry);
    const avg = (vals: number[]) =>
      vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
    const cmdUses = attempts.map((a) => (a.finalCommand ?? "").toLowerCase());
    const pct = (pred: (c: string) => boolean) => {
      if (cmdUses.length === 0) return null;
      return Math.round((cmdUses.filter(pred).length / cmdUses.length) * 100);
    };
    geometryMetrics = {
      avgCompletionPct: avg(withTel.map((x) => x.pathCompletionPct)),
      avgAccuracyPct: avg(withTel.map((x) => x.pathAccuracyPct)),
      attemptsWithTelemetry: withTel.length,
      pctUsingRepeat: pct((c) => c.includes("repeat")),
      // Recorded programs are expanded arrows; bag / chunk use comes from strip telemetry.
      pctUsingChunks: pctOf(macroRuns.filter((s) => s.ps.chunksUsed > 0).length, macroRuns.length),
      pctUsingBags: pctOf(macroRuns.filter((s) => s.ps.bagsUsed > 0).length, macroRuns.length),
    };
  }

  const payload: LevelDetailPayload = {
    id: level.id,
    levelKey: level.levelKey,
    name: level.name,
    description: level.description,
    orderIndex: level.orderIndex,
    difficulty: level.difficulty,
    levelTypeLabel: LEVEL_TYPE_LABELS[level.levelType],
    published: level.published,
    metrics: {
      attemptCount: attempts.length,
      passRate,
      passLabel: formatPercent(passed, attempts.length),
      avgScore,
      uniqueStudents: new Set(attempts.map((a) => a.studentId)).size,
      avgTimeLabel: `Avg time ${formatDuration(avgTime)}`,
    },
    chartData,
    attempts: rows,
    geometryMetrics,
    programStructureMetrics,
  };

  return <LevelDetailTabs level={payload} />;
}

export default async function LevelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const { id } = await params;

  return (
    <TeacherShell title="Item" userName={session?.user.name}>
      <Suspense
        fallback={
          <p className="py-12 text-center text-sm text-muted-foreground">Loading item…</p>
        }
      >
        <LevelDetailContent id={id} />
      </Suspense>
    </TeacherShell>
  );
}
