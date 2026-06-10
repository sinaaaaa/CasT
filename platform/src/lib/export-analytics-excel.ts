import type { AllItemsSummaryRow } from "@/lib/analytics";
import { safeExportFilename, writeWorkbook } from "@/lib/export-excel-common";

type AnalyticsExportInput = {
  overview: {
    studentCount: number;
    totalAttempts: number;
    passedAttempts: number;
    failedAttempts: number;
    avgScore: number;
    avgTimeSeconds: number;
    needsHelp: number;
    statusCounts: { correct: number; incorrect: number; incomplete: number };
  };
  items: AllItemsSummaryRow[];
  timeByLevel: { level: string; avgSeconds: number }[];
  recentAttempts: {
    studentExportId: string;
    level: string;
    status: string;
    passed: boolean;
    score: number | null;
    startedAt: Date;
    totalTimeSeconds: number | null;
  }[];
};

export function buildAnalyticsWorkbook(data: AnalyticsExportInput) {
  const { overview } = data;

  return writeWorkbook([
    {
      name: "Overview",
      rows: [
        ["Students", overview.studentCount],
        ["Total attempts", overview.totalAttempts],
        ["Passed attempts", overview.passedAttempts],
        ["Failed attempts", overview.failedAttempts],
        ["Average score %", overview.avgScore],
        ["Average time (seconds)", overview.avgTimeSeconds],
        ["Students needing help", overview.needsHelp],
        ["Correct attempts", overview.statusCounts.correct],
        ["Incorrect attempts", overview.statusCounts.incorrect],
        ["Incomplete attempts", overview.statusCounts.incomplete],
        ["Exported at", new Date().toISOString()],
      ],
    },
    {
      name: "All items",
      rows: [
        [
          "Item",
          "Order",
          "Published",
          "Difficulty",
          "Total attempts",
          "Passed attempts",
          "Failed attempts",
          "Pass rate %",
          "Avg score",
          "Avg time (seconds)",
          "Unique students",
        ],
        ...data.items.map((item) => [
          item.name,
          item.orderIndex,
          item.published ? "Yes" : "No",
          item.difficulty,
          item.totalAttempts,
          item.passedAttempts,
          item.failedAttempts,
          item.passRate,
          item.avgScore ?? "",
          item.avgTimeSeconds ?? "",
          item.uniqueStudents,
        ]),
      ],
    },
    {
      name: "Time by item",
      rows: [
        ["Item", "Avg time (seconds)"],
        ...data.timeByLevel.map((row) => [row.level, row.avgSeconds]),
      ],
    },
    {
      name: "Recent attempts",
      rows: [
        ["Student ID", "Item", "Status", "Passed", "Score", "Started", "Time (seconds)"],
        ...data.recentAttempts.map((a) => [
          a.studentExportId,
          a.level,
          a.status,
          a.passed ? "Yes" : "No",
          a.score ?? "",
          a.startedAt.toISOString(),
          a.totalTimeSeconds ?? "",
        ]),
      ],
    },
  ]);
}

export function buildAllItemsWorkbook(items: AllItemsSummaryRow[]) {
  return writeWorkbook([
    {
      name: "All items",
      rows: [
        [
          "Item",
          "Item key",
          "Order",
          "Published",
          "Difficulty",
          "Total attempts",
          "Passed attempts",
          "Failed attempts",
          "Pass rate %",
          "Avg score",
          "Avg time (seconds)",
          "Unique students",
        ],
        ...items.map((item) => [
          item.name,
          item.levelKey,
          item.orderIndex,
          item.published ? "Yes" : "No",
          item.difficulty,
          item.totalAttempts,
          item.passedAttempts,
          item.failedAttempts,
          item.passRate,
          item.avgScore ?? "",
          item.avgTimeSeconds ?? "",
          item.uniqueStudents,
        ]),
      ],
    },
  ]);
}

export function analyticsExportFilename(): string {
  return safeExportFilename("analytics", "export");
}

export function allItemsExportFilename(): string {
  return safeExportFilename("all-items", "export");
}
