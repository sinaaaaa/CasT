"use client";

import { useCallback, useRef, useState } from "react";
import type { LevelGameplayConfig } from "@/lib/level-config";
import {
  DEFAULT_NUMBER_LINE_STYLE,
  gridPositionToTick,
  isNumberLineLayout,
  syncNumberLineGridPositions,
  tickToGridPosition,
  visitSequenceReady,
} from "@/lib/level-config";
import {
  DND_MIME,
  NUMBER_LINE_DEFAULT_LINE_ROW,
  NUMBER_LINE_DEFAULT_TICKS,
  NUMBER_LINE_FACING_OPTIONS,
  NUMBER_LINE_MAX_TICKS,
  NUMBER_LINE_MIN_TICKS,
  OBJECT_PALETTE,
  PLACEMENT_OPTIONS,
  objectCellClass,
} from "@/lib/level-editor-constants";
import { DesignerSection } from "./designer-section";
import { DesignerPaletteChip } from "./designer-palette-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Eraser,
  MapPin,
  Minus,
  Palette,
  Plus,
  Route,
  Search,
  SeparatorHorizontal,
  SlidersHorizontal,
  Target,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

type Props = {
  config: LevelGameplayConfig;
  onChange: (config: LevelGameplayConfig) => void;
};

type Placement = "above" | "below" | "onLine";

type DragPayload =
  | { kind: "palette-object"; objectType: string; placement: Placement }
  | { kind: "palette-robot" }
  | { kind: "palette-goal" }
  | { kind: "palette-erase" }
  | { kind: "tick-object"; tick: number };

type TickObject = {
  tick: number;
  objectType: string;
  placement: Placement;
  imageUrl?: string;
  isStartObject?: boolean;
  isEndObject?: boolean;
  visitOrder?: 1 | 2;
};

function parseDrag(data: string): DragPayload | null {
  if (!data) return null;
  try {
    return JSON.parse(data) as DragPayload;
  } catch {
    return null;
  }
}

function readObjects(config: LevelGameplayConfig): TickObject[] {
  const lineRow = config.numberLine?.lineRow ?? NUMBER_LINE_DEFAULT_LINE_ROW;
  return (config.gridObjects ?? []).map((o) => {
    const pos = o.position ?? { x: 0, y: lineRow };
    const { tick, placement } = gridPositionToTick(pos, lineRow);
    return {
      tick,
      objectType: o.objectType,
      placement: (o.placement ?? placement) as Placement,
      imageUrl: o.imageUrl,
      isStartObject: o.isStartObject,
      isEndObject: o.isEndObject,
      visitOrder:
        o.visitOrder === 1 || o.visitOrder === 2
          ? (o.visitOrder as 1 | 2)
          : o.isStartObject
            ? 1
            : o.isEndObject
              ? 2
              : undefined,
    };
  });
}

function mergeStyle(
  nl: NonNullable<LevelGameplayConfig["numberLine"]>
): NonNullable<LevelGameplayConfig["numberLine"]> {
  return { ...DEFAULT_NUMBER_LINE_STYLE, ...nl };
}

function RatioSlider({
  label,
  value,
  min,
  max,
  step,
  hint,
  displayAsPercent = true,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  hint?: string;
  displayAsPercent?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="space-y-1 text-xs">
      <span className="font-medium text-slate-700">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-2 flex-1 accent-indigo-600"
        />
        <span className="w-10 text-right tabular-nums text-muted-foreground">
          {displayAsPercent ? `${(value * 100).toFixed(0)}%` : value.toFixed(2)}
        </span>
      </div>
      {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function NumberLineDesigner({ config, onChange }: Props) {
  const dragPayloadRef = useRef<DragPayload | null>(null);
  const [brush, setBrush] = useState<DragPayload | null>(null);
  const [placementBrush, setPlacementBrush] = useState<Placement>("below");
  const [selectedTick, setSelectedTick] = useState<number | null>(null);
  const [paletteSearch, setPaletteSearch] = useState("");
  const [zoom, setZoom] = useState(100);
  const [styleOpen, setStyleOpen] = useState(true);
  const [dragOverTick, setDragOverTick] = useState<number | null>(null);

  const nl = mergeStyle(
    config.numberLine ?? {
      tickCount: NUMBER_LINE_DEFAULT_TICKS,
      lineRow: NUMBER_LINE_DEFAULT_LINE_ROW,
      showTickLabels: true,
      showArrows: true,
      forwardBackwardOnly: true,
    }
  );
  const tickCount = nl.tickCount ?? NUMBER_LINE_DEFAULT_TICKS;
  const lineRow = nl.lineRow ?? NUMBER_LINE_DEFAULT_LINE_ROW;
  const objects = readObjects(config);
  const visitSequence = config.visitObjectSequence ?? false;
  const robotTick = config.robotStartPosition?.x ?? 0;
  const goalTick =
    config.goalCell && config.goalCell.x >= 0 ? config.goalCell.x : null;
  const visitStep2Tick = objects.find((o) => o.visitOrder === 2 || o.isEndObject)?.tick ?? null;

  const lineColor = nl.lineColor ?? DEFAULT_NUMBER_LINE_STYLE.lineColor;
  const tickColor = nl.tickColor ?? DEFAULT_NUMBER_LINE_STYLE.tickColor;
  const labelColor = nl.labelColor ?? DEFAULT_NUMBER_LINE_STYLE.labelColor;
  const axisThick = (nl.axisThicknessRatio ?? DEFAULT_NUMBER_LINE_STYLE.axisThicknessRatio) * 100;
  const tickH = (nl.tickHeightRatio ?? DEFAULT_NUMBER_LINE_STYLE.tickHeightRatio) * 100;
  const tickW = (nl.tickWidthRatio ?? DEFAULT_NUMBER_LINE_STYLE.tickWidthRatio) * 100;

  const commit = useCallback(
    (next: LevelGameplayConfig) => {
      onChange(syncNumberLineGridPositions({ ...next, layoutMode: "NUMBER_LINE" }));
    },
    [onChange]
  );

  function patchNumberLine(
    partial: Partial<NonNullable<LevelGameplayConfig["numberLine"]>>
  ) {
    commit({
      ...config,
      layoutMode: "NUMBER_LINE",
      numberLine: mergeStyle({ ...nl, ...partial }),
    });
  }

  function setObjects(next: TickObject[], options?: { clearGoal?: boolean }) {
    const gridObjects = next.map((o) => ({
      position: tickToGridPosition(o.tick, lineRow, o.placement),
      objectType: o.objectType,
      placement: o.placement,
      imageUrl: o.imageUrl,
      isStartObject: o.isStartObject,
      isEndObject: o.isEndObject,
      visitOrder: o.visitOrder,
    }));
    commit({
      ...config,
      layoutMode: "NUMBER_LINE",
      gridObjects,
      ...(options?.clearGoal ? { goalCell: undefined } : {}),
    });
  }

  function toggleVisitStep(
    tick: number,
    objectType: string,
    placement: Placement,
    step: 1 | 2,
    on: boolean
  ) {
    const next = objects.map((o) => {
      const at =
        o.tick === tick && o.objectType === objectType && o.placement === placement;
      if (step === 1 && !at && (o.visitOrder === 1 || o.isStartObject))
        return { ...o, visitOrder: undefined, isStartObject: false };
      if (step === 2 && !at && (o.visitOrder === 2 || o.isEndObject))
        return { ...o, visitOrder: undefined, isEndObject: false };
      if (!at) return o;
      if (!on)
        return { ...o, visitOrder: undefined, isStartObject: false, isEndObject: false };
      if (step === 1)
        return { ...o, visitOrder: 1 as const, isStartObject: true, isEndObject: false };
      return { ...o, visitOrder: 2 as const, isStartObject: false, isEndObject: true };
    });
    setObjects(next, { clearGoal: true });
  }

  function setDragPayload(e: React.DragEvent, payload: DragPayload) {
    dragPayloadRef.current = payload;
    const json = JSON.stringify(payload);
    e.dataTransfer.setData("text/plain", json);
    try {
      e.dataTransfer.setData(DND_MIME, json);
    } catch {
      /* Safari */
    }
    e.dataTransfer.effectAllowed = "copyMove";
  }

  function clearDragPayload() {
    dragPayloadRef.current = null;
    setDragOverTick(null);
  }

  function readDrag(e: React.DragEvent): DragPayload | null {
    if (dragPayloadRef.current) return dragPayloadRef.current;
    const raw = e.dataTransfer.getData("text/plain") || e.dataTransfer.getData(DND_MIME);
    return parseDrag(raw);
  }

  function brushWithPlacement(payload: DragPayload): DragPayload {
    if (payload.kind === "palette-object")
      return { ...payload, placement: placementBrush };
    return payload;
  }

  function applyToTick(tick: number, payload: DragPayload) {
    const p = brushWithPlacement(payload);
    if (p.kind === "palette-erase") {
      setObjects(objects.filter((o) => o.tick !== tick));
      if (robotTick === tick) {
        commit({ ...config, robotStartPosition: { x: 0, y: lineRow } });
      }
      if (goalTick === tick) {
        commit({ ...config, goalCell: undefined });
      }
      return;
    }
    if (p.kind === "palette-robot") {
      commit({
        ...config,
        robotStartPosition: { x: tick, y: lineRow },
        robotStartFacing: config.robotStartFacing ?? { x: -1, y: 0 },
      });
      setSelectedTick(tick);
      return;
    }
    if (p.kind === "palette-goal") {
      commit({ ...config, goalCell: { x: tick, y: lineRow } });
      setSelectedTick(tick);
      return;
    }
    if (p.kind === "palette-object") {
      const filtered = objects.filter(
        (o) =>
          !(
            o.tick === tick &&
            o.objectType === p.objectType &&
            o.placement === p.placement
          )
      );
      setObjects([
        ...filtered,
        { tick, objectType: p.objectType, placement: p.placement },
      ]);
      setSelectedTick(tick);
      return;
    }
    if (p.kind === "tick-object") {
      const moving = objects.find((o) => o.tick === p.tick);
      if (!moving) return;
      setObjects([
        ...objects.filter((o) => o.tick !== p.tick),
        { ...moving, tick },
      ]);
      setSelectedTick(tick);
    }
  }

  function onTickDrop(e: React.DragEvent, tick: number) {
    e.preventDefault();
    const payload = readDrag(e);
    clearDragPayload();
    if (payload) applyToTick(tick, payload);
    setBrush(null);
  }

  function onTickClick(tick: number) {
    setSelectedTick(tick);
    if (brush) applyToTick(tick, brush);
  }

  const filteredPalette = OBJECT_PALETTE.filter((item) => {
    const q = paletteSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      item.label.toLowerCase().includes(q) ||
      item.type.toLowerCase().includes(q)
    );
  });

  const selectedObj =
    selectedTick != null ? objects.filter((o) => o.tick === selectedTick) : [];

  if (!isNumberLineLayout(config)) {
    return (
      <p className="text-sm text-muted-foreground">
        Switch layout to <strong>Number line</strong> in the board settings above.
      </p>
    );
  }

  function renderTickColumn(
    tick: number,
    row: "above" | "line" | "below",
    minH: string
  ) {
    const isRobot = robotTick === tick && row === "line";
    const isGoal =
      visitSequence && visitStep2Tick != null
        ? visitStep2Tick === tick && row === "line"
        : goalTick === tick && row === "line";
    const rowObjects = objects.filter((o) => {
      if (o.tick !== tick) return false;
      if (row === "above") return o.placement === "above";
      if (row === "below") return o.placement === "below";
      return o.placement === "onLine";
    });
    const isOver = dragOverTick === tick;
    const isSel = selectedTick === tick;

    return (
      <div
        key={`${row}-${tick}`}
        role="button"
        tabIndex={0}
        className={cn(
          "flex w-11 flex-col items-center justify-center rounded-md border border-transparent transition sm:w-12",
          minH,
          isOver && "border-indigo-400 bg-indigo-50/80",
          isSel && row === "line" && "bg-indigo-50 ring-2 ring-indigo-300",
          row !== "line" && isSel && "bg-indigo-50/50"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOverTick(tick);
        }}
        onDragLeave={() => setDragOverTick((t) => (t === tick ? null : t))}
        onDrop={(e) => onTickDrop(e, tick)}
        onClick={() => onTickClick(tick)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onTickClick(tick);
        }}
      >
        {row === "line" && (
          <>
            {isRobot && (
              <span className="mb-0.5 text-base" title="Robo start">
                🤖
              </span>
            )}
            {isGoal && (
              <span className="mb-0.5 rounded border border-emerald-600 bg-emerald-100 px-1 text-[8px] font-bold text-emerald-800">
                GOAL
              </span>
            )}
            <div
              className="w-px shrink-0 rounded-full"
              style={{
                height: `${Math.max(12, tickH * 0.35)}px`,
                backgroundColor: tickColor,
              }}
            />
            {nl.showTickLabels !== false && (
              <span
                className="mt-0.5 text-[10px] font-bold tabular-nums"
                style={{ color: labelColor }}
              >
                {tick}
              </span>
            )}
          </>
        )}
        {rowObjects.map((o) => (
          <span
            key={`${o.objectType}-${o.placement}`}
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              const p: DragPayload = { kind: "tick-object", tick };
              setDragPayload(e, p);
            }}
            onDragEnd={clearDragPayload}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "relative my-0.5 rounded border px-1 py-0.5 text-[10px] leading-none",
              (o.visitOrder === 1 || o.isStartObject) && "border-red-500 bg-red-50",
              (o.visitOrder === 2 || o.isEndObject) && "border-emerald-600 bg-emerald-50",
              !o.visitOrder && !o.isStartObject && !o.isEndObject && objectCellClass(o.objectType)
            )}
            title={o.objectType}
          >
            {OBJECT_PALETTE.find((p) => p.type === o.objectType)?.icon ?? "•"}
            {(o.visitOrder === 1 || o.isStartObject) && (
              <span className="absolute -left-0.5 -top-0.5 rounded bg-blue-600 px-0.5 text-[7px] font-bold text-white">
                {visitSequence ? "1" : "S"}
              </span>
            )}
            {(o.visitOrder === 2 || o.isEndObject) && (
              <span className="absolute -right-0.5 -top-0.5 rounded bg-emerald-600 px-0.5 text-[7px] font-bold text-white">
                {visitSequence ? "2" : "E"}
              </span>
            )}
          </span>
        ))}
      </div>
    );
  }

  return (
    <DesignerSection
      icon={SeparatorHorizontal}
      title="Number line board"
      description={
        visitSequence
          ? "Visit sequence: mark Visit step 1 and Visit step 2 on two objects. Students build one program; the robot must reach step 1, then step 2."
          : "Same workflow as the grid: pick a tool on the left, choose above / on line / below, then click or drag onto a tick. Tick 0 is on the left."
      }
    >
      {visitSequence && (
        <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50/70 px-4 py-3 text-sm text-teal-950">
          <p className="flex items-center gap-2 font-semibold">
            <Route className="h-4 w-4 shrink-0" />
            Visit two objects in order
          </p>
          <p className="mt-1 text-teal-900">
            Select an object on a tick and mark <strong>Visit step 1</strong> (first) and another as{" "}
            <strong>Visit step 2</strong> (goal). Enable this in Rules → Visit sequence.
          </p>
          {!visitSequenceReady(config) && (
            <p className="mt-2 font-medium text-amber-800">
              Add one object as step 1 and a different object as step 2 before publishing.
            </p>
          )}
        </div>
      )}

      {/* Quick settings bar */}
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-3">
        <label className="space-y-1 text-xs">
          <span className="font-semibold text-slate-600">Ticks</span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8"
              disabled={tickCount <= NUMBER_LINE_MIN_TICKS}
              onClick={() => patchNumberLine({ tickCount: tickCount - 1 })}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Input
              type="number"
              className="h-8 w-14 text-center text-xs"
              min={NUMBER_LINE_MIN_TICKS}
              max={NUMBER_LINE_MAX_TICKS}
              value={tickCount}
              onChange={(e) =>
                patchNumberLine({
                  tickCount: Math.min(
                    NUMBER_LINE_MAX_TICKS,
                    Math.max(
                      NUMBER_LINE_MIN_TICKS,
                      Number(e.target.value) || NUMBER_LINE_MIN_TICKS
                    )
                  ),
                })
              }
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8"
              disabled={tickCount >= NUMBER_LINE_MAX_TICKS}
              onClick={() => patchNumberLine({ tickCount: tickCount + 1 })}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </label>
        <label className="space-y-1 text-xs">
          <span className="font-semibold text-slate-600">Robo faces</span>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={`${config.robotStartFacing?.x ?? -1},${config.robotStartFacing?.y ?? 0}`}
            onChange={(e) => {
              const opt = NUMBER_LINE_FACING_OPTIONS.find(
                (f) => `${f.value.x},${f.value.y}` === e.target.value
              );
              if (opt) commit({ ...config, robotStartFacing: opt.value });
            }}
          >
            {NUMBER_LINE_FACING_OPTIONS.map((f) => (
              <option key={f.label} value={`${f.value.x},${f.value.y}`}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={nl.showTickLabels !== false}
            onChange={(e) => patchNumberLine({ showTickLabels: e.target.checked })}
          />
          Tick numbers in game
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={nl.showArrows !== false}
            onChange={(e) => patchNumberLine({ showArrows: e.target.checked })}
          />
          Arrow ends
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={nl.forwardBackwardOnly !== false}
            onChange={(e) => {
              const forwardBackwardOnly = e.target.checked;
              commit({
                ...config,
                layoutMode: "NUMBER_LINE",
                numberLine: mergeStyle({ ...nl, forwardBackwardOnly }),
                enabledActionButtons: forwardBackwardOnly
                  ? ["forward", "backward"]
                  : ["forward", "backward", "turn left", "turn right"],
              });
            }}
          />
          Forward / backward only
        </label>
      </div>

      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        {/* Palette — mirrors grid designer */}
        <aside className="w-full shrink-0 xl:w-52">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Drag onto ticks
          </p>
          <div className="max-h-[min(520px,60vh)] space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/80 p-3">
            <DesignerPaletteChip
              label="Robo start"
              icon="🤖"
              active={brush?.kind === "palette-robot"}
              className="border-violet-300 bg-violet-50 text-violet-900"
              onSelect={() => setBrush({ kind: "palette-robot" })}
              onDragStart={(e) => {
                const p: DragPayload = { kind: "palette-robot" };
                setBrush(p);
                setDragPayload(e, p);
              }}
              onDragEnd={clearDragPayload}
            />
            {!visitSequence && (
              <DesignerPaletteChip
                label="Goal tick"
                icon="🎯"
                active={brush?.kind === "palette-goal"}
                className="border-emerald-300 bg-emerald-50 text-emerald-900"
                onSelect={() => setBrush({ kind: "palette-goal" })}
                onDragStart={(e) => {
                  const p: DragPayload = { kind: "palette-goal" };
                  setBrush(p);
                  setDragPayload(e, p);
                }}
                onDragEnd={clearDragPayload}
              />
            )}
            <DesignerPaletteChip
              label="Eraser"
              icon={<Eraser className="h-4 w-4" />}
              active={brush?.kind === "palette-erase"}
              className="border-red-200 bg-red-50 text-red-800"
              onSelect={() => setBrush({ kind: "palette-erase" })}
              onDragStart={(e) => {
                const p: DragPayload = { kind: "palette-erase" };
                setBrush(p);
                setDragPayload(e, p);
              }}
              onDragEnd={clearDragPayload}
            />
            <p className="border-t border-slate-200 pt-2 text-[10px] font-medium text-slate-500">
              Placement for objects
            </p>
            <div className="grid grid-cols-3 gap-1">
              {PLACEMENT_OPTIONS.map((pl) => (
                <button
                  key={pl.value}
                  type="button"
                  onClick={() => setPlacementBrush(pl.value)}
                  className={cn(
                    "rounded-md border px-1 py-1.5 text-[10px] font-medium leading-tight",
                    placementBrush === pl.value
                      ? "border-indigo-500 bg-indigo-50 text-indigo-900 ring-1 ring-indigo-300"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {pl.label}
                </button>
              ))}
            </div>
            <p className="border-t border-slate-200 pt-2 text-[10px] font-medium text-slate-500">
              Objects ({OBJECT_PALETTE.length})
            </p>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search…"
                value={paletteSearch}
                onChange={(e) => setPaletteSearch(e.target.value)}
                className="h-8 pl-7 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {filteredPalette.map((item) => (
                <DesignerPaletteChip
                  key={item.type}
                  label={item.label}
                  icon={item.icon}
                  active={
                    brush?.kind === "palette-object" &&
                    brush.objectType === item.type
                  }
                  className={objectCellClass(item.type)}
                  onSelect={() =>
                    setBrush({
                      kind: "palette-object",
                      objectType: item.type,
                      placement: placementBrush,
                    })
                  }
                  onDragStart={(e) => {
                    const p: DragPayload = {
                      kind: "palette-object",
                      objectType: item.type,
                      placement: placementBrush,
                    };
                    setBrush(p);
                    setDragPayload(e, p);
                  }}
                  onDragEnd={clearDragPayload}
                />
              ))}
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Drag onto a tick, or <strong>click a tool</strong> then click a tick.
            {brush && (
              <button
                type="button"
                className="ml-1 text-primary underline"
                onClick={() => setBrush(null)}
              >
                Clear brush
              </button>
            )}
          </p>
        </aside>

        {/* Board + inspector */}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              <span className="inline-block w-3 border-t-2 align-middle" style={{ borderColor: lineColor }} />{" "}
              Preview uses your line colors · Unity uses the same settings after save
            </p>
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
              <button
                type="button"
                className="rounded-md p-1.5 hover:bg-slate-100 disabled:opacity-40"
                onClick={() => setZoom((z) => Math.max(70, z - 10))}
                disabled={zoom <= 70}
                aria-label="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="min-w-[3rem] text-center text-xs font-medium">{zoom}%</span>
              <button
                type="button"
                className="rounded-md p-1.5 hover:bg-slate-100 disabled:opacity-40"
                onClick={() => setZoom((z) => Math.min(140, z + 10))}
                disabled={zoom >= 140}
                aria-label="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-gradient-to-b from-slate-100 to-slate-50 p-4">
            <div
              className="mx-auto min-w-[min(100%,32rem)] origin-top transition-transform duration-200"
              style={{ transform: `scale(${zoom / 100})` }}
            >
              <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Above line
              </p>
              <div className="flex justify-between gap-0.5 px-2">
                {Array.from({ length: tickCount }, (_, tick) =>
                  renderTickColumn(tick, "above", "min-h-[3.5rem]")
                )}
              </div>

              <div className="relative my-1 px-2 py-2">
                {nl.showArrows !== false && (
                  <div
                    className="pointer-events-none absolute left-0 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[6px] border-r-[10px] border-y-transparent"
                    style={{ borderRightColor: lineColor }}
                  />
                )}
                <div
                  className="absolute left-2 right-2 top-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    height: `${Math.max(2, axisThick * 0.12)}px`,
                    backgroundColor: lineColor,
                  }}
                />
                {nl.showArrows !== false && (
                  <div
                    className="pointer-events-none absolute right-0 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[6px] border-l-[10px] border-y-transparent"
                    style={{ borderLeftColor: lineColor }}
                  />
                )}
                <div className="relative flex justify-between gap-0.5">
                  {Array.from({ length: tickCount }, (_, tick) =>
                    renderTickColumn(tick, "line", "min-h-[3rem]")
                  )}
                </div>
              </div>

              <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Below line
              </p>
              <div className="flex justify-between gap-0.5 px-2">
                {Array.from({ length: tickCount }, (_, tick) =>
                  renderTickColumn(tick, "below", "min-h-[3.5rem]")
                )}
              </div>
            </div>
          </div>

          {/* Line appearance */}
          <div className="rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium"
              onClick={() => setStyleOpen((o) => !o)}
            >
              <span className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-indigo-600" />
                Line appearance (size & colors in Unity)
              </span>
              {styleOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {styleOpen && (
              <div className="grid gap-4 border-t border-slate-100 px-4 pb-4 pt-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="space-y-1 text-xs">
                  <span className="font-medium">Line color</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={lineColor}
                      onChange={(e) => patchNumberLine({ lineColor: e.target.value })}
                      className="h-9 w-12 cursor-pointer rounded border"
                    />
                    <Input
                      value={lineColor}
                      onChange={(e) => patchNumberLine({ lineColor: e.target.value })}
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                </label>
                <label className="space-y-1 text-xs">
                  <span className="font-medium">Tick color</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={tickColor}
                      onChange={(e) => patchNumberLine({ tickColor: e.target.value })}
                      className="h-9 w-12 cursor-pointer rounded border"
                    />
                    <Input
                      value={tickColor}
                      onChange={(e) => patchNumberLine({ tickColor: e.target.value })}
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                </label>
                <label className="space-y-1 text-xs">
                  <span className="font-medium">Number color</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={labelColor}
                      onChange={(e) => patchNumberLine({ labelColor: e.target.value })}
                      className="h-9 w-12 cursor-pointer rounded border"
                    />
                    <Input
                      value={labelColor}
                      onChange={(e) => patchNumberLine({ labelColor: e.target.value })}
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                </label>
                <div className="sm:col-span-2 lg:col-span-4">
                  <p className="mb-2 flex items-center gap-1 text-xs font-medium text-slate-600">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Thickness (relative to cell size in Unity — same as grid cell scale)
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <RatioSlider
                      label="Line thickness"
                      value={nl.axisThicknessRatio ?? DEFAULT_NUMBER_LINE_STYLE.axisThicknessRatio}
                      min={0.01}
                      max={0.2}
                      step={0.005}
                      hint="Default 4.5% of cell"
                      onChange={(v) => patchNumberLine({ axisThicknessRatio: v })}
                    />
                    <RatioSlider
                      label="Tick height"
                      value={nl.tickHeightRatio ?? DEFAULT_NUMBER_LINE_STYLE.tickHeightRatio}
                      min={0.05}
                      max={0.6}
                      step={0.01}
                      onChange={(v) => patchNumberLine({ tickHeightRatio: v })}
                    />
                    <RatioSlider
                      label="Tick width"
                      value={nl.tickWidthRatio ?? DEFAULT_NUMBER_LINE_STYLE.tickWidthRatio}
                      min={0.01}
                      max={0.15}
                      step={0.005}
                      onChange={(v) => patchNumberLine({ tickWidthRatio: v })}
                    />
                  </div>
                </div>
                <div className="sm:col-span-2 lg:col-span-4">
                  <p className="mb-2 text-xs font-medium text-slate-600">
                    Size & spacing (Unity — or set Number Line Grid Size on CharacterMove)
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <RatioSlider
                      label="Tick spacing (world)"
                      value={nl.tickSpacing ?? 0}
                      min={0}
                      max={300}
                      step={5}
                      hint="0 = use Unity CharacterMove"
                      displayAsPercent={false}
                      onChange={(v) =>
                        patchNumberLine({ tickSpacing: v > 0 ? v : undefined })
                      }
                    />
                    <RatioSlider
                      label="Line spacing scale"
                      value={nl.playfieldScale ?? DEFAULT_NUMBER_LINE_STYLE.playfieldScale}
                      min={0.5}
                      max={3}
                      step={0.05}
                      hint="1 = default"
                      displayAsPercent={false}
                      onChange={(v) => patchNumberLine({ playfieldScale: v })}
                    />
                    <RatioSlider
                      label="Object size"
                      value={nl.objectScale ?? DEFAULT_NUMBER_LINE_STYLE.objectScale}
                      min={0.3}
                      max={3}
                      step={0.05}
                      displayAsPercent={false}
                      onChange={(v) => patchNumberLine({ objectScale: v })}
                    />
                    <RatioSlider
                      label="Robot size"
                      value={nl.robotScale ?? DEFAULT_NUMBER_LINE_STYLE.robotScale}
                      min={0.3}
                      max={3}
                      step={0.05}
                      displayAsPercent={false}
                      onChange={(v) => patchNumberLine({ robotScale: v })}
                    />
                    <RatioSlider
                      label="Above/below offset"
                      value={nl.placementOffsetRatio ?? DEFAULT_NUMBER_LINE_STYLE.placementOffsetRatio}
                      min={0.1}
                      max={0.8}
                      step={0.02}
                      displayAsPercent={false}
                      onChange={(v) => patchNumberLine({ placementOffsetRatio: v })}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="sm:col-span-2 lg:col-span-4"
                  onClick={() =>
                    patchNumberLine({
                      ...DEFAULT_NUMBER_LINE_STYLE,
                      showTickLabels: nl.showTickLabels,
                      showArrows: nl.showArrows,
                    })
                  }
                >
                  Reset colors & sizes to default
                </Button>
              </div>
            )}
          </div>

          {/* Tick inspector */}
          {selectedTick != null && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 text-sm">
              <p className="font-semibold text-indigo-900">Tick {selectedTick}</p>
              {selectedObj.length === 0 &&
                robotTick !== selectedTick &&
                goalTick !== selectedTick && (
                  <p className="mt-1 text-muted-foreground">
                    Empty — select a tool and click again, or drag from the palette.
                  </p>
                )}
              {robotTick === selectedTick && (
                <p className="mt-1 flex items-center gap-1">
                  <Bot className="h-4 w-4" /> Robo starts on the line at this tick
                </p>
              )}
              {!visitSequence && goalTick === selectedTick && (
                <p className="mt-1 flex items-center gap-1">
                  <Target className="h-4 w-4 text-emerald-600" /> Goal on the line
                </p>
              )}
              {visitSequence && visitStep2Tick === selectedTick && (
                <p className="mt-1 flex items-center gap-1">
                  <Target className="h-4 w-4 text-emerald-600" /> Visit step 2 (goal) on this tick
                </p>
              )}
              {selectedObj.map((o) => (
                <div
                  key={`${o.objectType}-${o.placement}`}
                  className="mt-3 rounded-lg border border-white bg-white/80 p-3"
                >
                  <p className="font-medium">
                    {OBJECT_PALETTE.find((p) => p.type === o.objectType)?.label ?? o.objectType}{" "}
                    <span className="text-muted-foreground">({o.placement})</span>
                  </p>
                  <div className="mt-2 flex flex-col gap-2 text-xs">
                    {visitSequence ? (
                      <>
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/80 px-2 py-1.5">
                          <input
                            type="checkbox"
                            checked={o.visitOrder === 1 || !!o.isStartObject}
                            onChange={(e) =>
                              toggleVisitStep(
                                selectedTick!,
                                o.objectType,
                                o.placement,
                                1,
                                e.target.checked
                              )
                            }
                          />
                          <MapPin className="h-3.5 w-3.5 text-blue-600" />
                          Visit step 1 (first — red blink)
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/80 px-2 py-1.5">
                          <input
                            type="checkbox"
                            checked={o.visitOrder === 2 || !!o.isEndObject}
                            onChange={(e) =>
                              toggleVisitStep(
                                selectedTick!,
                                o.objectType,
                                o.placement,
                                2,
                                e.target.checked
                              )
                            }
                          />
                          <Target className="h-3.5 w-3.5 text-emerald-600" />
                          Visit step 2 (second / goal — green blink)
                        </label>
                      </>
                    ) : (
                      <>
                        <label className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={!!o.isStartObject}
                            onChange={(e) => {
                              setObjects(
                                objects.map((x) =>
                                  x.tick === selectedTick &&
                                  x.objectType === o.objectType &&
                                  x.placement === o.placement
                                    ? {
                                        ...x,
                                        isStartObject: e.target.checked,
                                        isEndObject: e.target.checked ? false : x.isEndObject,
                                        visitOrder: undefined,
                                      }
                                    : x
                                )
                              );
                            }}
                          />
                          Start marker (red blink)
                        </label>
                        <label className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={!!o.isEndObject}
                            onChange={(e) => {
                              setObjects(
                                objects.map((x) =>
                                  x.tick === selectedTick &&
                                  x.objectType === o.objectType &&
                                  x.placement === o.placement
                                    ? {
                                        ...x,
                                        isEndObject: e.target.checked,
                                        isStartObject: e.target.checked ? false : x.isStartObject,
                                        visitOrder: undefined,
                                      }
                                    : x
                                )
                              );
                            }}
                          />
                          End marker (green blink)
                        </label>
                      </>
                    )}
                  </div>
                  <label className="mt-2 block text-xs">
                    <span className="text-muted-foreground">Custom image URL</span>
                    <Input
                      className="mt-1 h-8"
                      placeholder="/uploads/…"
                      value={o.imageUrl ?? ""}
                      onChange={(e) => {
                        setObjects(
                          objects.map((x) =>
                            x.tick === selectedTick && x.objectType === o.objectType
                              ? { ...x, imageUrl: e.target.value || undefined }
                              : x
                          )
                        );
                      }}
                    />
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="mt-2"
                    onClick={() =>
                      setObjects(
                        objects.filter(
                          (x) =>
                            !(
                              x.tick === selectedTick &&
                              x.objectType === o.objectType &&
                              x.placement === o.placement
                            )
                        )
                      )
                    }
                  >
                    Remove object
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DesignerSection>
  );
}
