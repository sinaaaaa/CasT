import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { requireClassAccess } from "@/lib/class-access";
import { getAllItemsProgressSummary, getTeacherDashboardStats } from "@/lib/analytics";
import { excelResponse } from "@/lib/export-excel-common";
import {
  allItemsExportFilename,
  analyticsExportFilename,
  buildAllItemsWorkbook,
  buildAnalyticsWorkbook,
} from "@/lib/export-analytics-excel";

export async function GET(request: NextRequest) {
  const { error, scope } = await requireTeacher();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("classId") ?? undefined;
  const mode = searchParams.get("mode") ?? "analytics";

  if (classId) {
    const denied = requireClassAccess(scope!, classId);
    if (denied) return denied;
  }

  if (mode === "items") {
    const items = await getAllItemsProgressSummary(scope!);
    const buffer = buildAllItemsWorkbook(items);
    return excelResponse(buffer, allItemsExportFilename());
  }

  const [stats, items] = await Promise.all([
    getTeacherDashboardStats({ classId, scopeClassIds: scope!.classIds }),
    getAllItemsProgressSummary(scope!),
  ]);

  const buffer = buildAnalyticsWorkbook({
    overview: {
      studentCount: stats.studentCount,
      totalAttempts: stats.totalAttempts,
      passedAttempts: stats.completedLevels,
      failedAttempts: stats.failedLevels,
      avgScore: stats.avgScore,
      avgTimeSeconds: stats.avgTimeSeconds,
      needsHelp: stats.needsHelp,
      statusCounts: stats.statusCounts,
    },
    items,
    timeByLevel: stats.timeByLevel,
    recentAttempts: stats.recentAttempts.map((a) => ({
      studentExportId: a.studentExportId,
      level: a.level,
      status: a.status,
      passed: a.passed,
      score: a.score,
      startedAt: new Date(a.startedAt),
      totalTimeSeconds: a.totalTimeSeconds,
    })),
  });

  return excelResponse(buffer, analyticsExportFilename());
}
