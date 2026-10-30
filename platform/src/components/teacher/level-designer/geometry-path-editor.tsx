"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ClipboardCheck,
  Eraser,
  Flag,
  MapPin,
  Pencil,
  PencilLine,
  Puzzle,
  Redo2,
  RotateCcw,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import { CommandGlyph, commandGlyphSrc } from "@/components/assessment/command-glyph";
import type { LevelGameplayConfig } from "@/lib/level-config";
import {
  DEFAULT_GEOMETRY_COLORS,
  GEOMETRY_AFTER_SHAPE_LABELS,
  GEOMETRY_SHAPE_LABELS,
  GEOMETRY_VALIDATION_HELP,
  GEOMETRY_VALIDATION_LABELS,
  addSegment,
  areAdjacent,
  buildGeometryAuthoringSummary,
  generateShapeSegments,
  geometryRequiresDestination,
  hasSegment,
  isGeometryDrawPath,
  removeSegment,
  sanitizeGeometryStarter,
  segmentKey,
  syncGeometryPathToolsToConfig,
  type GeometryAfterShapeBehavior,
  type GeometryPathConfig,
  type GeometryShapeType,
  type GeometryValidationMode,
  type PathSegment,
} from "@/lib/geometry-path";
import {
  geometryProgramPathSegments,
  programTokensFromGeometryShape,
  withGeometryShapeProgram,
} from "@/lib/geometry-program-path";
import {
  parseCommandBagToken,
  parseCommandChunkToken,
} from "@/lib/level-config";
import { parseRepeatStart } from "@/lib/assessment/expand-repeats";
import { GRID_COLS, GRID_ROWS, OBJECT_PALETTE } from "@/lib/level-editor-constants";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  config: LevelGameplayConfig;
  onChange: (c: LevelGameplayConfig) => void;
  /** Hide the PROGRAM / DRAW_PATH switch — the catalog already chose the student job. */
  lockStudentTask?: boolean;
};

type DrawMode = "draw" | "erase" | "start" | "destination";

const FACINGS = [
  { id: "up", label: "Up", vec: { x: 0, y: 1 }, Icon: ArrowUp },
  { id: "right", label: "Right", vec: { x: 1, y: 0 }, Icon: ArrowRight },
  { id: "down", label: "Down", vec: { x: 0, y: -1 }, Icon: ArrowDown },
  { id: "left", label: "Left", vec: { x: -1, y: 0 }, Icon: ArrowLeft },
] as const;

const DEST_OBJECT_OPTIONS = [
  { type: "", label: "Cell only (no object)" },
  ...OBJECT_PALETTE.filter((p) =>
    ["bed", "apple", "home", "school", "bin", "box", "backpack", "book", "chair"].includes(p.type)
  ).map((p) => ({ type: p.type, label: `${p.icon} ${p.label}` })),
];

function patchGeometry(
  config: LevelGameplayConfig,
  patch: Partial<GeometryPathConfig>
): LevelGameplayConfig {
  const nextGp: GeometryPathConfig = {
    enabled: true,
    shapeType: "CUSTOM",
    segments: [],
    drawRobotTrail: true,
    keepShapeVisibleDuringRun: false,
    ...DEFAULT_GEOMETRY_COLORS,
    validationMode: "TRACE_TARGET",
    afterShapeBehavior: "SHAPE_COMPLETE",
    requireFinishFacing: false,
    studentTask: "PROGRAM",
    seedStarterProgram: false,
    requireRepeat: false,
    requireActionChunk: false,
    requireCommandBag: false,
    templateSize: 2,
    templateWidth: 3,
    templateHeight: 2,
    ...config.geometryPath,
    ...patch,
    tools: {
      individualCommands: true,
      repeat: false,
      actionChunks: false,
      commandBags: false,
      ...config.geometryPath?.tools,
      ...patch.tools,
    },
  };
  const synced = syncGeometryPathToolsToConfig(nextGp.tools);
  let next: LevelGameplayConfig = {
    ...config,
    geometryPath: nextGp,
    enabledActionButtons: synced.enabledActionButtons,
    commandBagMode: synced.commandBagMode,
  };
  next = syncDestinationVisuals(next, nextGp);
  return next;
}

/** Keep goalCell + end object in sync with geometry destination for Unity visuals. */
function syncDestinationVisuals(
  config: LevelGameplayConfig,
  gp: GeometryPathConfig
): LevelGameplayConfig {
  const requiresDest = geometryRequiresDestination(gp);
  const finish = requiresDest ? gp.finishCell : undefined;
  const objType = requiresDest ? gp.finishObjectType?.trim() : undefined;

  let gridObjects = [...(config.gridObjects ?? [])].filter((o) => !o.isEndObject);
  if (finish && objType) {
    gridObjects = gridObjects.filter(
      (o) => !(o.position.x === finish.x && o.position.y === finish.y && !o.isStartObject)
    );
    gridObjects.push({
      position: { x: finish.x, y: finish.y },
      objectType: objType,
      isEndObject: true,
    });
  }

  return {
    ...config,
    geometryPath: gp,
    goalCell: finish ? { x: finish.x, y: finish.y } : undefined,
    blinkEndCells: !!finish,
    gridObjects,
  };
}

function cellCenterSvg(x: number, y: number): { cx: number; cy: number } {
  return { cx: x + 0.5, cy: GRID_ROWS - 0.5 - y };
}

/** Mini SVG preview of a template shape for thumbnail cards. */
function ShapeThumb({ shape }: { shape: GeometryShapeType }) {
  const segs =
    shape === "CUSTOM"
      ? [
          { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
          { from: { x: 1, y: 0 }, to: { x: 1, y: 1 } },
        ]
      : generateShapeSegments(shape, { x: 0, y: 0 }, 2, 3, 2).slice(0, 12);

  const pts = segs.flatMap((s) => [s.from, s.to]);
  const maxX = Math.max(2, ...pts.map((p) => p.x));
  const maxY = Math.max(2, ...pts.map((p) => p.y));
  const pad = 0.35;
  const vb = `${-pad} ${-pad} ${maxX + pad * 2} ${maxY + pad * 2}`;

  return (
    <svg viewBox={vb} className="h-10 w-14" aria-hidden>
      {segs.map((s, i) => (
        <line
          key={i}
          x1={s.from.x}
          y1={maxY - s.from.y}
          x2={s.to.x}
          y2={maxY - s.to.y}
          stroke="currentColor"
          strokeWidth={0.22}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
      <div>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function programChipLabel(token: string): string {
  if (token === "forward") return "Forward";
  if (token === "backward") return "Back";
  if (token === "turn left") return "Left";
  if (token === "turn right") return "Right";
  const repeat = parseRepeatStart(token);
  if (repeat != null) return `Repeat ×${repeat}`;
  if (token === "repeat-end") return "End";
  if (parseCommandChunkToken(token)) return "Chunk";
  if (parseCommandBagToken(token)) return "Bag";
  return token;
}

function ShownProgramStrip({ tokens }: { tokens: string[] }) {
  if (!tokens.length) {
    return (
      <p className="text-xs text-amber-900">
        Draw edges from the robot start and the command arrows will appear here.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {tokens.map((token, i) => (
        <span
          key={`${token}-${i}`}
          className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-1.5 py-1 text-[11px] font-semibold text-stone-800 shadow-sm"
          title={token}
        >
          {commandGlyphSrc(token) ? (
            <CommandGlyph token={token} size={18} framed={false} />
          ) : parseCommandChunkToken(token) ? (
            <Puzzle className="h-3.5 w-3.5 text-[#9E66EB]" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-stone-500" />
          )}
          {programChipLabel(token)}
        </span>
      ))}
    </div>
  );
}

export function GeometryPathEditor({ config, onChange, lockStudentTask = true }: Props) {
  const gp = config.geometryPath;
  const segments = gp?.segments ?? [];
  const [drawMode, setDrawMode] = useState<DrawMode>("draw");
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [history, setHistory] = useState<PathSegment[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const robot = config.robotStartPosition ?? { x: 1, y: 1 };
  const facing = config.robotStartFacing ?? { x: 1, y: 0 };
  const shapeColor = gp?.targetColor ?? DEFAULT_GEOMETRY_COLORS.targetColor;
  const trailColor = gp?.trailColor ?? DEFAULT_GEOMETRY_COLORS.trailColor;

  const commit = useCallback(
    (next: LevelGameplayConfig, syncProgram = false) => {
      onChange(syncProgram ? withGeometryShapeProgram(next) : next);
    },
    [onChange]
  );

  useEffect(() => {
    if ((config.geometryPath?.segments?.length ?? 0) > 0) return;
    const origin = config.geometryPath?.templateOrigin ?? config.robotStartPosition ?? { x: 1, y: 1 };
    const shape =
      config.geometryPath?.shapeType && config.geometryPath.shapeType !== "CUSTOM"
        ? config.geometryPath.shapeType
        : "SQUARE";
    const next = generateShapeSegments(
      shape,
      origin,
      config.geometryPath?.templateSize ?? 2,
      config.geometryPath?.templateWidth ?? 3,
      config.geometryPath?.templateHeight ?? 2
    );
    if (next.length === 0) return;
    commit(patchGeometry(config, { shapeType: shape, segments: next, templateOrigin: origin }), true);
    setHistory([next]);
    setHistoryIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once when empty
  }, []);

  const pushSegments = useCallback(
    (next: PathSegment[], shapeType: GeometryShapeType = "CUSTOM") => {
      commit(patchGeometry(config, { shapeType, segments: next }), true);
      setHistory((prev) => {
        const clipped = prev.slice(0, historyIndex + 1);
        const updated = [...clipped, next].slice(-40);
        setHistoryIndex(updated.length - 1);
        return updated;
      });
      setAnchor(null);
    },
    [commit, config, historyIndex]
  );

  const applyTemplate = useCallback(
    (shape: GeometryShapeType) => {
      if (shape === "CUSTOM") {
        commit(patchGeometry(config, { shapeType: "CUSTOM" }));
        return;
      }
      const origin = gp?.templateOrigin ?? robot;
      const next = generateShapeSegments(
        shape,
        origin,
        gp?.templateSize ?? 2,
        gp?.templateWidth ?? 3,
        gp?.templateHeight ?? 2
      );
      commit(
        patchGeometry(config, {
          shapeType: shape,
          segments: next,
          templateOrigin: origin,
        }),
        true
      );
      setHistory((prev) => {
        const clipped = prev.slice(0, historyIndex + 1);
        const updated = [...clipped, next].slice(-40);
        setHistoryIndex(updated.length - 1);
        return updated;
      });
      setAnchor(null);
    },
    [commit, config, gp, historyIndex, robot]
  );

  const refreshTemplate = useCallback(() => {
    const shape = gp?.shapeType && gp.shapeType !== "CUSTOM" ? gp.shapeType : "SQUARE";
    applyTemplate(shape);
  }, [applyTemplate, gp?.shapeType]);

  function undo() {
    if (historyIndex <= 0) return;
    const i = historyIndex - 1;
    setHistoryIndex(i);
    commit(patchGeometry(config, { shapeType: "CUSTOM", segments: history[i] ?? [] }), true);
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    const i = historyIndex + 1;
    setHistoryIndex(i);
    commit(patchGeometry(config, { shapeType: "CUSTOM", segments: history[i] ?? [] }), true);
  }

  function onCellPointer(x: number, y: number) {
    if (drawMode === "start") {
      commit({ ...config, robotStartPosition: { x, y } }, true);
      return;
    }

    if (drawMode === "destination") {
      onChange(
        patchGeometry(config, {
          afterShapeBehavior: "CONTINUE_TO_DESTINATION",
          finishCell: { x, y },
        })
      );
      return;
    }

    if (drawMode === "erase") {
      const next = segments.filter(
        (s) =>
          !(
            (s.from.x === x && s.from.y === y) ||
            (s.to.x === x && s.to.y === y)
          )
      );
      pushSegments(next, "CUSTOM");
      return;
    }

    if (!anchor) {
      setAnchor({ x, y });
      return;
    }
    if (anchor.x === x && anchor.y === y) {
      setAnchor(null);
      return;
    }
    if (!areAdjacent(anchor, { x, y })) {
      setAnchor({ x, y });
      return;
    }

    const seg: PathSegment = { from: anchor, to: { x, y } };
    const next = hasSegment(segments, seg)
      ? removeSegment(segments, seg)
      : addSegment(segments, seg);
    pushSegments(next, "CUSTOM");
    setAnchor({ x, y });
  }

  function onSegmentClick(seg: PathSegment, e: React.MouseEvent) {
    e.stopPropagation();
    pushSegments(removeSegment(segments, seg), "CUSTOM");
  }

  const summary = useMemo(() => buildGeometryAuthoringSummary(config), [config]);
  const drawPath = isGeometryDrawPath(gp);
  const predictedSegments = useMemo(
    () => (drawPath ? geometryProgramPathSegments(config) : []),
    [drawPath, config]
  );
  const shapeProgram = useMemo(
    () => (drawPath ? programTokensFromGeometryShape(config) : null),
    [drawPath, config]
  );
  const displaySegments = segments.length > 0 ? segments : predictedSegments;
  const authoredKeys = useMemo(
    () => new Set(segments.map((s) => segmentKey(s.from, s.to))),
    [segments]
  );
  const mode = (gp?.validationMode ?? "TRACE_TARGET") as GeometryValidationMode;
  const shape = (gp?.shapeType ?? "SQUARE") as GeometryShapeType;
  const afterShape = (gp?.afterShapeBehavior ?? "SHAPE_COMPLETE") as GeometryAfterShapeBehavior;
  const finishCell = gp?.finishCell;
  const finishFacing = gp?.finishFacing;
  const showDestination = afterShape === "CONTINUE_TO_DESTINATION" || geometryRequiresDestination(gp);

  const sizeField = (
    label: string,
    value: number,
    onVal: (n: number) => void
  ) => (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-700">
      {label}
      <input
        type="number"
        min={1}
        max={5}
        value={value}
        onChange={(e) => onVal(Math.min(5, Math.max(1, Number(e.target.value) || 1)))}
        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
      />
    </label>
  );

  function setStudentTask(next: "PROGRAM" | "DRAW_PATH") {
    if ((gp?.studentTask ?? "PROGRAM") === next) return;
    const seeded = next === "DRAW_PATH" ? true : !!gp?.seedStarterProgram;
    if (next === "DRAW_PATH") setDrawMode("draw");
    const nextHint =
      next === "DRAW_PATH"
        ? {
            enabled: true,
            title: config.cornerHint?.title || "Draw the path",
            body:
              config.cornerHint?.body && config.cornerHint.body !== "Make the robot follow the glowing path."
                ? config.cornerHint.body
                : "Look at the yellow-strip program, then draw the path it will take on the grid. Press RUN to watch the robot follow it.",
            imageUrl: config.cornerHint?.imageUrl,
            audioUrl: config.cornerHint?.audioUrl,
            playAudioAutomatically: config.cornerHint?.playAudioAutomatically,
          }
        : config.cornerHint;
    const shapePatch =
      next === "DRAW_PATH" && !(gp?.segments?.length)
        ? {
            shapeType: (gp?.shapeType && gp.shapeType !== "CUSTOM" ? gp.shapeType : "SQUARE") as GeometryShapeType,
            segments: generateShapeSegments(
              gp?.shapeType && gp.shapeType !== "CUSTOM" ? gp.shapeType : "SQUARE",
              gp?.templateOrigin ?? config.robotStartPosition ?? { x: 1, y: 1 },
              gp?.templateSize ?? 2,
              gp?.templateWidth ?? 3,
              gp?.templateHeight ?? 2
            ),
          }
        : {};
    const patched = patchGeometry(config, {
      studentTask: next,
      seedStarterProgram: seeded,
      keepShapeVisibleDuringRun: next === "DRAW_PATH" ? false : gp?.keepShapeVisibleDuringRun,
      afterShapeBehavior: next === "DRAW_PATH" ? "SHAPE_COMPLETE" : gp?.afterShapeBehavior,
      validationMode: next === "DRAW_PATH" ? "EXACT_PATH" : gp?.validationMode,
      ...shapePatch,
    });
    const withHint = nextHint ? { ...patched, cornerHint: nextHint } : patched;
    if (next === "DRAW_PATH") {
      commit(withHint, true);
      return;
    }
    commit({
      ...withHint,
      guidedActions:
        sanitizeGeometryStarter({ ...gp, seedStarterProgram: seeded, studentTask: next }, config.guidedActions) ??
        config.guidedActions,
    });
  }

  return (
    <div className="space-y-6">
      {!lockStudentTask && (
      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
        {(
          [
            {
              id: "PROGRAM" as const,
              title: "Trace with a program",
              hint: "Students write commands that follow this shape",
              Icon: Pencil,
            },
            {
              id: "DRAW_PATH" as const,
              title: "Draw the path",
              hint: "Students see the program and draw this shape",
              Icon: PencilLine,
            },
          ] as const
        ).map(({ id, title, hint, Icon }) => {
          const on = (gp?.studentTask ?? "PROGRAM") === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setStudentTask(id)}
              className={cn(
                "flex min-w-[12rem] flex-1 items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition",
                on ? "bg-white shadow-sm ring-1 ring-violet-200" : "hover:bg-white/70"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  on ? "bg-violet-600 text-white" : "bg-white text-slate-500"
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-bold text-slate-900">{title}</span>
                <span className="text-[11px] leading-snug text-slate-500">{hint}</span>
              </span>
            </button>
          );
        })}
      </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.85fr)]">
        {/* —— Canvas hero —— */}
        <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {drawPath ? "Draw the shape" : "Path canvas"}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {drawPath
                  ? "Draw or pick a shape. The yellow-strip program is generated from it. Students do not see this shape — they predict it from the program."
                  : "Draw edges between cells. This glowing path is what students must trace."}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                (drawPath
                  ? ([
                      ["draw", Pencil, "Draw"],
                      ["erase", Eraser, "Erase"],
                      ["start", MapPin, "Start"],
                    ] as const)
                  : ([
                      ["draw", Pencil, "Draw"],
                      ["erase", Eraser, "Erase"],
                      ["start", MapPin, "Start"],
                      ["destination", Flag, "Destination"],
                    ] as const))
              ).map(([id, Icon, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setDrawMode(id);
                    setAnchor(null);
                    if (id === "destination" && afterShape !== "CONTINUE_TO_DESTINATION") {
                      onChange(
                        patchGeometry(config, { afterShapeBehavior: "CONTINUE_TO_DESTINATION" })
                      );
                    }
                  }}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition",
                    drawMode === id
                      ? id === "destination"
                        ? "border-teal-600 bg-teal-600 text-white shadow-sm"
                        : id === "start"
                          ? "border-orange-500 bg-orange-500 text-white shadow-sm"
                          : "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={undo}
                disabled={historyIndex <= 0}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 disabled:opacity-40"
                title="Undo"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 disabled:opacity-40"
                title="Redo"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 rounded-xl"
                onClick={() => pushSegments([], "CUSTOM")}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </Button>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] p-2 sm:p-3">
            <svg
              viewBox={`0 0 ${GRID_COLS} ${GRID_ROWS}`}
              className="mx-auto aspect-square w-full max-w-[560px] touch-manipulation"
              role="img"
              aria-label="Geometry path grid"
            >
              {Array.from({ length: GRID_ROWS }).map((_, row) =>
                Array.from({ length: GRID_COLS }).map((__, col) => {
                  const y = GRID_ROWS - 1 - row;
                  const isRobot = robot.x === col && robot.y === y;
                  const isDest =
                    showDestination && finishCell?.x === col && finishCell?.y === y;
                  return (
                    <rect
                      key={`${col}-${y}`}
                      x={col}
                      y={row}
                      width={1}
                      height={1}
                      fill={
                        isDest
                          ? "rgba(13,148,136,0.22)"
                          : isRobot
                            ? "rgba(249,115,22,0.14)"
                            : "transparent"
                      }
                      stroke={isDest ? "#0d9488" : "#e2e8f0"}
                      strokeWidth={isDest ? 0.06 : 0.03}
                      className="cursor-pointer"
                      onClick={() => onCellPointer(col, y)}
                    />
                  );
                })
              )}

              {displaySegments.map((seg) => {
                const a = cellCenterSvg(seg.from.x, seg.from.y);
                const b = cellCenterSvg(seg.to.x, seg.to.y);
                const k = segmentKey(seg.from, seg.to);
                return (
                  <g key={k}>
                    <line
                      x1={a.cx}
                      y1={a.cy}
                      x2={b.cx}
                      y2={b.cy}
                      stroke={shapeColor}
                      strokeWidth={0.2}
                      strokeLinecap="round"
                      opacity={0.28}
                    />
                    <line
                      x1={a.cx}
                      y1={a.cy}
                      x2={b.cx}
                      y2={b.cy}
                      stroke={shapeColor}
                      strokeWidth={0.1}
                      strokeLinecap="round"
                      strokeDasharray="0.16 0.12"
                    />
                    <line
                      x1={a.cx}
                      y1={a.cy}
                      x2={b.cx}
                      y2={b.cy}
                      stroke="transparent"
                      strokeWidth={0.32}
                      className="cursor-pointer"
                      onClick={(e) => onSegmentClick(seg, e)}
                    >
                      <title>Remove edge</title>
                    </line>
                  </g>
                );
              })}

              {drawPath &&
                segments.length > 0 &&
                predictedSegments.map((seg) => {
                  const a = cellCenterSvg(seg.from.x, seg.from.y);
                  const b = cellCenterSvg(seg.to.x, seg.to.y);
                  const k = segmentKey(seg.from, seg.to);
                  const onShape = authoredKeys.has(k);
                  return (
                    <line
                      key={`pred-${k}`}
                      x1={a.cx}
                      y1={a.cy}
                      x2={b.cx}
                      y2={b.cy}
                      stroke={trailColor}
                      strokeWidth={onShape ? 0.07 : 0.11}
                      strokeLinecap="round"
                      strokeDasharray={onShape ? undefined : "0.14 0.1"}
                      opacity={onShape ? 0.35 : 0.95}
                    />
                  );
                })}

              {drawPath &&
                shapeProgram?.walk.map((seg, i) => {
                  const a = cellCenterSvg(seg.from.x, seg.from.y);
                  const b = cellCenterSvg(seg.to.x, seg.to.y);
                  const dx = b.cx - a.cx;
                  const dy = b.cy - a.cy;
                  const len = Math.hypot(dx, dy) || 1;
                  const ux = dx / len;
                  const uy = dy / len;
                  const px = -uy;
                  const py = ux;
                  const mx = (a.cx + b.cx) / 2;
                  const my = (a.cy + b.cy) / 2;
                  const size = 0.13;
                  const tipx = mx + ux * size;
                  const tipy = my + uy * size;
                  const bx = mx - ux * size * 0.35;
                  const by = my - uy * size * 0.35;
                  return (
                    <polygon
                      key={`walk-${i}`}
                      points={`${tipx},${tipy} ${bx + px * size},${by + py * size} ${bx - px * size},${by - py * size}`}
                      fill="#0f172a"
                      opacity={0.72}
                    />
                  );
                })}

              {anchor && (
                <circle
                  cx={cellCenterSvg(anchor.x, anchor.y).cx}
                  cy={cellCenterSvg(anchor.x, anchor.y).cy}
                  r={0.18}
                  fill="#4F46E5"
                  opacity={0.85}
                />
              )}

              {/* Robot start + facing (orange) */}
              {(() => {
                const c = cellCenterSvg(robot.x, robot.y);
                const fx = facing.x * 0.28;
                const fy = -facing.y * 0.28;
                return (
                  <g>
                    <circle cx={c.cx} cy={c.cy} r={0.24} fill="#F97316" />
                    <circle cx={c.cx} cy={c.cy} r={0.1} fill="white" />
                    <line
                      x1={c.cx}
                      y1={c.cy}
                      x2={c.cx + fx}
                      y2={c.cy + fy}
                      stroke="#9a3412"
                      strokeWidth={0.08}
                      strokeLinecap="round"
                    />
                    <circle cx={c.cx + fx} cy={c.cy + fy} r={0.07} fill="#9a3412" />
                  </g>
                );
              })()}

              {/* Final destination marker */}
              {showDestination && finishCell && (
                <g>
                  <rect
                    x={finishCell.x + 0.14}
                    y={GRID_ROWS - 1 - finishCell.y + 0.14}
                    width={0.72}
                    height={0.72}
                    rx={0.12}
                    fill="rgba(13,148,136,0.35)"
                    stroke="#0f766e"
                    strokeWidth={0.07}
                  />
                  {gp?.finishObjectType ? (
                    <text
                      x={finishCell.x + 0.5}
                      y={GRID_ROWS - 0.42 - finishCell.y}
                      textAnchor="middle"
                      fontSize={0.32}
                    >
                      {OBJECT_PALETTE.find((p) => p.type === gp.finishObjectType)?.icon ?? "★"}
                    </text>
                  ) : (
                    <circle
                      cx={finishCell.x + 0.5}
                      cy={GRID_ROWS - 0.5 - finishCell.y}
                      r={0.12}
                      fill="#0d9488"
                    />
                  )}
                </g>
              )}
            </svg>
          </div>

          {drawPath && (
            <div className="space-y-2 rounded-xl border border-[#E8C547]/70 bg-[#F7E37D] px-3 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-stone-900">Generated program</p>
                  <p className="text-[11px] text-stone-700">
                    These arrows go under the shape in the yellow strip. In the next section you can
                    rewrite them as Repeat or Chunks.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg"
                  onClick={() => commit(config, true)}
                >
                  Rebuild from shape
                </Button>
              </div>
              <ShownProgramStrip tokens={config.guidedActions ?? []} />
              {!shapeProgram?.startOnShape && (segments.length ?? 0) > 0 && (
                <p className="text-[11px] text-amber-900">
                  Place the robot on the shape so these arrows start from the orange marker.
                </p>
              )}
              {(shapeProgram?.unusedEdgeCount ?? 0) > 0 && (
                <p className="text-[11px] text-amber-900">
                  {shapeProgram?.unusedEdgeCount} edge
                  {(shapeProgram?.unusedEdgeCount ?? 0) === 1 ? "" : "s"} could not be reached from
                  the start — connect them or move the robot.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-5 rounded" style={{ background: shapeColor, opacity: 0.85 }} />
              {drawPath
                ? `Shape students should draw (${segments.length || predictedSegments.length} edges)`
                : `Geometry path (${summary.edgeCount} edges)`}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
              Robot start · facing {summary.facingLabel}
            </span>
            {showDestination && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-teal-600" />
                Final destination
                {finishCell ? ` (${finishCell.x}, ${finishCell.y})` : ""}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-5 rounded" style={{ background: trailColor }} />
              {drawPath ? "Path the program will take" : "Student trail color"}
            </span>
          </div>
        </div>

        {/* —— Config panel —— */}
        <div className="space-y-4 xl:max-h-[calc(100vh-12rem)] xl:overflow-y-auto xl:pr-1">
          <Section
            title="Shape"
            description={
              drawPath
                ? "Pick or draw a shape. Command arrows generate automatically from it."
                : "Pick a template, then tune size. Switch to Custom to draw freely."
            }
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(Object.keys(GEOMETRY_SHAPE_LABELS) as GeometryShapeType[]).map((id) => {
                const selected = shape === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => applyTemplate(id)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-center transition",
                      selected
                        ? "border-indigo-500 bg-indigo-50 text-indigo-800 ring-2 ring-indigo-100"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    )}
                  >
                    <span className={cn(selected ? "text-indigo-600" : "text-slate-400")}>
                      <ShapeThumb shape={id} />
                    </span>
                    <span className="text-[11px] font-semibold">{GEOMETRY_SHAPE_LABELS[id]}</span>
                  </button>
                );
              })}
            </div>

            {shape !== "CUSTOM" && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                {(shape === "SQUARE" || shape === "ZIGZAG" || shape === "STAIRCASE") &&
                  sizeField("Side / length", gp?.templateSize ?? 2, (n) => {
                    const next = generateShapeSegments(
                      shape,
                      gp?.templateOrigin ?? robot,
                      n,
                      gp?.templateWidth ?? 3,
                      gp?.templateHeight ?? 2
                    );
                    commit(
                      patchGeometry(config, {
                        shapeType: shape,
                        templateSize: n,
                        segments: next,
                      }),
                      true
                    );
                  })}
                {(shape === "RECTANGLE" || shape === "L_SHAPE") && (
                  <>
                    {sizeField(
                      shape === "L_SHAPE" ? "Horizontal length" : "Width",
                      gp?.templateWidth ?? 3,
                      (n) => {
                        const next = generateShapeSegments(
                          shape,
                          gp?.templateOrigin ?? robot,
                          gp?.templateSize ?? 2,
                          n,
                          gp?.templateHeight ?? 2
                        );
                        commit(
                          patchGeometry(config, {
                            shapeType: shape,
                            templateWidth: n,
                            segments: next,
                          }),
                          true
                        );
                      }
                    )}
                    {sizeField(
                      shape === "L_SHAPE" ? "Vertical length" : "Height",
                      gp?.templateHeight ?? 2,
                      (n) => {
                        const next = generateShapeSegments(
                          shape,
                          gp?.templateOrigin ?? robot,
                          gp?.templateSize ?? 2,
                          gp?.templateWidth ?? 3,
                          n
                        );
                        commit(
                          patchGeometry(config, {
                            shapeType: shape,
                            templateHeight: n,
                            segments: next,
                          }),
                          true
                        );
                      }
                    )}
                  </>
                )}
                <div className="col-span-2">
                  <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl" onClick={refreshTemplate}>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Rebuild template at current origin
                  </Button>
                </div>
              </div>
            )}
          </Section>

          <Section title="Start & direction" description="Where the robot begins and which way it faces.">
            <p className="text-[11px] text-slate-500">
              Select <span className="font-semibold text-slate-700">Start</span> in the toolbar, then click a
              cell — or use the facing buttons below.
            </p>
            <div className="grid grid-cols-4 gap-2">
              {FACINGS.map(({ id, label, vec, Icon }) => {
                const selected = facing.x === vec.x && facing.y === vec.y;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => commit({ ...config, robotStartFacing: { ...vec } }, true)}
                    className={cn(
                      "flex h-11 flex-col items-center justify-center gap-0.5 rounded-xl border text-[10px] font-semibold transition",
                      selected
                        ? "border-indigo-500 bg-indigo-600 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-600">
              Start {summary.startLabel} · Facing {summary.facingLabel}
            </p>
          </Section>

          {!drawPath && (
          <Section
            title="After tracing the shape"
            description="Some activities end on the shape. Others continue to a final destination."
          >
            <div className="space-y-2">
              {(
                [
                  "SHAPE_COMPLETE",
                  "CONTINUE_TO_DESTINATION",
                ] as const
              ).map((id) => (
                <label
                  key={id}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2.5 text-xs transition",
                    afterShape === id
                      ? "border-indigo-400 bg-indigo-50/80 text-indigo-950"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  )}
                >
                  <input
                    type="radio"
                    className="mt-0.5"
                    name="afterShapeBehavior"
                    checked={afterShape === id}
                    onChange={() => {
                      if (id === "SHAPE_COMPLETE") {
                        onChange(
                          patchGeometry(config, {
                            afterShapeBehavior: id,
                            finishCell: undefined,
                            finishFacing: undefined,
                            finishObjectType: undefined,
                            requireFinishFacing: false,
                          })
                        );
                        if (drawMode === "destination") setDrawMode("draw");
                      } else {
                        onChange(
                          patchGeometry(config, {
                            afterShapeBehavior: id,
                            finishCell: gp?.finishCell ?? { x: 4, y: 4 },
                          })
                        );
                        setDrawMode("destination");
                      }
                    }}
                  />
                  <span>
                    <span className="font-semibold">{GEOMETRY_AFTER_SHAPE_LABELS[id]}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">
                      {id === "SHAPE_COMPLETE"
                        ? "Pass when the target geometry is complete."
                        : "Students must finish the shape, then leave it and reach a destination cell."}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            {afterShape === "CONTINUE_TO_DESTINATION" && (
              <div className="mt-3 space-y-3 rounded-xl border border-teal-100 bg-teal-50/40 p-3">
                <p className="text-[11px] text-teal-900">
                  Select <span className="font-semibold">Destination</span> in the toolbar, then click a
                  cell on the grid.
                </p>
                <p className="text-xs font-medium text-slate-800">
                  Destination cell:{" "}
                  {finishCell ? `(${finishCell.x}, ${finishCell.y})` : "not set"}
                </p>
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700">Destination object</span>
                  <select
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm"
                    value={gp?.finishObjectType ?? ""}
                    onChange={(e) =>
                      onChange(
                        patchGeometry(config, {
                          finishObjectType: e.target.value || undefined,
                        })
                      )
                    }
                  >
                    {DEST_OBJECT_OPTIONS.map((o) => (
                      <option key={o.type || "none"} value={o.type}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-start gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={!!gp?.requireFinishFacing}
                    onChange={(e) =>
                      onChange(
                        patchGeometry(config, {
                          requireFinishFacing: e.target.checked,
                          finishFacing: e.target.checked
                            ? gp?.finishFacing ?? { x: 1, y: 0 }
                            : undefined,
                        })
                      )
                    }
                  />
                  <span>
                    <span className="font-medium">Require final direction</span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">
                      Robot must face a specific way when standing on the destination.
                    </span>
                  </span>
                </label>
                {gp?.requireFinishFacing && (
                  <div className="grid grid-cols-4 gap-2">
                    {FACINGS.map(({ id, label, vec, Icon }) => {
                      const selected =
                        finishFacing?.x === vec.x && finishFacing?.y === vec.y;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() =>
                            onChange(
                              patchGeometry(config, {
                                requireFinishFacing: true,
                                finishFacing: { ...vec },
                              })
                            )
                          }
                          className={cn(
                            "flex h-11 flex-col items-center justify-center gap-0.5 rounded-xl border text-[10px] font-semibold transition",
                            selected
                              ? "border-teal-600 bg-teal-600 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </Section>
          )}

          {!drawPath && (
          <Section title="Assessment" description="Uses the existing How to grade modes — graded in Unity and stored with the attempt.">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-slate-700">How to grade</span>
              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                value={mode}
                onChange={(e) =>
                  onChange(
                    patchGeometry(config, {
                      validationMode: e.target.value as GeometryValidationMode,
                    })
                  )
                }
              >
                {(Object.keys(GEOMETRY_VALIDATION_LABELS) as GeometryValidationMode[]).map((m) => (
                  <option key={m} value={m}>
                    {GEOMETRY_VALIDATION_LABELS[m]}
                  </option>
                ))}
              </select>
              <p className="text-[11px] leading-relaxed text-slate-500">{GEOMETRY_VALIDATION_HELP[mode]}</p>
            </label>

            <div className="space-y-2 border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold text-slate-700">Optional requirements</p>
              {(
                [
                  ["requireRepeat", "Must use Repeat", !!gp?.tools?.repeat],
                  ["requireActionChunk", "Must use an Action Chunk", !!gp?.tools?.actionChunks],
                  ["requireCommandBag", "Must use a Command Bag", !!gp?.tools?.commandBags],
                ] as const
              ).map(([key, label, toolOn]) => (
                <label
                  key={key}
                  className={cn(
                    "flex items-center gap-2 text-xs text-slate-700",
                    !toolOn && "opacity-50"
                  )}
                >
                  <input
                    type="checkbox"
                    disabled={!toolOn}
                    checked={!!gp?.[key]}
                    onChange={(e) =>
                      onChange(patchGeometry(config, { [key]: e.target.checked }))
                    }
                  />
                  {label}
                  {!toolOn && (
                    <span className="text-[10px] text-slate-400">(enable tool in Program step)</span>
                  )}
                </label>
              ))}
              {mode !== "EXACT_PATH" && (
                <p className="text-[11px] text-slate-500">
                  Tip: choose <span className="font-medium">Exact path</span> if students must not travel
                  extra edges.
                </p>
              )}
            </div>
          </Section>
          )}

          <Section title="Behavior" description="What students see while the robot runs.">
            <label className="flex items-start gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={gp?.drawRobotTrail !== false}
                onChange={(e) => onChange(patchGeometry(config, { drawRobotTrail: e.target.checked }))}
              />
              <span>
                <span className="font-medium">Draw robot trail while moving</span>
                <span className="mt-0.5 block text-[11px] text-slate-500">
                  Solid line in the robot trail color as the robot moves.
                </span>
              </span>
            </label>
            {!drawPath && (
            <label className="flex items-start gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={!!gp?.keepShapeVisibleDuringRun}
                onChange={(e) =>
                  onChange(patchGeometry(config, { keepShapeVisibleDuringRun: e.target.checked }))
                }
              />
              <span>
                <span className="font-medium">Keep shape line visible during run</span>
                <span className="mt-0.5 block text-[11px] text-slate-500">
                  Target stays on screen while the robot draws its line.
                </span>
              </span>
            </label>
            )}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {(([["targetColor", "Shape line"], ["trailColor", drawPath ? "Program path" : "Robot line"]] as const)).map(([key, label]) => {
                const value = (gp?.[key] as string | undefined) ?? DEFAULT_GEOMETRY_COLORS[key];
                return (
                  <label
                    key={key}
                    className="flex h-10 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700"
                  >
                    {label}
                    <input
                      type="color"
                      value={value.startsWith("#") ? value.slice(0, 7) : "#9E61FA"}
                      onChange={(e) =>
                        onChange(patchGeometry(config, { [key]: e.target.value.toUpperCase() }))
                      }
                      className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                  </label>
                );
              })}
            </div>
          </Section>

          <div className="rounded-2xl border border-stone-200 bg-gradient-to-br from-[#FFF8E8] to-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-[#0F9B8E]" />
              <h3 className="text-sm font-bold text-slate-900">Assessment summary</h3>
            </div>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Goal</dt>
                <dd className="max-w-[65%] text-right font-medium text-slate-800">
                  {summary.goalLabel}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">How to grade</dt>
                <dd className="max-w-[60%] text-right font-medium text-slate-800">{summary.gradeLabel}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Start</dt>
                <dd className="font-medium text-slate-800">
                  {summary.startLabel} · {summary.facingLabel}
                </dd>
              </div>
              {summary.destinationLabel && (
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Destination</dt>
                  <dd className="max-w-[60%] text-right font-medium text-teal-800">
                    {summary.destinationLabel}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Student tools</dt>
                <dd className="font-medium text-slate-800">{summary.toolsLabel}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Students start with</dt>
                <dd className="font-medium text-slate-800">{summary.starterLabel}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Robot trail</dt>
                <dd className="font-medium text-slate-800">{summary.trailOn ? "On" : "Off"}</dd>
              </div>
              {summary.requirements.length > 0 && (
                <div className="border-t border-stone-200 pt-2">
                  <dt className="mb-1 text-slate-500">Requirements</dt>
                  <dd className="space-y-1">
                    {summary.requirements.map((r) => (
                      <p key={r} className="font-medium text-slate-800">
                        · {r}
                      </p>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
            <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500">
              <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-[#0F9B8E]" />
              Configure Commands, Repeat, Chunks, and Bags in the Program step. Results use the same
              attempt &amp; assessment pipeline as other items.
            </p>
          </div>

          {drawPath && predictedSegments.length === 0 && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Write a program with at least one move so students have a path to draw.
            </p>
          )}
          {drawPath && segments.length === 0 && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Pick a shape template or draw the path this program should take.
            </p>
          )}
          {!drawPath && summary.edgeCount === 0 && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Draw or select a Geometry Path before publishing.
            </p>
          )}
          {afterShape === "CONTINUE_TO_DESTINATION" && !finishCell && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Choose a final destination cell before publishing.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
