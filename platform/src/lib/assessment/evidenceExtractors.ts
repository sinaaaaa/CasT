/**
 * Parse optional gameplay fields from attempt.mistakes JSON (additive).
 */

import type { Vec2 } from "@/lib/assessment/assessmentTypes";
import { GRID_COLS, GRID_ROWS } from "@/lib/level-editor-constants";
import { normalizeCommandToken, type CommandToken } from "@/lib/command-icons";

export function readVec2(raw: unknown): Vec2 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const x =
    typeof o.x === "number" ? o.x : typeof o.col === "number" ? o.col : null;
  const y =
    typeof o.y === "number" ? o.y : typeof o.row === "number" ? o.row : null;
  if (x == null || y == null) return null;
  return { x, y };
}

/** Unity sends -1,-1 when no flag was placed; ignore invalid grid coordinates. */
export function isValidGridFlagCell(
  cell: Vec2 | null,
  cols = GRID_COLS,
  rows = GRID_ROWS
): cell is Vec2 {
  if (!cell) return false;
  return cell.x >= 0 && cell.y >= 0 && cell.x < cols && cell.y < rows;
}

function mistakesRecord(mistakes: unknown): Record<string, unknown> | null {
  if (!mistakes || typeof mistakes !== "object" || Array.isArray(mistakes)) return null;
  return mistakes as Record<string, unknown>;
}

export function parseStudentFlagFromMistakes(mistakes: unknown): Vec2 | null {
  const o = mistakesRecord(mistakes);
  if (!o) return null;
  const raw =
    readVec2(o.flagCell) ??
    readVec2(o.studentFlagPosition) ??
    readVec2(o.flagPosition) ??
    null;
  return isValidGridFlagCell(raw) ? raw : null;
}

export function parseExpectedFlagFromMistakes(mistakes: unknown): Vec2 | null {
  const o = mistakesRecord(mistakes);
  if (!o) return null;
  const raw = readVec2(o.expectedCell) ?? readVec2(o.expectedFlagPosition) ?? null;
  return isValidGridFlagCell(raw) ? raw : null;
}

export function parseBlankAnswersFromMistakes(mistakes: unknown): {
  student: string[];
  correct: string[];
  isCorrect: boolean | null;
} {
  const o = mistakesRecord(mistakes);
  if (!o) return { student: [], correct: [], isCorrect: null };
  const student = Array.isArray(o.blankAnswers)
    ? o.blankAnswers.filter((v): v is string => typeof v === "string")
    : [];
  const correct = Array.isArray(o.correctBlankAnswers)
    ? o.correctBlankAnswers.filter((v): v is string => typeof v === "string")
    : [];
  const isCorrect =
    typeof o.blankAnswersCorrect === "boolean" ? o.blankAnswersCorrect : null;
  return { student, correct, isCorrect };
}

export function parseSelectedActionFromMistakes(mistakes: unknown): CommandToken | string | null {
  if (!mistakes || typeof mistakes !== "object") return null;
  const o = mistakes as Record<string, unknown>;
  const raw = o.selectedAction ?? o.chosenAction;
  if (typeof raw !== "string") return null;
  return normalizeCommandToken(raw) ?? raw;
}
