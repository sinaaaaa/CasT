"use client";

import { formatGridCell } from "@/lib/assessment/routeAnalysis";
import type { Vec2 } from "@/lib/assessment/assessmentTypes";
import type { MisconceptionMatch } from "@/lib/assessment/predictionAnalysis";
import { GRID_COLS, GRID_ROWS } from "@/lib/level-editor-constants";

type CellKind =
  | "empty"
  | "start"
  | "studentFlag"
  | "expected"
  | "misconception"
  | "path";

type Props = {
  startPosition: Vec2;
  studentFlag?: Vec2 | null;
  expectedPosition?: Vec2 | null;
  /** Optional simulated end cells from misconception models (exact matches highlighted). */
  misconceptionMatches?: MisconceptionMatch[];
  startFacing?: string;
};

const FACING_ARROW: Record<string, string> = {
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
};

function cellKind(
  x: number,
  y: number,
  start: Vec2,
  miscSet: Set<string>,
  student?: Vec2 | null,
  expected?: Vec2 | null
): CellKind {
  const k = `${x},${y}`;
  if (start.x === x && start.y === y) return "start";
  if (student && student.x === x && student.y === y) return "studentFlag";
  if (expected && expected.x === x && expected.y === y) return "expected";
  if (miscSet.has(k)) return "misconception";
  return "empty";
}

const tone: Record<CellKind, string> = {
  empty: "bg-slate-100",
  start: "bg-lime-400 ring-2 ring-lime-700",
  studentFlag: "bg-rose-500 ring-2 ring-rose-800",
  expected: "bg-violet-500 ring-2 ring-violet-800",
  misconception: "bg-amber-300 ring-1 ring-amber-600",
  path: "bg-sky-200",
};

const label: Record<CellKind, string> = {
  empty: "",
  start: "S",
  studentFlag: "F",
  expected: "✓",
  misconception: "?",
  path: "",
};

export function PredictionGridViz({
  startPosition,
  studentFlag,
  expectedPosition,
  misconceptionMatches,
  startFacing = "up",
}: Props) {
  const miscSet = new Set<string>();
  for (const m of misconceptionMatches ?? []) {
    if (m.modelId !== "correct" && m.exactMatch) {
      miscSet.add(`${m.finalPosition.x},${m.finalPosition.y}`);
    }
  }

  const cells: { x: number; y: number; kind: CellKind }[] = [];
  for (let y = GRID_ROWS - 1; y >= 0; y--) {
    for (let x = 0; x < GRID_COLS; x++) {
      cells.push({
        x,
        y,
        kind: cellKind(x, y, startPosition, miscSet, studentFlag, expectedPosition),
      });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-lime-400 ring-1 ring-lime-700" />
          Start {formatGridCell(startPosition)}
          <span className="font-mono">{FACING_ARROW[startFacing] ?? "↑"}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-rose-500 ring-1 ring-rose-800" />
          Student flag
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-violet-500 ring-1 ring-violet-800" />
          Expected (simulation)
        </span>
        {miscSet.size > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm bg-amber-300 ring-1 ring-amber-600" />
            Likely misconception cell
          </span>
        )}
      </div>
      <div
        className="inline-grid gap-0.5 rounded-md bg-white p-1.5 shadow-inner"
        style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1.75rem)` }}
      >
        {cells.map((c) => (
          <div
            key={`${c.x}-${c.y}`}
            className={`relative flex h-7 w-7 items-center justify-center rounded-sm text-[10px] font-bold text-white ${tone[c.kind]}`}
            title={`${c.kind} · row ${c.y + 1}, col ${c.x + 1}`}
          >
            {label[c.kind]}
          </div>
        ))}
      </div>
    </div>
  );
}
