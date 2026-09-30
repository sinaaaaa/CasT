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
  /** Starter edits + Command Bag / Chunk usage; null when the item has neither. */
  programStructure?: {
    starterEdit: string;
    keptAddedRemoved: string;
    bagsUsed: number | "";
    chunksUsed: number | "";
    macroSharePct: number | "";
    programAsBuilt: string;
  } | null;
  /** Replay checks: geometry edges met + closest working block program. */
  replay?: {
    edgesMet: string;
    whatHappened: string;
    firstMistakeBlock: number | "";
    closestFix: string;
  } | null;
};

const REPLAY_HEADERS = ["Edges Met", "What Happened", "First Mistake Block", "Closest Fix"];

const STRUCTURE_HEADERS = [
  "Starter Edit Strategy",
  "Starter Kept / Added / Removed",
  "Bags Used",
  "Chunks Used",
  "Moves From Bags/Chunks %",
  "Program As Built",
];

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
  const hasStructure = rows.some((r) => r.programStructure);
  const hasReplay = rows.some((r) => r.replay);
  const headers = [
    ...baseHeaders,
    ...(hasStructure ? STRUCTURE_HEADERS : []),
    ...(hasReplay ? REPLAY_HEADERS : []),
    ...constructHeaders,
  ];

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
    const ps = r.programStructure;
    const structureCols = hasStructure
      ? ps
        ? [ps.starterEdit, ps.keptAddedRemoved, ps.bagsUsed, ps.chunksUsed, ps.macroSharePct, ps.programAsBuilt]
        : STRUCTURE_HEADERS.map(() => "")
      : [];
    const rp = r.replay;
    const replayCols = hasReplay
      ? rp
        ? [rp.edgesMet, rp.whatHappened, rp.firstMistakeBlock, rp.closestFix]
        : REPLAY_HEADERS.map(() => "")
      : [];
    const constructCols = [...constructSlugs].map((s) => r.constructScores[s] ?? "");
    return [...base, ...structureCols, ...replayCols, ...constructCols];
  });

  const sheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Assessment");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
