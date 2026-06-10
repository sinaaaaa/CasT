"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import type { PathState, Vec2 } from "@/lib/assessment/assessmentTypes";
import type { GridObjectMarker } from "@/lib/assessment/assessmentConfig";
import { facingToLabel, formatGridCell } from "@/lib/assessment/routeAnalysis";
import { GRID_COLS, GRID_ROWS, OBJECT_PALETTE } from "@/lib/level-editor-constants";
import { cn } from "@/lib/utils";

const CELL_PX = 28;
const GAP_PX = 2;
const PAD_PX = 6;
const STEP_MS = 0.065;

type CellKind =
  | "empty"
  | "path"
  | "start"
  | "goal"
  | "collision"
  | "studentEnd"
  | "obstacle"
  | "obstacleHit";

const FACING_ARROW: Record<string, string> = {
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
};

function objectIcon(type: string): string {
  return OBJECT_PALETTE.find((p) => p.type === type)?.icon ?? "📍";
}

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

/** Pixel center of a grid cell for SVG overlays */
function cellCenter(x: number, y: number): { cx: number; cy: number } {
  const row = GRID_ROWS - 1 - y;
  return {
    cx: PAD_PX + x * (CELL_PX + GAP_PX) + CELL_PX / 2,
    cy: PAD_PX + row * (CELL_PX + GAP_PX) + CELL_PX / 2,
  };
}

function buildCells(
  pathSet: Set<string>,
  collisionSet: Set<string>,
  obstacleSet: Set<string>,
  obstacleHitKey: string | null,
  startKey: string,
  goalKey: string,
  studentEndKey: string | null,
  facingMap: Map<string, string>,
  stepMap: Map<string, number>
) {
  const cells: {
    x: number;
    y: number;
    kind: CellKind;
    facing?: string;
    step?: number;
  }[] = [];

  for (let y = GRID_ROWS - 1; y >= 0; y--) {
    for (let x = 0; x < GRID_COLS; x++) {
      const k = `${x},${y}`;
      let kind: CellKind = "empty";
      if (k === obstacleHitKey) kind = "obstacleHit";
      else if (collisionSet.has(k)) kind = "collision";
      else if (obstacleSet.has(k)) kind = "obstacle";
      else if (k === goalKey) kind = "goal";
      else if (k === startKey) kind = "start";
      else if (studentEndKey && k === studentEndKey) kind = "studentEnd";
      else if (pathSet.has(k)) kind = "path";
      cells.push({ x, y, kind, facing: facingMap.get(k), step: stepMap.get(k) });
    }
  }
  return cells;
}

function pathPolylinePoints(path: Vec2[]): string {
  if (path.length < 2) return "";
  return path
    .map((p) => {
      const { cx, cy } = cellCenter(p.x, p.y);
      return `${cx},${cy}`;
    })
    .join(" ");
}

export function GridMapLegend({ compact }: { compact?: boolean }) {
  const items = [
    { swatch: "bg-lime-400 ring-2 ring-lime-700", label: "Robot start" },
    { swatch: "bg-violet-500 ring-2 ring-violet-800", label: "Item goal (win cell)" },
    { swatch: "bg-sky-400 ring-2 ring-sky-700", label: "Where program stopped" },
    { swatch: "bg-slate-500", label: "Path" },
    { swatch: "bg-stone-600 ring-2 ring-stone-800", label: "Obstacle" },
    { swatch: "bg-red-600 ring-2 ring-red-800", label: "Hit obstacle" },
  ];
  return (
    <div
      className={cn(
        "flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground",
        compact && "gap-x-3"
      )}
    >
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className={cn("inline-block h-3 w-3 rounded-sm", item.swatch)} />
          {item.label}
        </span>
      ))}
      <span className="text-muted-foreground/80">· Row 1 = bottom · Col A = left</span>
    </div>
  );
}

export function RouteMapAnchorBar({
  routeStartPosition,
  routeGoalPosition,
  goalLabel,
  studentEndPosition,
}: {
  routeStartPosition: Vec2;
  routeGoalPosition: Vec2;
  goalLabel: string;
  studentEndPosition?: Vec2 | null;
}) {
  const atGoal =
    studentEndPosition &&
    studentEndPosition.x === routeGoalPosition.x &&
    studentEndPosition.y === routeGoalPosition.y;

  return (
    <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2.5 text-xs sm:grid-cols-3">
      <div>
        <span className="font-semibold text-lime-800">Start </span>
        <span className="text-slate-700">{formatGridCell(routeStartPosition)}</span>
        <span className="block text-muted-foreground">Robot spawn</span>
      </div>
      <div>
        <span className="font-semibold text-violet-800">Goal </span>
        <span className="text-slate-700">{formatGridCell(routeGoalPosition)}</span>
        <span className="block capitalize text-muted-foreground">{goalLabel}</span>
      </div>
      <div>
        <span className="font-semibold text-sky-800">Program stop </span>
        {studentEndPosition ? (
          <>
            <span className="text-slate-700">{formatGridCell(studentEndPosition)}</span>
            <span className="block text-muted-foreground">
              {atGoal ? "On goal — success" : "Not on goal cell"}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}

export type AssessmentGridMapProps = {
  title: string;
  subtitle: string;
  path: Vec2[];
  pathStates?: PathState[];
  collisions: Vec2[];
  pathClass: string;
  borderClass: string;
  routeStartPosition: Vec2;
  routeGoalPosition: Vec2;
  goalLabel?: string;
  studentEndPosition?: Vec2 | null;
  objectMarkers?: GridObjectMarker[];
  highlightStep?: number | null;
  fadeAfterStep?: number | null;
  pulseGoal?: boolean;
  dimmed?: boolean;
  /** Cell the robot tried to enter (obstacle collision). */
  attemptedObstacleCell?: Vec2 | null;
  /** Staggered path draw + cell reveal (default on when path has steps). */
  animatePath?: boolean;
};

export function AssessmentGridMap({
  title,
  subtitle,
  path,
  pathStates,
  collisions,
  pathClass,
  borderClass,
  routeStartPosition,
  routeGoalPosition,
  goalLabel = "goal",
  studentEndPosition,
  objectMarkers = [],
  highlightStep = null,
  fadeAfterStep = null,
  pulseGoal = false,
  dimmed = false,
  attemptedObstacleCell = null,
  animatePath = true,
}: AssessmentGridMapProps) {
  const reduceMotion = useReducedMotion();
  const shouldAnimate = animatePath && !reduceMotion && path.length > 1;

  const pathSet = new Set(path.map((p) => `${p.x},${p.y}`));
  const collisionSet = new Set(collisions.map((p) => `${p.x},${p.y}`));
  const startKey = `${routeStartPosition.x},${routeStartPosition.y}`;
  const goalKey = `${routeGoalPosition.x},${routeGoalPosition.y}`;
  const stop =
    studentEndPosition ?? (path.length > 0 ? path[path.length - 1] : null);
  const studentEndKey =
    stop && `${stop.x},${stop.y}` !== goalKey ? `${stop.x},${stop.y}` : null;

  const objectByCell = new Map<string, GridObjectMarker>();
  const obstacleSet = new Set<string>();
  for (const o of objectMarkers) {
    const k = `${o.position.x},${o.position.y}`;
    objectByCell.set(k, o);
    if (o.role === "block") obstacleSet.add(k);
  }

  const obstacleHitKey = attemptedObstacleCell
    ? `${attemptedObstacleCell.x},${attemptedObstacleCell.y}`
    : null;

  const { facing: facingMap, step: stepMap } = pathCellMeta(pathStates);
  const cells = buildCells(
    pathSet,
    collisionSet,
    obstacleSet,
    obstacleHitKey,
    startKey,
    goalKey,
    studentEndKey,
    facingMap,
    stepMap
  );

  const polyline = useMemo(() => pathPolylinePoints(path), [path]);
  const gridW = PAD_PX * 2 + GRID_COLS * CELL_PX + (GRID_COLS - 1) * GAP_PX;
  const gridH = PAD_PX * 2 + GRID_ROWS * CELL_PX + (GRID_ROWS - 1) * GAP_PX;

  const pathStroke =
    pathClass.includes("sky") ? "#0ea5e9"
    : pathClass.includes("emerald") ? "#10b981"
    : pathClass.includes("amber") ? "#f59e0b"
    : "#64748b";

  const cellTone: Record<CellKind, string> = {
    empty: "bg-slate-100",
    path: pathClass,
    start: "bg-lime-400 ring-2 ring-lime-700",
    goal: "bg-violet-500 ring-2 ring-violet-800",
    studentEnd: "bg-sky-400 ring-2 ring-sky-600",
    collision: "bg-red-500 ring-1 ring-red-700",
    obstacle: "bg-stone-600 ring-2 ring-stone-800",
    obstacleHit: "bg-red-600 ring-2 ring-red-800",
  };

  const maxPathStep = path.length > 0 ? path.length - 1 : 0;

  return (
    <motion.div
      layout
      initial={false}
      animate={{ opacity: dimmed ? 0.42 : 1, scale: dimmed ? 0.98 : 1 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "rounded-xl border-2 p-3",
        borderClass,
        highlightStep != null && !dimmed && "ring-2 ring-sky-300/50 ring-offset-1"
      )}
    >
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="text-xs text-muted-foreground">
        {subtitle}
        <span className="ml-1 text-violet-700">· Goal: {goalLabel}</span>
      </p>

      <div
        className="relative mt-3 inline-block rounded-md bg-white p-1.5 shadow-inner"
        style={{ width: gridW, height: gridH }}
      >
        {shouldAnimate && polyline && (
          <svg
            className="pointer-events-none absolute inset-0 z-0"
            width={gridW}
            height={gridH}
            aria-hidden
          >
            <motion.polyline
              key={polyline}
              points={polyline}
              fill="none"
              stroke={pathStroke}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="6 4"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.55 }}
              transition={{
                pathLength: {
                  duration: Math.min(1.8, 0.35 + maxPathStep * STEP_MS),
                  ease: [0.22, 1, 0.36, 1],
                },
                opacity: { duration: 0.3 },
              }}
            />
          </svg>
        )}

        <div
          className="relative z-10 inline-grid gap-0.5"
          style={{ gridTemplateColumns: `repeat(${GRID_COLS}, ${CELL_PX}px)` }}
        >
          {cells.map((c) => {
            const k = `${c.x},${c.y}`;
            const obj = objectByCell.get(k);
            const showObject =
              obj && c.kind !== "goal" && c.kind !== "start" && c.kind !== "obstacleHit";
            const showObstacleWarning = c.kind === "obstacleHit";
            const stepIdx = c.step ?? 0;
            const onPath =
              c.kind === "path" ||
              c.kind === "start" ||
              c.kind === "goal" ||
              c.kind === "studentEnd";
            const faded =
              fadeAfterStep != null &&
              stepIdx > fadeAfterStep &&
              (c.kind === "path" || c.kind === "goal");
            const highlighted = highlightStep != null && stepIdx === highlightStep;
            const isGoal = c.kind === "goal";
            const staggerDelay =
              onPath && c.step != null && c.step > 0
                ? c.step * STEP_MS
                : isGoal
                  ? maxPathStep * STEP_MS + 0.08
                  : 0;

            return (
              <GridCell
                key={`${title}-${c.x}-${c.y}`}
                kind={c.kind}
                tone={cellTone[c.kind]}
                facing={c.facing}
                step={c.step}
                showObject={showObject}
                objectLabel={obj?.label}
                title={
                  obj
                    ? `${obj.label} (${obj.role})`
                    : c.kind === "goal"
                      ? `Goal: ${goalLabel}`
                      : c.kind === "start"
                        ? "Robot start"
                        : c.kind === "studentEnd"
                          ? "Program stopped here"
                          : undefined
                }
                faded={faded}
                highlighted={highlighted}
                pulseGoal={pulseGoal && isGoal}
                showObstacleWarning={showObstacleWarning}
                animate={shouldAnimate && onPath}
                staggerDelay={staggerDelay}
                reduceMotion={!!reduceMotion}
              />
            );
          })}
        </div>
      </div>

      {path.length === 0 && (
        <p className="mt-2 text-xs text-amber-700">No path to display for this program.</p>
      )}
    </motion.div>
  );
}

function GridCell({
  kind,
  tone,
  facing,
  step,
  showObject,
  objectLabel,
  title,
  faded,
  highlighted,
  pulseGoal,
  showObstacleWarning,
  animate,
  staggerDelay,
  reduceMotion,
}: {
  kind: CellKind;
  tone: string;
  facing?: string;
  step?: number;
  showObject?: boolean;
  objectLabel?: string;
  title?: string;
  faded: boolean;
  highlighted: boolean;
  pulseGoal: boolean;
  showObstacleWarning?: boolean;
  animate: boolean;
  staggerDelay: number;
  reduceMotion: boolean;
}) {
  const showStep = step != null && step > 0 && (kind === "path" || kind === "goal");
  const showFacing =
    facing && (kind === "path" || kind === "start" || kind === "goal");

  return (
    <motion.div
      title={title}
      initial={
        animate && !reduceMotion
          ? { opacity: 0, scale: 0.72 }
          : { opacity: 1, scale: 1 }
      }
      animate={{
        opacity: faded ? 0.28 : 1,
        scale: highlighted ? 1.12 : 1,
        boxShadow: highlighted
          ? "0 0 0 2px rgb(56 189 248), 0 4px 12px rgba(14,165,233,0.35)"
          : pulseGoal
            ? [
                "0 0 0 0 rgba(139,92,246,0.4)",
                "0 0 14px 4px rgba(139,92,246,0.45)",
                "0 0 0 0 rgba(139,92,246,0.4)",
              ]
            : "0 0 0 0 transparent",
      }}
      transition={{
        opacity: { duration: 0.45, ease: "easeOut" },
        scale: {
          type: "spring",
          stiffness: 420,
          damping: 28,
          mass: 0.6,
        },
        boxShadow: pulseGoal
          ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
          : { duration: 0.25 },
        delay: animate && !reduceMotion ? staggerDelay : 0,
      }}
      className={cn(
        "relative flex h-7 w-7 items-center justify-center rounded-sm",
        tone
      )}
    >
      {showObject && objectLabel && (
        <span className="absolute bottom-0 right-0 text-[10px] leading-none opacity-90">
          {objectIcon(objectLabel)}
        </span>
      )}
      {showStep && (
        <motion.span
          initial={animate ? { opacity: 0, y: -4 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: staggerDelay + 0.05, duration: 0.2 }}
          className="absolute left-0 top-0 rounded-br bg-black/55 px-0.5 text-[8px] font-bold text-white"
        >
          {step}
        </motion.span>
      )}
      {showFacing && (
        <motion.span
          initial={animate ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ delay: staggerDelay + 0.08, duration: 0.25 }}
          className="text-[11px] font-bold leading-none text-white drop-shadow-sm"
        >
          {FACING_ARROW[facing]}
        </motion.span>
      )}
      {showObstacleWarning && (
        <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-red-900 shadow-sm">
          <AlertTriangle className="h-2.5 w-2.5" aria-hidden />
        </span>
      )}
    </motion.div>
  );
}
