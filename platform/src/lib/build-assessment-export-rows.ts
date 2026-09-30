import { prisma } from "@/lib/prisma";
import type { ExportRow } from "@/lib/export-assessment-excel";
import type { TeacherAssessmentSummary } from "@/lib/assessment/assessmentTypes";
import { levelGameplayConfigSchema } from "@/lib/level-config";
import { buildProgramStructureAnalysis } from "@/lib/assessment/programStructureAnalysis";
import { buildReplayDiagnostics } from "@/lib/assessment/replayDiagnostics";

export async function buildAssessmentExportRows(filters?: {
  studentIds?: string[];
  allStudents?: boolean;
  levelId?: string;
  classId?: string;
  /** Teacher class scope. null = admin (all students). Omit only for legacy — treated as empty. */
  scopeClassIds?: string[] | null;
}): Promise<ExportRow[]> {
  let studentIdFilter: string[] | undefined;

  if (filters?.classId) {
    const members = await prisma.classStudent.findMany({
      where: { classId: filters.classId },
      select: { studentId: true },
    });
    studentIdFilter = members.map((m) => m.studentId);
  } else if (filters?.studentIds?.length && !filters?.allStudents) {
    studentIdFilter = filters.studentIds;
  } else if (filters?.scopeClassIds === null) {
    studentIdFilter = undefined;
  } else if (filters?.scopeClassIds !== undefined) {
    if (filters.scopeClassIds.length === 0) {
      studentIdFilter = [];
    } else {
      const members = await prisma.classStudent.findMany({
        where: { classId: { in: filters.scopeClassIds } },
        select: { studentId: true },
      });
      studentIdFilter = [...new Set(members.map((m) => m.studentId))];
    }
  } else {
    studentIdFilter = [];
  }

  const students = await prisma.studentProfile.findMany({
    where: {
      isArchived: false,
      ...(studentIdFilter !== undefined
        ? studentIdFilter.length
          ? { id: { in: studentIdFilter } }
          : { id: { in: [] as string[] } }
        : {}),
    },
    include: {
      levelAttempts: {
        where: {
          endedAt: { not: null },
          ...(filters?.levelId ? { levelId: filters.levelId } : {}),
        },
        include: {
          level: true,
          stealthAssessment: true,
        },
        orderBy: { endedAt: "desc" },
      },
    },
  });

  const rows: ExportRow[] = [];

  for (const s of students) {
    for (const a of s.levelAttempts) {
      const stealth = a.stealthAssessment;
      const summary = stealth?.teacherSummary as TeacherAssessmentSummary | undefined;
      const evidence = stealth?.evidence as {
        metrics?: {
          commandCount?: number;
          optimalCommandCount?: number;
          unnecessaryMoves?: number;
          collisions?: number;
        };
      } | null;
      const route = stealth?.routeAnalysis as { unnecessaryMoves?: number } | null;

      const constructScores: Record<string, number> = {};
      if (summary?.constructScores) {
        for (const c of summary.constructScores) {
          constructScores[c.slug] = c.score;
        }
      }

      const parsedConfig = levelGameplayConfigSchema.safeParse(a.level.config);
      const ps = parsedConfig.success
        ? buildProgramStructureAnalysis({
            config: parsedConfig.data,
            levelType: a.level.levelType,
            mistakes: a.mistakes,
            finalCommand: a.finalCommand,
            passed: a.passed,
          })
        : null;
      const macroKnown = ps?.usesMacros && ps.source === "unity";
      const replay = parsedConfig.success
        ? buildReplayDiagnostics({
            config: parsedConfig.data,
            levelType: a.level.levelType,
            mistakes: a.mistakes,
            finalCommand: a.finalCommand,
            passed: a.passed,
            budget: 800,
          })
        : null;
      const edges = replay?.geometryEdgeDiagnosis ?? null;
      const blocks = replay?.blockComparison ?? null;

      rows.push({
        studentId: s.externalId?.trim() || s.id,
        levelName: a.level.name,
        taskType: stealth?.taskType ?? "",
        date: a.endedAt?.toISOString().slice(0, 10) ?? "",
        overallScore: stealth?.overallScore ?? "",
        overallLevel: stealth?.overallMastery ?? "",
        reachedGoal: a.passed ? "Yes" : "No",
        commandCount: evidence?.metrics?.commandCount ?? "",
        optimalCommandCount: evidence?.metrics?.optimalCommandCount ?? "",
        extraCommands: route?.unnecessaryMoves ?? evidence?.metrics?.unnecessaryMoves ?? "",
        collisions: evidence?.metrics?.collisions ?? "",
        resetCount: a.resetCount,
        robotTouchUsed: a.robotTouched ? "Yes" : "No",
        robotTouchCount: a.robotTouchCount,
        teacherSummary: summary?.taskMastery ?? "",
        recommendation: summary?.recommendations?.[0] ?? "",
        constructScores,
        programStructure: ps?.available
          ? {
              starterEdit: ps.editStrategyLabel ?? "",
              keptAddedRemoved: ps.hasStarter
                ? `${ps.keptCount} / ${ps.addedCount} / ${ps.removedCount}`
                : "",
              bagsUsed: macroKnown && ps.bagsAvailable ? ps.bagsUsed : "",
              chunksUsed: macroKnown && ps.chunksAvailable ? ps.chunksUsed : "",
              macroSharePct: ps.macroSharePct ?? "",
              programAsBuilt: ps.final.map((b) => b.label).join(" → "),
            }
          : null,
        replay:
          edges || blocks
            ? {
                edgesMet: edges ? `${edges.metCount}/${edges.targetCount}` : "",
                whatHappened: edges?.primaryIssue
                  ? `${edges.primaryIssue.title}: ${edges.primaryIssue.message}`
                  : "",
                firstMistakeBlock: blocks?.firstMistakeBlock ?? edges?.primaryIssue?.block ?? "",
                closestFix: blocks?.fixes[0]?.description ?? (blocks?.noSmallFix ? "No fix within two block changes" : ""),
              }
            : null,
      });
    }
  }

  return rows;
}
