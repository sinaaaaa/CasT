import type { ItemProgressReport } from "@/lib/analytics";
import { exportStudentId, safeExportFilename, writeWorkbook } from "@/lib/export-excel-common";

export function buildItemReportWorkbook(report: ItemProgressReport) {
  const { item, summary } = report;

  return writeWorkbook([
    {
      name: "Summary",
      rows: [
        ["Item name", item.name],
        ["Item key", item.levelKey],
        ["Order", item.orderIndex],
        ["Difficulty", item.difficulty],
        ["Type", item.levelType],
        ["Published", item.published ? "Yes" : "No"],
        ["Total attempts", summary.totalAttempts],
        ["Passed attempts", summary.passedAttempts],
        ["Failed attempts", summary.failedAttempts],
        ["Incomplete attempts", summary.incompleteAttempts],
        ["Pass rate %", summary.passRate],
        ["Avg score", summary.avgScore ?? ""],
        ["Avg time (seconds)", summary.avgTimeSeconds ?? ""],
        ["Unique students", summary.uniqueStudents],
        ["Students passed", summary.studentsPassed],
        ["Students failed", summary.studentsFailed],
        ["Students not started", summary.studentsNotStarted],
        ["Exported at", new Date().toISOString()],
      ],
    },
    {
      name: "By student",
      rows: [
        [
          "Student ID",
          "Status",
          "Attempts",
          "Best score",
          "Time (seconds)",
        ],
        ...report.students.map((s) => [
          exportStudentId(s.externalId, s.studentId),
          s.status,
          s.attempts,
          s.bestScore ?? "",
          s.totalTimeSeconds ?? "",
        ]),
      ],
    },
    {
      name: "Attempts",
      rows: [
        [
          "Student ID",
          "Try",
          "Session attempt #",
          "Status",
          "Passed",
          "Score",
          "Time (seconds)",
          "Started",
          "Ended",
          "Reset count",
          "Robot touch",
          "Touch count",
          "Final command",
        ],
        ...report.attempts.map((a) => [
          exportStudentId(a.externalId, a.studentId),
          a.attemptLabel,
          a.attemptNumber,
          a.status,
          a.passed ? "Yes" : "No",
          a.score ?? "",
          a.totalTimeSeconds ?? "",
          a.startedAt.toISOString(),
          a.endedAt?.toISOString() ?? "",
          a.resetCount,
          a.robotTouched ? "Yes" : "No",
          a.robotTouchCount,
          a.finalCommand ?? "",
        ]),
      ],
    },
  ]);
}

export function itemReportFilename(itemName: string): string {
  return safeExportFilename(itemName, "item-report");
}
