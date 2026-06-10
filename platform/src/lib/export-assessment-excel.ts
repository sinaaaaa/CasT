import * as XLSX from "xlsx";
import { constructDisplayName } from "@/lib/assessment/assessmentGlossary";

export type ExportRow = {
  studentId: string;
  levelName: string;
  taskType: string;
  date: string;
  overallScore: number | "";
  overallLevel: string;
  reachedGoal: string;
  commandCount: number | "";
  optimalCommandCount: number | "";
  extraCommands: number | "";
  collisions: number | "";
  resetCount: number;
  robotTouchUsed: string;
  robotTouchCount: number;
  teacherSummary: string;
  recommendation: string;
  constructScores: Record<string, number>;
};

export function buildAssessmentWorkbook(rows: ExportRow[]) {
  const constructSlugs = new Set<string>();
  rows.forEach((r) => Object.keys(r.constructScores).forEach((k) => constructSlugs.add(k)));

  const baseHeaders = [
    "Student ID",
    "Level / Task",
    "Task Type",
    "Date",
    "Overall Score",
    "Overall Level",
    "Reached Goal",
    "Command Count",
    "Optimal Commands",
    "Extra Commands",
    "Collisions",
    "Reset Count",
    "Robot Touch Used",
    "Robot Touch Count",
    "Teacher Summary",
    "Recommendation",
  ];

  const constructHeaders = [...constructSlugs].map((s) => constructDisplayName(s));
  const headers = [...baseHeaders, ...constructHeaders];

  const data = rows.map((r) => {
    const base = [
      r.studentId,
      r.levelName,
      r.taskType,
      r.date,
      r.overallScore,
      r.overallLevel,
      r.reachedGoal,
      r.commandCount,
      r.optimalCommandCount,
      r.extraCommands,
      r.collisions,
      r.resetCount,
      r.robotTouchUsed,
      r.robotTouchCount,
      r.teacherSummary,
      r.recommendation,
    ];
    const constructCols = [...constructSlugs].map((s) => r.constructScores[s] ?? "");
    return [...base, ...constructCols];
  });

  const sheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Assessment");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
