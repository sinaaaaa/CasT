import * as XLSX from "xlsx";
import type { ClassProgressReport } from "@/lib/analytics";
import { exportStudentId } from "@/lib/export-excel-common";

function safeSheetName(name: string, used: Set<string>): string {
  const base = name.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 28) || "Sheet";
  let candidate = base;
  let n = 2;
  while (used.has(candidate)) {
    candidate = `${base.slice(0, 24)} ${n}`;
    n += 1;
  }
  used.add(candidate);
  return candidate;
}

function formatSeconds(seconds: number | null): string | number {
  if (seconds == null) return "";
  return seconds;
}

function summaryRows(report: ClassProgressReport): (string | number)[][] {
  const { class: cls, summary, studentCount } = report;
  return [
    ["Class name", cls.name],
    ["Class code", cls.code],
    ["Students", studentCount],
    ["Items", summary.totalItems],
    ["Completion %", summary.completionPercent],
    ["Passed (student × item)", summary.passed],
    ["Failed (student × item)", summary.failed],
    ["Not started (student × item)", summary.incomplete],
    ["Total attempts", summary.totalAttempts],
    ["Passed attempts", summary.passedAttempts],
    ["Failed attempts", summary.failedAttempts],
    ["Exported at", new Date().toISOString()],
  ];
}

function itemRows(report: ClassProgressReport): (string | number)[][] {
  const headers = [
    "Item",
    "Order",
    "Students passed",
    "Students failed",
    "Not started",
    "Pass rate %",
    "Total attempts",
    "Avg score",
    "Avg time (seconds)",
  ];
  const rows = report.items.map((item) => [
    item.name,
    item.orderIndex,
    item.studentsPassed,
    item.studentsFailed,
    item.studentsIncomplete,
    item.passRate,
    item.totalAttempts,
    item.avgScore ?? "",
    formatSeconds(item.avgTimeSeconds),
  ]);
  return [headers, ...rows];
}

function studentRows(report: ClassProgressReport): (string | number)[][] {
  const headers = ["Student ID", "Passed", "Failed", "Not started", "Completion %"];
  const rows = report.students.map((s) => [
    exportStudentId(s.externalId, s.studentId),
    s.passed,
    s.failed,
    s.incomplete,
    s.completionPercent,
  ]);
  return [headers, ...rows];
}

function detailRows(report: ClassProgressReport): (string | number)[][] {
  const headers = ["Student ID", "Item", "Order", "Status", "Attempts", "Best score"];
  const rows = [...report.cells]
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
    ]);
  return [headers, ...rows];
}

export function buildClassReportWorkbook(report: ClassProgressReport) {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(summaryRows(report)),
    safeSheetName("Summary", used)
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(itemRows(report)),
    safeSheetName("By item", used)
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(studentRows(report)),
    safeSheetName("By student", used)
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(detailRows(report)),
    safeSheetName("Student x item", used)
  );

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

export function buildAllClassesReportWorkbook(reports: ClassProgressReport[]) {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();

  const overviewHeaders = [
    "Class",
    "Code",
    "Students",
    "Items",
    "Completion %",
    "Passed",
    "Failed",
    "Not started",
    "Total attempts",
    "Passed attempts",
    "Failed attempts",
  ];
  const overviewRows = reports.map((r) => [
    r.class.name,
    r.class.code,
    r.studentCount,
    r.summary.totalItems,
    r.summary.completionPercent,
    r.summary.passed,
    r.summary.failed,
    r.summary.incomplete,
    r.summary.totalAttempts,
    r.summary.passedAttempts,
    r.summary.failedAttempts,
  ]);
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([overviewHeaders, ...overviewRows]),
    safeSheetName("All classes", used)
  );

  const allItemHeaders = [
    "Class",
    "Code",
    "Item",
    "Order",
    "Students passed",
    "Students failed",
    "Not started",
    "Pass rate %",
    "Total attempts",
    "Avg score",
    "Avg time (seconds)",
  ];
  const allItemRows = reports.flatMap((r) =>
    r.items.map((item) => [
      r.class.name,
      r.class.code,
      item.name,
      item.orderIndex,
      item.studentsPassed,
      item.studentsFailed,
      item.studentsIncomplete,
      item.passRate,
      item.totalAttempts,
      item.avgScore ?? "",
      formatSeconds(item.avgTimeSeconds),
    ])
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([allItemHeaders, ...allItemRows]),
    safeSheetName("All items", used)
  );

  const allStudentHeaders = [
    "Class",
    "Code",
    "Student ID",
    "Passed",
    "Failed",
    "Not started",
    "Completion %",
  ];
  const allStudentRows = reports.flatMap((r) =>
    r.students.map((s) => [
      r.class.name,
      r.class.code,
      exportStudentId(s.externalId, s.studentId),
      s.passed,
      s.failed,
      s.incomplete,
      s.completionPercent,
    ])
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([allStudentHeaders, ...allStudentRows]),
    safeSheetName("All students", used)
  );

  const allDetailHeaders = [
    "Class",
    "Code",
    "Student ID",
    "Item",
    "Order",
    "Status",
    "Attempts",
    "Best score",
  ];
  const allDetailRows = reports.flatMap((r) =>
    [...r.cells]
      .sort(
        (a, b) =>
          exportStudentId(a.externalId, a.studentId).localeCompare(
            exportStudentId(b.externalId, b.studentId)
          ) || a.orderIndex - b.orderIndex
      )
      .map((c) => [
        r.class.name,
        r.class.code,
        exportStudentId(c.externalId, c.studentId),
        c.itemName,
        c.orderIndex,
        c.status,
        c.attempts,
        c.score ?? "",
      ])
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([allDetailHeaders, ...allDetailRows]),
    safeSheetName("All student x item", used)
  );

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

export function classReportFilename(className: string): string {
  const safe = className.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "class";
  return `sparc-${safe}-report.xlsx`;
}
