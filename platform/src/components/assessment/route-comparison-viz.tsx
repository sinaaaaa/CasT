"use client";

import { ArrowRight, Compass } from "lucide-react";
import type {
  OptimalRouteVariant,
  PathState,
  RouteComparison,
} from "@/lib/assessment/assessmentTypes";
import {
  facingToLabel,
  formatGridCell,
  isOptimalRouteAvailable,
  unreachableReasonHint,
} from "@/lib/assessment/routeAnalysis";
import { CommandIconSequence } from "@/components/assessment/command-icon-sequence";
import type { CommandToken } from "@/lib/command-icons";
import { GRID_COLS, GRID_ROWS } from "@/lib/level-editor-constants";
import {
  AssessmentGridMap,
  GridMapLegend,
  RouteMapAnchorBar,
  type AssessmentGridMapProps,
} from "@/components/assessment/assessment-grid-map";
import type { GridObjectMarker } from "@/lib/assessment/assessmentConfig";

type Props = {
  comparison: RouteComparison;
  /** When set (edit-starter levels), show a third map for the level starter program path. */
  starterPath?: { x: number; y: number }[];
  starterPathStates?: PathState[];
  goalLabel?: string;
  objectMarkers?: GridObjectMarker[];
};

type CellKind = "empty" | "path" | "start" | "goal" | "collision";

const FACING_ARROW: Record<string, string> = {
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
};

function asTokens(commands: string[] | undefined): CommandToken[] {
  if (!commands?.length) return [];
  return commands.filter((c): c is CommandToken =>
    ["forward", "backward", "turn left", "turn right"].includes(c)
  );
}

/** Latest facing and step order at each cell (turns update facing without moving). */
function pathCellMeta(pathStates: PathState[] | undefined): {
  facing: Map<string, string>;
  step: Map<string, number>;
} {
  const facing = new Map<string, string>();
  const step = new Map<string, number>();
  if (!pathStates?.length) return { facing, step };
  pathStates.forEach((s, i) => {
    const k = `${s.position.x},${s.position.y}`;
    facing.set(k, facingToLabel(s.facing));
    step.set(k, i);
  });
  return { facing, step };
}

function buildCells(
  pathSet: Set<string>,
  collisionSet: Set<string>,
  startSet: Set<string>,
  goalSet: Set<string>,
  facingMap: Map<string, string>,
  stepMap: Map<string, number>
) {
  const cells: { x: number; y: number; kind: CellKind; facing?: string; step?: number }[] = [];
  for (let y = GRID_ROWS - 1; y >= 0; y--) {
    for (let x = 0; x < GRID_COLS; x++) {
      const k = `${x},${y}`;
      let kind: CellKind = "empty";
      if (collisionSet.has(k)) kind = "collision";
      else if (startSet.has(k)) kind = "start";
      else if (goalSet.has(k)) kind = "goal";
      else if (pathSet.has(k)) kind = "path";
      cells.push({ x, y, kind, facing: facingMap.get(k), step: stepMap.get(k) });
    }
  }
  return cells;
}

function StartEndSummary({ comparison }: { comparison: RouteComparison }) {
  const endLabel =
    comparison.goalLabels.length > 1
      ? comparison.goalLabels.join(" → ")
      : comparison.goalLabels[0] ?? "goal";

  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Start</p>
        <p className="text-sm font-medium text-slate-900">
          {formatGridCell(comparison.routeStartPosition ?? comparison.startPosition)}
        </p>
        <p className="text-xs text-muted-foreground">Robo spawn (where the program begins)</p>
        <p className="flex items-center gap-1.5 text-sm text-slate-600">
          <Compass className="h-3.5 w-3.5" />
          Facing {comparison.startFacing}{" "}
          <span className="font-mono text-base">{FACING_ARROW[comparison.startFacing]}</span>
        </p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Item goal
        </p>
        <p className="text-sm font-medium text-slate-900">
          {formatGridCell(comparison.routeGoalPosition ?? comparison.endPosition)}
          <span className="ml-1 text-muted-foreground">({endLabel})</span>
        </p>
        <p className="text-xs text-muted-foreground">Item win cell (where the robot must finish)</p>
        {comparison.optimalEndFacing && (
          <p className="text-sm text-slate-600">
            Best route ends facing {comparison.optimalEndFacing}{" "}
            <span className="font-mono">{FACING_ARROW[comparison.optimalEndFacing]}</span>
          </p>
        )}
        <p className="text-sm text-slate-600">
          Student stopped at {formatGridCell(comparison.studentPath[comparison.studentPath.length - 1] ?? comparison.endPosition)}, facing {comparison.studentEndFacing}{" "}
          <span className="font-mono">{FACING_ARROW[comparison.studentEndFacing]}</span>
          {comparison.requiredEndFacing && (
            <span className="text-muted-foreground">
              {" "}
              · Required: {comparison.requiredEndFacing}{" "}
              {FACING_ARROW[comparison.requiredEndFacing]}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

function StepPoseList({
  commands,
  pathStates,
}: {
  commands: string[];
  pathStates?: PathState[];
}) {
  if (!pathStates?.length || commands.length === 0) return null;
  return (
    <ol className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
      {commands.map((cmd, i) => {
        const st = pathStates[i + 1];
        if (!st) return null;
        return (
          <li key={`${cmd}-${i}`}>
            <span className="font-medium text-slate-700">{cmd}</span>
            {" → "}
            {formatGridCell(st.position)}, facing {facingToLabel(st.facing)}{" "}
            <span className="font-mono">{FACING_ARROW[facingToLabel(st.facing)]}</span>
          </li>
        );
      })}
    </ol>
  );
}

function RouteMetrics({ comparison }: { comparison: RouteComparison }) {
  const items: { label: string; value: number; tone: string }[] = [];
  if (comparison.extraCommands > 0) {
    items.push({ label: "Extra commands", value: comparison.extraCommands, tone: "text-amber-800" });
  }
  if (comparison.extraTurns > 0) {
    items.push({ label: "Extra turns", value: comparison.extraTurns, tone: "text-amber-800" });
  }
  if (comparison.wrongTurns > 0) {
    items.push({ label: "Wall/edge bumps", value: comparison.wrongTurns, tone: "text-orange-800" });
  }
  if (comparison.collisions > 0) {
    items.push({ label: "Obstacle collisions", value: comparison.collisions, tone: "text-red-800" });
  }

  if (items.length === 0) {
    return (
      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        No extra commands, turns, or collisions compared with the best route.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item.label}
          className={`rounded-lg border bg-white px-3 py-1.5 text-sm font-medium ${item.tone}`}
        >
          {item.label}: <strong>{item.value}</strong>
        </span>
      ))}
    </div>
  );
}

export function MiniRouteMap(
  props: AssessmentGridMapProps & {
    goalLabel?: string;
    studentEndPosition?: { x: number; y: number } | null;
    objectMarkers?: GridObjectMarker[];
  }
) {
  return <AssessmentGridMap {...props} />;
}

function AlternativeRoutesList({
  routes,
  totalCount,
}: {
  routes?: OptimalRouteVariant[];
  totalCount?: number;
}) {
  if (!routes?.length && (totalCount ?? 0) <= 1) return null;
  const shown = routes ?? [];
  const extra = Math.max(0, (totalCount ?? shown.length + 1) - 1 - shown.length);

  return (
    <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-2 text-xs text-amber-950">
      <p className="font-semibold">
        {totalCount ?? shown.length + 1} shortest route
        {(totalCount ?? 0) === 1 ? "" : "s"} exist for this level
      </p>
      <p className="mt-0.5 text-amber-900/90">
        Showing the preferred shortest program above
        {shown.length > 0 ? ` · ${shown.length} other variant${shown.length === 1 ? "" : "s"}:` : ""}
        {extra > 0 ? ` · ${extra} more not listed` : ""}
      </p>
      {shown.length > 0 && (
        <ul className="mt-2 space-y-2">
          {shown.map((r, i) => (
            <li key={i} className="rounded border border-amber-200/60 bg-white/80 p-2">
              <p className="mb-1 font-medium">Variant {i + 2}</p>
              <CommandIconSequence
                commands={r.commands.filter((c): c is CommandToken =>
                  ["forward", "backward", "turn left", "turn right"].includes(c)
                )}
                size={32}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CombinedComparisonMap({ comparison }: { comparison: RouteComparison }) {
  const student = new Set(comparison.studentPath.map((p) => `${p.x},${p.y}`));
  const optimal = new Set(comparison.optimalPath.map((p) => `${p.x},${p.y}`));
  const collision = new Set(comparison.collisionPoints.map((p) => `${p.x},${p.y}`));
  const startPos = comparison.routeStartPosition ?? comparison.startPosition;
  const goalPos = comparison.routeGoalPosition ?? comparison.endPosition;
  const start = `${startPos.x},${startPos.y}`;
  const goals = new Set([`${goalPos.x},${goalPos.y}`]);
  const hasOptimal = comparison.optimalPath.length > 0;

  const cells: { x: number; y: number; kind: string }[] = [];
  for (let y = GRID_ROWS - 1; y >= 0; y--) {
    for (let x = 0; x < GRID_COLS; x++) {
      const k = `${x},${y}`;
      let kind = "empty";
      if (k === start) kind = "start";
      else if (goals.has(k)) kind = "goal";
      else if (collision.has(k)) kind = "collision";
      else if (student.has(k) && optimal.has(k)) kind = "both";
      else if (student.has(k)) kind = "student";
      else if (hasOptimal && optimal.has(k)) kind = "best";
      cells.push({ x, y, kind });
    }
  }

  const tone: Record<string, string> = {
    empty: "bg-slate-50",
    start: "bg-lime-400 ring-1 ring-lime-700",
    goal: "bg-violet-500 ring-1 ring-violet-800",
    both: "bg-emerald-500",
    student: "bg-sky-500",
    best: "bg-amber-400",
    collision: "bg-red-600",
  };

  return (
    <div className="rounded-xl border bg-slate-50/80 p-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Overlay — how they compare
      </p>
      <div
        className="inline-grid gap-0.5 rounded-lg border bg-white p-2 shadow-sm"
        style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1.75rem)` }}
      >
        {cells.map((c) => (
          <div key={`o-${c.x}-${c.y}`} className={`h-7 w-7 rounded-sm ${tone[c.kind]}`} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-lime-400" /> Start
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-violet-500" /> Goal
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-sky-500" /> Student only
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-amber-400" /> Best route only
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-emerald-500" /> Same step
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-red-600" /> Collision
        </span>
      </div>
    </div>
  );
}

/** Fill metrics added in newer assessments when loading older persisted JSON. */
function withRouteDefaults(c: RouteComparison): RouteComparison {
  return {
    ...c,
    studentCommands: c.studentCommands ?? [],
    optimalCommands: c.optimalCommands ?? [],
    extraCommands: c.extraCommands ?? Math.max(0, c.studentCommandCount - c.optimalCommandCount),
    extraTurns: c.extraTurns ?? 0,
    studentTurnCount: c.studentTurnCount ?? 0,
    optimalTurnCount: c.optimalTurnCount ?? 0,
    wrongTurns: c.wrongTurns ?? 0,
    collisions: c.collisions ?? c.collisionPoints?.length ?? 0,
    routeStartPosition:
      c.routeStartPosition ?? c.startPosition ?? c.studentPath[0] ?? { x: 0, y: 0 },
    routeGoalPosition:
      c.routeGoalPosition ?? c.endPosition ?? c.goalPositions?.[0] ?? { x: 0, y: 0 },
    startPosition:
      c.routeStartPosition ?? c.startPosition ?? c.studentPath[0] ?? { x: 0, y: 0 },
    startFacing: c.startFacing ?? "up",
    endPosition:
      c.routeGoalPosition ?? c.endPosition ?? c.goalPositions?.[0] ?? { x: 0, y: 0 },
    studentEndFacing: c.studentEndFacing ?? "up",
    optimalEndFacing: c.optimalEndFacing,
    goalPositions: c.goalPositions ?? [],
    goalLabels: c.goalLabels ?? [],
    studentPathStates: c.studentPathStates ?? [],
    optimalPathStates: c.optimalPathStates ?? [],
    alternativeOptimalRoutes: c.alternativeOptimalRoutes,
    totalOptimalRouteCount: c.totalOptimalRouteCount,
    optimalReachable: c.optimalReachable,
    unreachableReason: c.unreachableReason,
  };
}

/** Student vs best route — programs, maps, and efficiency metrics. */
export function RouteComparisonViz({
  comparison: raw,
  starterPath,
  starterPathStates,
  goalLabel: goalLabelProp,
  objectMarkers = [],
}: Props) {
  const comparison = withRouteDefaults(raw);
  const hasBest = isOptimalRouteAvailable(comparison);
  const showStarter = (starterPath?.length ?? 0) > 0;
  const routeStart = comparison.routeStartPosition;
  const routeGoal = comparison.routeGoalPosition;
  const goalLabel = goalLabelProp ?? comparison.goalLabels[0] ?? "goal";
  const studentEnd =
    comparison.studentPath.length > 0
      ? comparison.studentPath[comparison.studentPath.length - 1]
      : null;
  const unreachableHint = unreachableReasonHint(comparison.unreachableReason);
  const studentTokens = asTokens(comparison.studentCommands);
  const optimalTokens = asTokens(comparison.optimalCommands);
  const extra = comparison.extraCommands;
  const sameLength = hasBest && comparison.studentCommandCount === comparison.optimalCommandCount;

  return (
    <div className="space-y-5">
      <StartEndSummary comparison={comparison} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-sky-200 bg-sky-50/30 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-900">
            Student route
          </p>
          <CommandIconSequence commands={studentTokens} size={40} />
            <p className="mt-2 text-xs text-muted-foreground">
              {comparison.studentCommandCount} command
              {comparison.studentCommandCount === 1 ? "" : "s"}
              {comparison.studentTurnCount > 0 &&
                ` · ${comparison.studentTurnCount} turn${comparison.studentTurnCount === 1 ? "" : "s"}`}
            </p>
            <StepPoseList
              commands={comparison.studentCommands}
              pathStates={comparison.studentPathStates}
            />
          </div>
        {hasBest ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-900">
              Best route
            </p>
            <CommandIconSequence commands={optimalTokens} size={40} />
            <p className="mt-2 text-xs text-muted-foreground">
              {comparison.optimalCommandCount} command
              {comparison.optimalCommandCount === 1 ? "" : "s"}
              {comparison.optimalTurnCount > 0 &&
                ` · ${comparison.optimalTurnCount} turn${comparison.optimalTurnCount === 1 ? "" : "s"}`}
            </p>
            {comparison.requiredEndFacing && (
              <p className="mt-1 text-xs text-amber-900">
                Item requires finishing facing {comparison.requiredEndFacing}{" "}
                {FACING_ARROW[comparison.requiredEndFacing]} — a final turn at the goal may be
                part of the shortest valid program.
              </p>
            )}
            <StepPoseList
              commands={comparison.optimalCommands}
              pathStates={comparison.optimalPathStates}
            />
            <AlternativeRoutesList
              routes={comparison.alternativeOptimalRoutes}
              totalCount={comparison.totalOptimalRouteCount}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/30 p-6 text-sm text-amber-900">
            <p className="font-medium">
              Shortest command sequence could not be computed for this layout.
            </p>
            {unreachableHint ? (
              <p className="mt-2 text-xs text-amber-800/90">{unreachableHint}</p>
            ) : (
              <p className="mt-2 text-xs text-amber-800/90">
                Check that the item has an end object or goal cell, the robot spawn is valid, and
                obstacles do not block every path to the goal.
              </p>
            )}
          </div>
        )}
      </div>

      <RouteMetrics comparison={comparison} />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="min-w-[7rem] text-center">
          <p className="text-xs uppercase text-muted-foreground">Student</p>
          <p className="text-2xl font-bold text-sky-700">{comparison.studentCommandCount}</p>
          <p className="text-xs text-muted-foreground">commands</p>
        </div>
        {hasBest && (
          <>
            <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-[7rem] text-center">
              <p className="text-xs uppercase text-muted-foreground">Best route</p>
              <p className="text-2xl font-bold text-amber-700">{comparison.optimalCommandCount}</p>
              <p className="text-xs text-muted-foreground">commands (BFS)</p>
            </div>
            <div className="ml-auto rounded-lg bg-slate-100 px-3 py-2 text-sm">
              {sameLength && comparison.extraTurns === 0 ? (
                <span className="font-medium text-emerald-800">Same program length — efficient</span>
              ) : extra > 0 ? (
                <span>
                  <strong className="text-amber-800">+{extra}</strong> extra command
                  {extra === 1 ? "" : "s"}
                  {comparison.extraTurns > 0 &&
                    ` · +${comparison.extraTurns} turn${comparison.extraTurns === 1 ? "" : "s"}`}
                </span>
              ) : comparison.extraTurns > 0 ? (
                <span>
                  <strong className="text-amber-800">+{comparison.extraTurns}</strong> extra turn
                  {comparison.extraTurns === 1 ? "" : "s"}
                </span>
              ) : (
                <span className="text-emerald-800">Shorter than reference</span>
              )}
            </div>
          </>
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <RouteMapAnchorBar
          routeStartPosition={routeStart}
          routeGoalPosition={routeGoal}
          goalLabel={goalLabel}
          studentEndPosition={studentEnd}
        />
        <GridMapLegend />
        <div
          className={`grid gap-4 ${
            showStarter && hasBest
              ? "md:grid-cols-3"
              : showStarter || hasBest
                ? "md:grid-cols-2"
                : "max-w-md"
          }`}
        >
          {showStarter && starterPath && (
            <MiniRouteMap
              title="Starter program path"
              subtitle="Initial yellow-strip program"
              path={starterPath}
              pathStates={starterPathStates}
              collisions={[]}
              pathClass="bg-slate-500"
              borderClass="border-slate-300 bg-white"
              routeStartPosition={routeStart}
              routeGoalPosition={routeGoal}
              goalLabel={goalLabel}
              objectMarkers={objectMarkers}
              studentEndPosition={
                starterPath.length > 0 ? starterPath[starterPath.length - 1] : null
              }
            />
          )}
          <MiniRouteMap
            title="Student path"
            subtitle="Student’s edited program"
            path={comparison.studentPath}
            pathStates={comparison.studentPathStates}
            collisions={comparison.collisionPoints}
            pathClass="bg-sky-500"
            borderClass="border-sky-200 bg-white"
            routeStartPosition={routeStart}
            routeGoalPosition={routeGoal}
            goalLabel={goalLabel}
            objectMarkers={objectMarkers}
            studentEndPosition={studentEnd}
          />
          {hasBest ? (
            <MiniRouteMap
              title="Best path"
              subtitle="Shortest command sequence"
              path={comparison.optimalPath}
              pathStates={comparison.optimalPathStates}
              collisions={[]}
              pathClass="bg-amber-400"
              borderClass="border-amber-200 bg-white"
              routeStartPosition={routeStart}
              routeGoalPosition={routeGoal}
              goalLabel={goalLabel}
              objectMarkers={objectMarkers}
              studentEndPosition={routeGoal}
            />
          ) : null}
        </div>
      </div>

      {comparison.studentPath.length > 0 && <CombinedComparisonMap comparison={comparison} />}
    </div>
  );
}
