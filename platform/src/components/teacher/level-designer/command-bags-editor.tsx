"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Briefcase,
  CornerDownLeft,
  CornerDownRight,
  GripVertical,
  Minus,
  Plus,
  Puzzle,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Reorder } from "framer-motion";
import type {
  CommandBag,
  CommandBagMode,
  CommandChunk,
  LevelGameplayConfig,
} from "@/lib/level-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  expandRepeatTokens,
  formatRepeatStart,
  isRepeatEnd,
  parseRepeatStart,
} from "@/lib/assessment/expand-repeats";
import { HintImageUpload } from "@/components/teacher/level-designer/hint-image-upload";

type Props = {
  config: LevelGameplayConfig;
  onChange: (config: LevelGameplayConfig) => void;
};

/** Soft pastels matching the Unity Command Bag mockup cards. */
const BAG_COLORS = [
  "#E8D4F0",
  "#C5E8F5",
  "#C8EDC9",
  "#F5D0D0",
  "#DDD4F5",
  "#D0EDE4",
  "#FDE8C8",
];

/** Vivid chunk identity colors (match Unity puzzle palette: purple / blue / green / orange…). */
const CHUNK_COLORS = [
  "#9E66EB", // purple
  "#4794F5", // blue
  "#47C77A", // green
  "#FA8C2E", // orange
  "#EB6190", // pink
  "#33B8C7", // teal
  "#F0C94A", // yellow
];

const MOTION_ACTIONS = [
  { value: "forward", label: "Forward", short: "↑", icon: ArrowUp, chip: "border-sky-200 bg-sky-50 text-sky-900" },
  { value: "backward", label: "Back", short: "↓", icon: ArrowDown, chip: "border-amber-200 bg-amber-50 text-amber-900" },
  { value: "turn left", label: "Left", short: "↺", icon: CornerDownLeft, chip: "border-emerald-200 bg-emerald-50 text-emerald-900" },
  { value: "turn right", label: "Right", short: "↻", icon: CornerDownRight, chip: "border-rose-200 bg-rose-50 text-rose-900" },
] as const;

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function motionLabel(token: string): string {
  return MOTION_ACTIONS.find((a) => a.value === token)?.label ?? token;
}

function motionChipClass(token: string): string {
  return (
    MOTION_ACTIONS.find((a) => a.value === token)?.chip ??
    "border-slate-200 bg-white text-slate-700"
  );
}

type TokenBlock = { id: string; action: string };

function toBlocks(tokens: string[]): TokenBlock[] {
  return tokens.map((action, i) => ({ id: `${action}-${i}`, action }));
}

function fromBlocks(blocks: TokenBlock[]): string[] {
  return blocks.map((b) => b.action);
}

/** Find matching repeat-end index for a start at `startIdx`, or -1. */
function findMatchingRepeatEnd(tokens: string[], startIdx: number): number {
  let depth = 0;
  for (let i = startIdx; i < tokens.length; i++) {
    if (parseRepeatStart(tokens[i]) != null) depth++;
    else if (isRepeatEnd(tokens[i])) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function ExpandedPreview({ tokens }: { tokens: string[] }) {
  const expanded = useMemo(() => expandRepeatTokens(tokens), [tokens]);
  if (tokens.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white/90 px-2.5 py-2">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        <Sparkles className="h-3 w-3 text-sky-500" />
        Robot will run ({expanded.length} step{expanded.length === 1 ? "" : "s"})
      </div>
      {expanded.length === 0 ? (
        <p className="text-xs text-slate-400">
          Add motions inside the Repeat body — empty loops expand to nothing.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {expanded.map((tok, i) => (
            <span
              key={`${tok}-${i}`}
              className={cn(
                "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                motionChipClass(tok)
              )}
            >
              {i + 1}. {motionLabel(tok)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ChunkEditor({
  chunk,
  onChange,
  onRemove,
}: {
  chunk: CommandChunk;
  onChange: (c: CommandChunk) => void;
  onRemove: () => void;
}) {
  const tokens = chunk.tokens ?? [];
  const [dragOver, setDragOver] = useState(false);

  const blocks = useMemo(() => toBlocks(tokens), [tokens]);

  function setTokens(next: string[]) {
    onChange({ ...chunk, tokens: next });
  }

  function setBlocks(next: TokenBlock[]) {
    setTokens(fromBlocks(next));
  }

  function addToken(token: string) {
    setTokens([...tokens, token]);
  }

  function removeAt(index: number) {
    const tok = tokens[index];
    if (tok == null) return;

    // Removing Repeat Start also removes body + matching End (one gesture).
    if (parseRepeatStart(tok) != null) {
      const endIdx = findMatchingRepeatEnd(tokens, index);
      if (endIdx > index) {
        setTokens(tokens.filter((_, i) => i < index || i > endIdx));
        return;
      }
    }
    // Removing End alone just drops the end token.
    setTokens(tokens.filter((_, i) => i !== index));
  }

  function setRepeatCountAt(index: number, count: number) {
    const n = Math.max(1, Math.min(9, Math.floor(count) || 1));
    setTokens(tokens.map((t, i) => (i === index ? formatRepeatStart(n) : t)));
  }

  function addRepeatBlock() {
    // Canvas-style: Start with counter, one seed motion, End.
    setTokens([...tokens, formatRepeatStart(2), "forward", "repeat-end"]);
  }

  function onPaletteDragStart(e: React.DragEvent, value: string) {
    e.dataTransfer.setData("text/plain", value);
    e.dataTransfer.effectAllowed = "copy";
  }

  function onDropZone(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const value = e.dataTransfer.getData("text/plain")?.trim();
    if (!value) return;
    if (value === "repeat") {
      addRepeatBlock();
      return;
    }
    addToken(value);
  }

  const chunkTint = chunk.color || CHUNK_COLORS[0]!;

  return (
    <div
      className="rounded-xl border bg-white p-3 space-y-3 shadow-sm"
      style={{ borderColor: `${chunkTint}66`, borderLeftWidth: 4, borderLeftColor: chunkTint }}
    >
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
        <span
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
          style={{ backgroundColor: chunkTint }}
          title="Puzzle color in Unity"
        >
          <Puzzle className="h-3.5 w-3.5" />
        </span>
        <Input
          value={chunk.name}
          onChange={(e) => onChange({ ...chunk, name: e.target.value })}
          className="h-8 text-sm font-medium"
          placeholder="Chunk name"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onRemove}
          aria-label="Remove chunk"
        >
          <Trash2 className="h-3.5 w-3.5 text-slate-500" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium text-slate-600">Puzzle color</span>
        <div className="flex flex-wrap gap-1.5">
          {CHUNK_COLORS.map((c) => {
            const selected = (chunk.color || "").toUpperCase() === c.toUpperCase();
            return (
              <button
                key={c}
                type="button"
                title={c}
                onClick={() => onChange({ ...chunk, color: c })}
                className={cn(
                  "h-7 w-7 rounded-full border-2 transition-transform",
                  selected ? "border-slate-800 scale-110 ring-2 ring-slate-300" : "border-white shadow-sm"
                )}
                style={{ backgroundColor: c }}
                aria-label={`Set chunk color ${c}`}
              />
            );
          })}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Motions in this chunk
        </p>
      {/* Program strip — same mental model as Canvas pattern builder */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDropZone}
        className={cn(
          "min-h-[4.25rem] rounded-xl border-2 border-dashed p-2.5 transition-colors",
          tokens.length === 0 ? "bg-slate-50/80" : "bg-slate-50/40",
          dragOver ? "border-sky-400 bg-sky-50/50 ring-2 ring-sky-200" : "border-slate-200"
        )}
      >
        {blocks.length === 0 ? (
          <div className="flex min-h-[3rem] flex-col items-center justify-center gap-0.5 text-center">
            <p className="text-sm font-medium text-slate-500">Build this chunk</p>
            <p className="text-[11px] text-slate-400">
              Tap arrows below · add Repeat with a counter · drag to reorder
            </p>
          </div>
        ) : (
          <Reorder.Group
            axis="x"
            values={blocks}
            onReorder={setBlocks}
            className="flex flex-wrap items-center gap-1.5"
          >
            {blocks.map((block, i) => {
              const repeatCount = parseRepeatStart(block.action);
              const end = isRepeatEnd(block.action);
              const meta = MOTION_ACTIONS.find((a) => a.value === block.action);
              const Icon = meta?.icon ?? RotateCcw;

              return (
                <Reorder.Item
                  key={block.id}
                  value={block}
                  className="cursor-grab active:cursor-grabbing"
                  whileDrag={{ scale: 1.05, zIndex: 20 }}
                >
                  <span className="inline-flex items-center gap-0.5">
                    {repeatCount != null ? (
                      <span className="inline-flex items-center gap-1 rounded-xl border-2 border-violet-300 bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-900 shadow-sm">
                        <RotateCcw className="h-3.5 w-3.5" />
                        Repeat
                        <span
                          className="ml-0.5 inline-flex items-center gap-0.5 rounded-lg bg-white p-0.5 ring-1 ring-violet-200"
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="rounded p-0.5 text-violet-700 hover:bg-violet-100 disabled:opacity-40"
                            disabled={repeatCount <= 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              setRepeatCountAt(i, repeatCount - 1);
                            }}
                            aria-label="Decrease repeat count"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-[1.25rem] text-center text-xs font-bold tabular-nums">
                            {repeatCount}
                          </span>
                          <button
                            type="button"
                            className="rounded p-0.5 text-violet-700 hover:bg-violet-100 disabled:opacity-40"
                            disabled={repeatCount >= 9}
                            onClick={(e) => {
                              e.stopPropagation();
                              setRepeatCountAt(i, repeatCount + 1);
                            }}
                            aria-label="Increase repeat count"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      </span>
                    ) : end ? (
                      <span className="inline-flex items-center gap-1 rounded-xl border-2 border-orange-300 bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-900 shadow-sm">
                        End
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-xl border-2 px-2 py-1 text-xs font-semibold shadow-sm",
                          motionChipClass(block.action)
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {meta?.label ?? block.action}
                      </span>
                    )}
                    <button
                      type="button"
                      className="rounded-md p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"
                      onClick={() => removeAt(i)}
                      aria-label="Remove"
                      title={
                        repeatCount != null
                          ? "Remove this Repeat block (Start → End)"
                          : "Remove"
                      }
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
        )}
      </div>

      {/* Palette */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Add to chunk
        </p>
        <div className="flex flex-wrap gap-1.5">
          {MOTION_ACTIONS.map((a) => (
            <button
              key={a.value}
              type="button"
              draggable
              onDragStart={(e) => onPaletteDragStart(e, a.value)}
              onClick={() => addToken(a.value)}
              className={cn(
                "inline-flex h-8 cursor-grab items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium shadow-sm transition hover:scale-[1.02] active:cursor-grabbing",
                a.chip
              )}
            >
              <a.icon className="h-3.5 w-3.5" />
              {a.label}
            </button>
          ))}
          <button
            type="button"
            draggable
            onDragStart={(e) => onPaletteDragStart(e, "repeat")}
            onClick={addRepeatBlock}
            className="inline-flex h-8 cursor-grab items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-2.5 text-[11px] font-semibold text-violet-900 shadow-sm transition hover:scale-[1.02] active:cursor-grabbing"
            title="Adds Repeat ×2 with a body and End — change the counter on the chip"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Repeat ×N
          </button>
        </div>
        <p className="text-[11px] leading-snug text-slate-400">
          Put motions <span className="font-medium text-slate-500">between</span> Repeat and End.
          Use − / + on the purple chip to set how many times the body runs (1–9).
        </p>
      </div>

      <ExpandedPreview tokens={tokens} />
      </div>
    </div>
  );
}

function BagEditor({
  bag,
  mode,
  onChange,
  onRemove,
}: {
  bag: CommandBag;
  mode: DragMode;
  onChange: (b: CommandBag) => void;
  onRemove: () => void;
}) {
  const chunks = bag.chunks ?? [];
  const isChunkMode = mode === "CHUNK";

  const bagExpandedCount = useMemo(() => {
    let n = 0;
    for (const c of chunks) {
      n += expandRepeatTokens(c.tokens ?? []).length;
    }
    return n;
  }, [chunks]);

  function updateChunk(index: number, next: CommandChunk) {
    const copy = [...chunks];
    copy[index] = next;
    onChange({ ...bag, chunks: copy });
  }

  function removeChunk(index: number) {
    onChange({ ...bag, chunks: chunks.filter((_, i) => i !== index) });
  }

  function addChunk() {
    const color = CHUNK_COLORS[chunks.length % CHUNK_COLORS.length]!;
    onChange({
      ...bag,
      chunks: [
        ...chunks,
        {
          id: newId("chunk"),
          name: `Chunk ${chunks.length + 1}`,
          color,
          tokens: [],
        },
      ],
    });
  }

  function reorderChunks(next: CommandChunk[]) {
    onChange({ ...bag, chunks: next });
  }

  const bagTint = bag.color || "#C5E8F5";

  return (
    <div
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      style={{ borderTopWidth: 4, borderTopColor: isChunkMode ? "#8B5CF6" : bagTint }}
    >
      {/* Bag identity — compact in chunk mode */}
      <div
        className={cn(
          "space-y-3 border-b border-slate-100 px-4",
          isChunkMode ? "py-2.5" : "py-3.5"
        )}
        style={{ backgroundColor: isChunkMode ? "#F5F3FF" : `${bagTint}33` }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1",
              isChunkMode
                ? "bg-violet-100 text-violet-900 ring-violet-200"
                : "bg-white/90 text-slate-700 ring-slate-200/80"
            )}
          >
            {isChunkMode ? <Puzzle className="h-3.5 w-3.5" /> : <Briefcase className="h-3.5 w-3.5" />}
            {isChunkMode ? "Chunk group" : "Command Bag"}
          </span>
          <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200/60">
            {chunks.length} chunk{chunks.length === 1 ? "" : "s"} · {bagExpandedCount} step
            {bagExpandedCount === 1 ? "" : "s"}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-8 text-slate-500 hover:text-red-600"
            onClick={onRemove}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Remove
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={bag.name}
            onChange={(e) => onChange({ ...bag, name: e.target.value })}
            className="h-9 max-w-xs bg-white font-semibold"
            placeholder={isChunkMode ? "Group name" : "Bag name"}
          />
          {!isChunkMode && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-600">Bag color</span>
              {BAG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  onClick={() => onChange({ ...bag, color: c })}
                  className={cn(
                    "h-6 w-6 rounded-full border-2 transition-transform",
                    bagTint === c ? "border-slate-800 scale-110" : "border-white shadow-sm"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}
        </div>

        {!isChunkMode && (
          <HintImageUpload
            imageUrl={bag.icon}
            onChange={(url) => onChange({ ...bag, icon: url })}
            label="Bag image (optional)"
            hint="Appears on the bag card in Unity."
          />
        )}
      </div>

      {/* Chunks */}
      <div className="space-y-3 bg-slate-50/40 px-4 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <Puzzle className="h-4 w-4 text-violet-600" />
              {isChunkMode ? "Chunks students can drag" : "Program inside this bag"}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {isChunkMode
                ? "Each chunk is a puzzle piece. Drag to reorder."
                : "Chunks run top → bottom when the student drops this bag."}
            </p>
          </div>
          {/* Only show Add chunk here in chunk mode — bag mode uses page-level Add bag */}
          {isChunkMode && (
            <Button type="button" size="sm" onClick={addChunk}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add chunk
            </Button>
          )}
        </div>

        {chunks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center">
            <Puzzle className="mx-auto mb-1.5 h-6 w-6 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No chunks yet</p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {isChunkMode
                ? "Add a chunk, then drop arrows and Repeat into it."
                : "This bag needs at least one chunk of motions."}
            </p>
            {isChunkMode && (
              <Button type="button" size="sm" className="mt-3" onClick={addChunk}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add chunk
              </Button>
            )}
            {!isChunkMode && (
              <Button type="button" size="sm" variant="outline" className="mt-3 bg-white" onClick={addChunk}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add first chunk
              </Button>
            )}
          </div>
        ) : (
          <>
            <Reorder.Group axis="y" values={chunks} onReorder={reorderChunks} className="space-y-2.5">
              {chunks.map((chunk, i) => (
                <Reorder.Item key={chunk.id} value={chunk}>
                  <ChunkEditor
                    chunk={chunk}
                    onChange={(c) => updateChunk(i, c)}
                    onRemove={() => removeChunk(i)}
                  />
                </Reorder.Item>
              ))}
            </Reorder.Group>
            {/* Bag mode: quiet way to add another sequence piece without competing with Add bag */}
            {!isChunkMode && (
              <button
                type="button"
                onClick={addChunk}
                className="text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-violet-700 hover:underline"
              >
                + Add another chunk to this bag
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

type DragMode = "BAG" | "CHUNK";

function toDragMode(mode?: CommandBagMode): DragMode {
  // MIXED is retired in the UI — treat as Chunk so existing levels stay chunk-first.
  return mode === "CHUNK" || mode === "MIXED" ? "CHUNK" : "BAG";
}

const MODE_OPTIONS: {
  value: DragMode;
  label: string;
  shortLabel: string;
  studentSees: string;
  hint: string;
  icon: typeof Briefcase;
}[] = [
  {
    value: "BAG",
    label: "Command Bags",
    shortLabel: "Bags",
    studentSees: "Students drag whole bags",
    hint: "Build bags first. Each bag holds a program students drop as one unit.",
    icon: Briefcase,
  },
  {
    value: "CHUNK",
    label: "Action Chunks",
    shortLabel: "Chunks",
    studentSees: "Students drag individual chunks",
    hint: "Build chunks first. Students open a group and pick puzzle pieces.",
    icon: Puzzle,
  },
];

function createStarterChunk(index = 0): CommandChunk {
  return {
    id: newId("chunk"),
    name: `Chunk ${index + 1}`,
    color: CHUNK_COLORS[index % CHUNK_COLORS.length]!,
    tokens: [formatRepeatStart(2), "turn left", "repeat-end"],
  };
}

function createStarterBag(bagIndex: number, withChunk: boolean): CommandBag {
  return {
    id: newId("bag"),
    name: `Command Bag ${bagIndex + 1}`,
    color: BAG_COLORS[bagIndex % BAG_COLORS.length]!,
    chunks: withChunk ? [createStarterChunk(0)] : [],
  };
}

export function CommandBagsEditor({ config, onChange }: Props) {
  const bags = config.commandBags ?? [];
  const mode = toDragMode(config.commandBagMode);
  const hasMode = config.commandBagMode === "BAG" || config.commandBagMode === "CHUNK" || config.commandBagMode === "MIXED" || bags.length > 0;
  // Require an explicit choice before showing editors when starting fresh
  const [typeChosen, setTypeChosen] = useState(hasMode);

  // Retire MIXED: rewrite to CHUNK when an older level still has it.
  useEffect(() => {
    if (config.commandBagMode === "MIXED") {
      onChange({ ...config, commandBagMode: "CHUNK" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only coerce once when MIXED is present
  }, [config.commandBagMode]);

  const summary = useMemo(() => {
    const chunkCount = bags.reduce((n, b) => n + (b.chunks?.length ?? 0), 0);
    const steps = bags.reduce((n, b) => {
      for (const c of b.chunks ?? []) n += expandRepeatTokens(c.tokens ?? []).length;
      return n;
    }, 0);
    return { bags: bags.length, chunks: chunkCount, steps };
  }, [bags]);

  function patch(partial: Partial<LevelGameplayConfig>) {
    onChange({ ...config, ...partial });
  }

  function setMode(next: DragMode) {
    setTypeChosen(true);
    patch({ commandBagMode: next, commandBags: bags.length ? bags : undefined });
  }

  function updateBag(index: number, next: CommandBag) {
    const copy = [...bags];
    copy[index] = next;
    patch({ commandBags: copy, commandBagMode: mode });
  }

  function removeBag(index: number) {
    const next = bags.filter((_, i) => i !== index);
    patch({
      commandBags: next.length ? next : undefined,
      commandBagMode: next.length ? mode : mode,
    });
  }

  function addBag() {
    patch({
      commandBagMode: "BAG",
      commandBags: [...bags, createStarterBag(bags.length, true)],
    });
  }

  function addChunk() {
    // Chunk mode: add into last group, or create a group + chunk
    if (bags.length === 0) {
      patch({
        commandBagMode: "CHUNK",
        commandBags: [createStarterBag(0, true)],
      });
      return;
    }
    const last = bags.length - 1;
    const target = bags[last]!;
    const chunks = target.chunks ?? [];
    const nextBag: CommandBag = {
      ...target,
      chunks: [...chunks, createStarterChunk(chunks.length)],
    };
    const copy = [...bags];
    copy[last] = nextBag;
    patch({ commandBagMode: "CHUNK", commandBags: copy });
  }

  function addChunkGroup() {
    patch({
      commandBagMode: "CHUNK",
      commandBags: [...bags, { ...createStarterBag(bags.length, false), name: `Chunk group ${bags.length + 1}` }],
    });
  }

  const showWorkspace = typeChosen;

  return (
    <div className="space-y-5">
      {/* Step 1 — type */}
      <div className="space-y-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">1. Choose what students drag</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Pick one type first. Then you only add that type — no mixed options.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {MODE_OPTIONS.map((opt) => {
            const active = showWorkspace && mode === opt.value;
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMode(opt.value)}
                className={cn(
                  "rounded-xl border px-3.5 py-3 text-left transition-all",
                  active
                    ? opt.value === "CHUNK"
                      ? "border-violet-500 bg-violet-50 ring-2 ring-violet-200"
                      : "border-sky-500 bg-sky-50 ring-2 ring-sky-200"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex h-9 w-9 items-center justify-center rounded-lg",
                      active
                        ? opt.value === "CHUNK"
                          ? "bg-violet-500 text-white"
                          : "bg-sky-500 text-white"
                        : "bg-slate-100 text-slate-600"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{opt.label}</div>
                    <div
                      className={cn(
                        "text-[11px] font-medium",
                        active
                          ? opt.value === "CHUNK"
                            ? "text-violet-700"
                            : "text-sky-700"
                          : "text-slate-500"
                      )}
                    >
                      {opt.studentSees}
                    </div>
                  </div>
                  {active && (
                    <span
                      className={cn(
                        "ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white",
                        opt.value === "CHUNK" ? "bg-violet-500" : "bg-sky-500"
                      )}
                    >
                      Selected
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[11px] leading-snug text-slate-500">{opt.hint}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2 — workspace for selected type only */}
      {!showWorkspace ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center">
          <p className="text-sm font-medium text-slate-600">Select Bags or Chunks above to continue</p>
          <p className="mt-1 text-xs text-slate-400">Your add buttons and editor will match that choice.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                2. {mode === "BAG" ? "Build your bags" : "Build your chunks"}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {mode === "BAG"
                  ? "Add bags. Each bag gets a program students drop as one unit."
                  : "Add chunks. Students pick them from a group in the blue palette."}
                {bags.length > 0 && (
                  <span className="ml-1 tabular-nums text-slate-400">
                    · {summary.bags} {mode === "BAG" ? "bag" : "group"}
                    {summary.bags === 1 ? "" : "s"} · {summary.chunks} chunk
                    {summary.chunks === 1 ? "" : "s"}
                  </span>
                )}
              </p>
            </div>
            {mode === "BAG" ? (
              <Button type="button" size="sm" onClick={addBag}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add bag
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={addChunk}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add chunk
              </Button>
            )}
          </div>

          {bags.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center">
              {mode === "BAG" ? (
                <>
                  <Briefcase className="mx-auto mb-2 h-8 w-8 text-sky-300" />
                  <p className="text-sm font-medium text-slate-700">No bags yet</p>
                  <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
                    Create a bag, then fill its program with arrows and{" "}
                    <span className="font-semibold text-violet-700">Repeat ×N</span>.
                  </p>
                  <Button type="button" size="sm" className="mt-4" onClick={addBag}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Create first bag
                  </Button>
                </>
              ) : (
                <>
                  <Puzzle className="mx-auto mb-2 h-8 w-8 text-violet-300" />
                  <p className="text-sm font-medium text-slate-700">No chunks yet</p>
                  <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
                    Create a chunk, then drop arrows and{" "}
                    <span className="font-semibold text-violet-700">Repeat ×N</span> into it.
                  </p>
                  <Button type="button" size="sm" className="mt-4" onClick={addChunk}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Create first chunk
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {bags.map((bag, i) => (
                <BagEditor
                  key={bag.id}
                  bag={bag}
                  mode={mode}
                  onChange={(b) => updateBag(i, b)}
                  onRemove={() => removeBag(i)}
                />
              ))}
              {mode === "CHUNK" && bags.length > 0 && (
                <button
                  type="button"
                  onClick={addChunkGroup}
                  className="text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-violet-700 hover:underline"
                >
                  + New chunk group (optional)
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
