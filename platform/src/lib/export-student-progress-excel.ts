import type { ClassProgressReport } from "@/lib/analytics";
import { getStudentProgress } from "@/lib/analytics";
import { exportStudentId, safeExportFilename, writeWorkbook } from "@/lib/export-excel-common";

export async function buildStudentProgressWorkbook(
  studentId: string,
  externalId: string | null
) {
  const progress = await getStudentProgress(studentId);
  const studentExportId = exportStudentId(externalId, studentId);

  return {
    buffer: writeWorkbook([
      {
        name: "Summary",
        rows: [
          ["Student ID", studentExportId],
          ["Total items", progress.summary.totalLevels],
          ["Passed", progress.summary.passed],
          ["Failed", progress.summary.failed],
          ["Not started", progress.summary.incomplete],
          ["Completion %", progress.summary.completionPercent],
          ["Exported at", new Date().toISOString()],
        ],
      },
      {
        name: "By item",
        rows: [
          [
            "Item",
            "Order",
            "Status",
            "Passed",
            "Attempts",
            "Score",
            "Time (seconds)",
            "Final command",
            "Last attempt",
          ],
          ...progress.levels.map((l) => [
            l.name,
            l.orderIndex,
            l.status,
            l.passed ? "Yes" : "No",
            l.attempts,
            l.score ?? "",
            l.totalTimeSeconds ?? "",
            l.finalCommand ?? "",
            l.lastAttemptAt?.toISOString() ?? "",
          ]),
        ],
      },
      {
        name: "Attempt history",
        rows: [
          ["Item", "Attempt #", "Status", "Passed", "Score", "Started", "Time (seconds)"],
          ...progress.history.map((h) => [
            h.level,
            h.attemptNumber,
            h.status,
            h.passed ? "Yes" : "No",
            h.score ?? "",
            h.startedAt.toISOString(),
            h.totalTimeSeconds ?? "",
          ]),
        ],
      },
    ]),
    filename: studentProgressFilename(studentExportId),
  };
}

export function studentProgressFilename(studentExportId: string): string {
  return safeExportFilename(studentExportId, "student-report");
}

export function classReportFilename(className: string): string {
  return safeExportFilename(className, "class-report");
}

export function buildClassReportWorkbookFromReport(report: ClassProgressReport) {
  return writeWorkbook([
    {
      name: "Summary",
      rows: [
        ["Class name", report.class.name],
        ["Class code", report.class.code],
        ["Students", report.studentCount],
        ["Items", report.summary.totalItems],
        ["Completion %", report.summary.completionPercent],
        ["Passed (student × item)", report.summary.passed],
        ["Failed (student × item)", report.summary.failed],
        ["Not started (student × item)", report.summary.incomplete],
        ["Total attempts", report.summary.totalAttempts],
        ["Passed attempts", report.summary.passedAttempts],
        ["Failed attempts", report.summary.failedAttempts],
        ["Exported at", new Date().toISOString()],
      ],
    },
    {
      name: "By item",
      rows: [
        [
          "Item",
          "Order",
          "Students passed",
          "Students failed",
          "Not started",
          "Pass rate %",
          "Total attempts",
          "Avg score",
          "Avg time (seconds)",
        ],
        ...report.items.map((item) => [
          item.name,
          item.orderIndex,
          item.studentsPassed,
          item.studentsFailed,
          item.studentsIncomplete,
          item.passRate,
          item.totalAttempts,
          item.avgScore ?? "",
          item.avgTimeSeconds ?? "",
        ]),
      ],
    },
    {
      name: "By student",
      rows: [
        ["Student ID", "Passed", "Failed", "Not started", "Completion %"],
        ...report.students.map((s) => [
          exportStudentId(s.externalId, s.studentId),
          s.passed,
          s.failed,
          s.incomplete,
          s.completionPercent,
        ]),
      ],
    },
    {
      name: "Student x item",
      rows: [
        ["Student ID", "Item", "Order", "Status", "Attempts", "Best score"],
        ...[...report.cells]
          .sort(
            (a, b) =>
              exportStudentId(a.externalId, a.studentId).localeCompare(
                exportStudentId(b.externalId, b.studentId)
              ) || a.orderIndex - b.orderIndex
          )
          .map((c) => [
            exportStudentId(c.externalId, c.studentId),
            c.itemName,
            c.orderIndex,
            c.status,
            c.attempts,
            c.score ?? "",
          ]),
      ],
    },
  ]);
}
