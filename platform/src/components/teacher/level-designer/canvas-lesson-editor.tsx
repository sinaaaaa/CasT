"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { motion, Reorder, AnimatePresence } from "framer-motion";
import {
  DEFAULT_CANVAS_LESSON,
  DEFAULT_CANVAS_PATTERN_EMPHASIS,
  contiguousHighlightRuns,
  countActionInPattern,
  defaultCountPrompt,
  formatCountAnswerToken,
  resolveCanvasLessonImagePx,
  resolveCanvasPatternTokenPx,
  resolveCanvasSectionLabel,
  resolveEmphasisHighlightChunk,
  resolveEnabledActionButtons,
  resolveHighlightedPatternIndices,
  type CanvasCountAction,
  type CanvasLessonConfig,
  type CanvasLessonImageSize,
  type CanvasPatternEmphasis,
  type LevelGameplayConfig,
  type RobotActionButton,
} from "@/lib/level-config";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HintImageUpload } from "@/components/teacher/level-designer/hint-image-upload";
import { HintAudioUpload } from "@/components/teacher/level-designer/hint-audio-upload";
import { CanvasStripModePicker } from "@/components/teacher/level-designer/canvas-strip-mode-picker";
import { GUIDED_ACTIONS } from "@/lib/level-editor-constants";
import { suggestProgramVariants, formatRepeatStart, parseRepeatStart, isRepeatEnd } from "@/lib/assessment/expand-repeats";
import { normalizeCommandToken, COMMAND_ICON_PATHS } from "@/lib/command-icons";
import { REPEAT_ICON_PATHS } from "@/components/assessment/program-sequence-visualizer";
import {
  getCanvasStripType,
  type CanvasStripMode,
} from "@/lib/canvas-strip-types";
import {
  ArrowDown,
  ArrowUp,
  CornerDownLeft,
  CornerDownRight,
  Eye,
  GripVertical,
  Highlighter,
  ImageIcon,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import { RichTextEditor, RichTextPreview } from "@/components/ui/rich-text-editor";
import { richTextToPlain } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

type Props = {
  config: LevelGameplayConfig;
  onChange: (config: LevelGameplayConfig) => void;
};

type TokenBlock = { id: string; action: string };
const TOKEN_PALETTE = [
  "forward",
  "backward",
  "turn left",
  "turn right",
  "blank",
  "repeat:1",
  "repeat-end",
] as const;

const TOKEN_STYLE: Record<
  string,
  { bg: string; border: string; text: string; icon: React.ReactNode }
> = {
  forward: {
    bg: "bg-sky-50",
    border: "border-sky-300",
    text: "text-sky-800",
    icon: <ArrowUp className="h-3.5 w-3.5 text-sky-600" />,
  },
  backward: {
    bg: "bg-indigo-50",
    border: "border-indigo-300",
    text: "text-indigo-800",
    icon: <ArrowDown className="h-3.5 w-3.5 text-indigo-600" />,
  },
  "turn left": {
    bg: "bg-amber-50",
    border: "border-amber-300",
    text: "text-amber-900",
    icon: <CornerDownLeft className="h-3.5 w-3.5 text-amber-600" />,
  },
  "turn right": {
    bg: "bg-orange-50",
    border: "border-orange-300",
    text: "text-orange-900",
    icon: <CornerDownRight className="h-3.5 w-3.5 text-orange-600" />,
  },
  blank: {
    bg: "bg-transparent",
    border: "border-transparent",
    text: "text-slate-600",
    icon: (
      <span
        className="inline-block h-1.5 w-10 rounded-full bg-slate-500/85"
        aria-hidden
      />
    ),
  },
  "repeat:1": {
    bg: "bg-violet-50",
    border: "border-violet-300",
    text: "text-violet-900",
    icon: <RotateCcw className="h-3.5 w-3.5 text-violet-700" />,
  },
  "repeat:2": {
    bg: "bg-violet-50",
    border: "border-violet-300",
    text: "text-violet-900",
    icon: <RotateCcw className="h-3.5 w-3.5 text-violet-700" />,
  },
  "repeat-end": {
    bg: "bg-fuchsia-50",
    border: "border-fuchsia-300",
    text: "text-fuchsia-900",
    icon: <RotateCcw className="h-3.5 w-3.5 text-fuchsia-700" />,
  },
};

function CountAnswerCounterPreview({
  value,
  min = 0,
  max = 20,
  onChange,
  readOnly = false,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange?: (n: number) => void;
  readOnly?: boolean;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        disabled={readOnly || value <= min}
        onClick={() => onChange?.(clamp(value - 1))}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-400/80 bg-white text-lg font-bold text-slate-700 shadow-sm disabled:opacity-40"
        aria-label="Decrease count"
      >
        −
      </button>
      <span className="flex h-10 min-w-[2.75rem] items-center justify-center rounded-lg border border-amber-400/80 bg-white px-2 text-xl font-bold tabular-nums text-slate-900 shadow-sm">
        {value}
      </span>
      <button
        type="button"
        disabled={readOnly || value >= max}
        onClick={() => onChange?.(clamp(value + 1))}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-400/80 bg-white text-lg font-bold text-slate-700 shadow-sm disabled:opacity-40"
        aria-label="Increase count"
      >
        +
      </button>
    </div>
  );
}

function tokenLabel(value: string) {
  if (value === "blank") return "Blank";
  if (value.startsWith("repeat:") || value === "repeat" || value === "repeat-start") {
    const n = value.includes(":") ? value.split(":")[1] ?? "1" : "1";
    return `Repeat ×${n}`;
  }
  return GUIDED_ACTIONS.find((g) => g.value === value)?.label ?? value;
}

function isBlankToken(action: string) {
  return action.trim().toLowerCase() === "blank";
}

function BlankLineMark({ className, height }: { className?: string; height?: number }) {
  return (
    <span
      className={cn("inline-block shrink-0 rounded-full bg-slate-700/90", className)}
      style={{ height: height ?? 6 }}
      aria-hidden
    />
  );
}

function styleFor(action: string) {
  if (TOKEN_STYLE[action]) return TOKEN_STYLE[action];
  if (action.startsWith("repeat:")) return TOKEN_STYLE["repeat:1"];
  return {
    bg: "bg-slate-50",
    border: "border-slate-300",
    text: "text-slate-800",
    icon: <Sparkles className="h-3.5 w-3.5 text-slate-500" />,
  };
}

function toBlocks(actions: string[], prefix: string): TokenBlock[] {
  return actions.map((action, i) => ({ id: `${prefix}-${i}-${action}`, action }));
}

function TokenChip({
  action,
  size = "md",
  showGrip,
}: {
  action: string;
  size?: "sm" | "md";
  showGrip?: boolean;
}) {
  const style = styleFor(action);
  const cmd = normalizeCommandToken(action);
  const iconPath = cmd ? COMMAND_ICON_PATHS[cmd] : null;
  const dim = size === "sm" ? 28 : 36;
  const blank = isBlankToken(action);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl border-2 font-medium shadow-sm",
        style.bg,
        style.border,
        style.text,
        size === "sm" ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-xs"
      )}
    >
      {showGrip && <GripVertical className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
      {blank ? (
        <BlankLineMark className="w-10" height={size === "sm" ? 5 : 6} />
      ) : iconPath ? (
        <Image src={iconPath} alt="" width={dim - 10} height={dim - 10} className="object-contain" />
      ) : (
        style.icon
      )}
      <span>{tokenLabel(action)}</span>
    </span>
  );
}

function DragTokenRowEditor({
  title,
  description,
  tokens,
  onChange,
  accent = "violet",
}: {
  title: string;
  description: string;
  tokens: string[];
  onChange: (next: string[]) => void;
  accent?: "violet" | "teal";
}) {
  const [dragOver, setDragOver] = useState(false);
  const blocks = useMemo(() => toBlocks(tokens, title), [tokens, title]);

  function setBlocks(next: TokenBlock[]) {
    onChange(next.map((b) => b.action));
  }

  function setRepeatCountAt(index: number, nextCount: number) {
    const next = [...tokens];
    if (parseRepeatStart(next[index] ?? "") == null) return;
    const count = Math.max(1, Math.min(9, nextCount));
    next[index] = formatRepeatStart(count);
    onChange(next);
  }

  function onPaletteDragStart(e: React.DragEvent, value: string) {
    e.dataTransfer.setData("text/canvas-token", value);
    e.dataTransfer.effectAllowed = "copy";
  }

  function onDropZone(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const value = e.dataTransfer.getData("text/canvas-token");
    if (value) onChange([...tokens, value]);
  }

  const ring =
    accent === "teal"
      ? "border-teal-300 ring-teal-200"
      : "border-violet-300 ring-violet-200";
  const emptyRing =
    accent === "teal" ? "border-teal-200/80" : "border-violet-200/80";

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/80 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        {tokens.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-slate-500"
            onClick={() => onChange([])}
          >
            Clear
          </Button>
        )}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDropZone}
        className={cn(
          "relative min-h-[4.5rem] rounded-xl border-2 border-dashed p-3 transition-all",
          tokens.length === 0 ? "bg-white/70" : "bg-white",
          dragOver ? cn(ring, "ring-2") : emptyRing
        )}
      >
        {blocks.length === 0 ? (
          <div className="flex h-full min-h-[3.25rem] flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm font-medium text-slate-500">Drop blocks here</p>
            <p className="text-xs text-slate-400">or tap a block below · drag to reorder</p>
          </div>
        ) : (
          <Reorder.Group
            axis="x"
            values={blocks}
            onReorder={setBlocks}
            className="flex flex-wrap gap-2"
          >
            {blocks.map((block, i) => {
              const repeatCount = parseRepeatStart(block.action);
              return (
                <Reorder.Item
                  key={block.id}
                  value={block}
                  className="cursor-grab active:cursor-grabbing"
                  whileDrag={{ scale: 1.06, zIndex: 20 }}
                >
                  <span className="inline-flex items-center gap-1">
                    <TokenChip action={block.action} showGrip />
                    {repeatCount != null && (
                      <span
                        className="inline-flex items-center gap-0.5 rounded-lg bg-violet-50 p-0.5 ring-1 ring-violet-200"
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
                        <span className="min-w-[1.25rem] text-center text-xs font-bold tabular-nums text-violet-900">
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
                    )}
                    <button
                      type="button"
                      className="rounded-md p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"
                      onClick={() => onChange(tokens.filter((_, j) => j !== i))}
                      aria-label="Remove"
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

      <div className="flex flex-wrap gap-2">
        {TOKEN_PALETTE.map((value) => {
          const style = styleFor(value);
          return (
            <button
              key={value}
              type="button"
              draggable
              onDragStart={(e) => onPaletteDragStart(e, value)}
              onClick={() => onChange([...tokens, value])}
              className={cn(
                "inline-flex cursor-grab items-center gap-1.5 rounded-xl border-2 px-2.5 py-1.5 text-xs font-medium shadow-sm transition hover:scale-[1.03] active:cursor-grabbing",
                style.bg,
                style.border,
                style.text
              )}
            >
              <Plus className="h-3 w-3 opacity-60" />
              {style.icon}
              {tokenLabel(value)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PatternTokenIcon({
  action,
  px,
  dimmed,
}: {
  action: string;
  px: number;
  dimmed?: boolean;
}) {
  if (isBlankToken(action)) {
    const lineH = Math.max(24, Math.round(px * 0.4));
    return (
      <span
        className={cn(
          "relative inline-flex items-end justify-center",
          dimmed && "opacity-90"
        )}
        style={{ width: px, height: px, paddingBottom: px * 0.04 }}
        title="Blank — student fills this"
      >
        <BlankLineMark className="w-[92%] rounded-md bg-slate-800" height={lineH} />
      </span>
    );
  }

  const cmd = normalizeCommandToken(action);
  const iconPath = cmd ? COMMAND_ICON_PATHS[cmd] : null;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center",
        dimmed && "opacity-70"
      )}
      style={{ width: px, height: px }}
      title={tokenLabel(action)}
    >
      {iconPath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={iconPath} alt="" className="h-[86%] w-[86%] object-contain" />
      ) : (
        <span className="text-[10px] font-bold text-slate-600">{tokenLabel(action)}</span>
      )}
    </span>
  );
}

function RepeatBoundaryIcon({
  kind,
  count,
  px,
}: {
  kind: "start" | "end";
  count: number;
  px: number;
}) {
  if (kind === "start") {
    const w = Math.round(px * 1.1);
    const h = Math.round(px * 1.35);
    return (
      <span
        className="relative inline-flex shrink-0 drop-shadow-sm"
        style={{ width: w, height: h }}
        title={`Repeat start x${count}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={REPEAT_ICON_PATHS.start}
          alt=""
          className="h-full w-full object-fill"
        />
      </span>
    );
  }

  // End: count badge only (no − / + on the canvas board).
  const w = Math.round(px * 1.35);
  const h = Math.round(px * 1.35);
  const box = Math.max(16, Math.round(h * 0.32));
  return (
    <span
      className="relative inline-flex shrink-0 drop-shadow-sm"
      style={{ width: w, height: h }}
      title={`Repeat end x${count}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={REPEAT_ICON_PATHS.end}
        alt=""
        className="h-full w-full object-fill"
      />
      <span
        className="absolute bottom-[14%] left-[58%] z-[1] flex -translate-x-1/2 items-center justify-center rounded-md bg-white text-[10px] font-bold tabular-nums text-slate-900 shadow-sm"
        style={{ width: box, height: box }}
      >
        {count}
      </span>
    </span>
  );
}

type PatternVisualPiece =
  | { type: "tokens"; start: number; end: number }
  | {
      type: "repeat";
      start: number;
      end: number;
      count: number;
      bodyStart: number;
      bodyEnd: number;
    };

function buildPatternVisualPieces(tokens: string[]): PatternVisualPiece[] {
  const pieces: PatternVisualPiece[] = [];
  let i = 0;
  while (i < tokens.length) {
    const count = parseRepeatStart(tokens[i] ?? "");
    if (count != null) {
      let endIdx = -1;
      for (let j = i + 1; j < tokens.length; j++) {
        if (isRepeatEnd(tokens[j] ?? "")) {
          endIdx = j;
          break;
        }
        if (parseRepeatStart(tokens[j] ?? "") != null) break;
      }
      if (endIdx > i) {
        pieces.push({
          type: "repeat",
          start: i,
          end: endIdx + 1,
          count,
          bodyStart: i + 1,
          bodyEnd: endIdx,
        });
        i = endIdx + 1;
        continue;
      }
    }
    const flatStart = i;
    i += 1;
    while (i < tokens.length) {
      const nextCount = parseRepeatStart(tokens[i] ?? "");
      if (nextCount != null) {
        let hasEnd = false;
        for (let j = i + 1; j < tokens.length; j++) {
          if (isRepeatEnd(tokens[j] ?? "")) {
            hasEnd = true;
            break;
          }
          if (parseRepeatStart(tokens[j] ?? "") != null) break;
        }
        if (hasEnd) break;
      }
      i += 1;
    }
    pieces.push({ type: "tokens", start: flatStart, end: i });
  }
  return pieces;
}

function PatternPreviewRow({ lesson }: { lesson: CanvasLessonConfig }) {
  const emphasis = {
    ...DEFAULT_CANVAS_PATTERN_EMPHASIS,
    ...lesson.patternEmphasis,
  };
  const tokens = lesson.patternPreview ?? [];
  const highlightUnit = resolveEmphasisHighlightChunk(
    emphasis,
    lesson.exampleChunk
  );
  const highlighted = resolveHighlightedPatternIndices(
    tokens,
    highlightUnit,
    emphasis
  );
  const basePx = resolveCanvasPatternTokenPx(emphasis.scale);
  const hotPx = emphasis.bigger ? Math.round(basePx * 1.22) : basePx;
  const hasHot = highlighted.size > 0;
  const pieces = buildPatternVisualPieces(tokens);

  return (
    <div className="relative flex flex-col items-center gap-2">
      <motion.div
        layout
        className="relative flex max-w-full flex-nowrap items-center justify-center gap-2 overflow-hidden rounded-[1.6rem] px-5 py-4"
        style={{
          background: "#F6F7FF",
          boxShadow: "inset 0 0 0 3px #8D9AD1, 0 8px 20px -12px rgba(55,65,110,0.35)",
        }}
      >
        {pieces.map((piece) => {
          if (piece.type === "repeat") {
            const body = tokens.slice(piece.bodyStart, piece.bodyEnd);
            const sleeveHot = Array.from(
              { length: piece.end - piece.start },
              (_, n) => piece.start + n
            ).some((idx) => highlighted.has(idx));
            const px = sleeveHot ? hotPx : basePx;
            return (
              <div
                key={`rep-${piece.start}`}
                className="inline-flex items-center gap-1 rounded-2xl bg-amber-200/80 px-1 py-1 ring-1 ring-amber-300/70"
                title={`Repeat ×${piece.count}`}
              >
                <RepeatBoundaryIcon kind="start" count={piece.count} px={px} />
                {body.map((t, n) => (
                  <PatternTokenIcon
                    key={`${t}-${piece.bodyStart + n}`}
                    action={t}
                    px={px}
                  />
                ))}
                <RepeatBoundaryIcon kind="end" count={piece.count} px={px} />
              </div>
            );
          }

          const sliceTokens = tokens.slice(piece.start, piece.end);
          const localHighlighted = new Set(
            Array.from(highlighted)
              .filter((idx) => idx >= piece.start && idx < piece.end)
              .map((idx) => idx - piece.start)
          );
          const runs = contiguousHighlightRuns(sliceTokens.length, localHighlighted);

          return (
            <div key={`flat-${piece.start}`} className="flex items-end gap-2">
              {runs.map((run) => {
                const slice = sliceTokens.slice(run.start, run.end);
                if (!run.hot) {
                  return (
                    <div key={`rest-${piece.start + run.start}`} className="flex items-end gap-2">
                      {slice.map((t, n) => (
                        <PatternTokenIcon
                          key={`${t}-${piece.start + run.start + n}`}
                          action={t}
                          px={basePx}
                          dimmed={hasHot}
                        />
                      ))}
                    </div>
                  );
                }

                return (
                  <motion.div
                    key={`unit-${piece.start + run.start}`}
                    layout
                    initial={{ opacity: 0, y: 8, scale: 0.92 }}
                    animate={
                      emphasis.blink
                        ? { opacity: 1, y: [0, -5, 0], scale: [1, 1.035, 1] }
                        : { opacity: 1, y: 0, scale: 1 }
                    }
                    transition={
                      emphasis.blink
                        ? { duration: 1.8, repeat: Infinity, ease: [0.45, 0.05, 0.55, 0.95] }
                        : { type: "spring", stiffness: 380, damping: 24 }
                    }
                    className="relative flex items-end gap-1.5 rounded-[1.4rem] px-3 py-2"
                    style={{
                      background: emphasis.redBorder ? "#FFF7F0" : "#FFF9ED",
                      boxShadow: emphasis.redBorder
                        ? "inset 0 0 0 3px #E24B3A, 0 10px 28px -10px rgba(226,75,58,0.55)"
                        : "inset 0 0 0 2px #E8B84A, 0 8px 20px -10px rgba(232,184,74,0.45)",
                    }}
                    title="Repeating unit"
                  >
                    {emphasis.blink && (
                      <motion.span
                        aria-hidden
                        className="pointer-events-none absolute -inset-1 rounded-[1.55rem]"
                        style={{
                          boxShadow: emphasis.redBorder
                            ? "0 0 0 2px rgba(226,75,58,0.35)"
                            : "0 0 0 2px rgba(232,184,74,0.4)",
                        }}
                        animate={{ opacity: [0.85, 0.15, 0.85], scale: [1, 1.04, 1] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                      />
                    )}
                    {slice.map((t, n) => (
                      <PatternTokenIcon
                        key={`${t}-${piece.start + run.start + n}`}
                        action={t}
                        px={hotPx}
                      />
                    ))}
                  </motion.div>
                );
              })}
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}

function PatternEmphasisControls({
  lesson,
  onChange,
}: {
  lesson: CanvasLessonConfig;
  onChange: (e: CanvasPatternEmphasis) => void;
}) {
  const emphasis: CanvasPatternEmphasis = {
    ...DEFAULT_CANVAS_PATTERN_EMPHASIS,
    ...lesson.patternEmphasis,
    highlightChunk: lesson.patternEmphasis?.highlightChunk ?? [],
  };
  const hasPattern = (lesson.patternPreview?.length ?? 0) > 0;
  const highlightUnit =
    resolveEmphasisHighlightChunk(emphasis, lesson.exampleChunk) ?? [];
  const hasHighlightUnit = highlightUnit.length > 0;
  const usingFallback =
    !(emphasis.highlightChunk?.length) && (lesson.exampleChunk?.length ?? 0) > 0;

  function patch(partial: Partial<CanvasPatternEmphasis>) {
    onChange({ ...emphasis, ...partial });
  }

  if (!hasPattern) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className="space-y-4 rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/80 via-white to-rose-50/40 p-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <motion.div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md"
          animate={{ rotate: [0, -6, 6, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Highlighter className="h-5 w-5" />
        </motion.div>
        <div>
          <h4 className="text-sm font-bold text-slate-900">Pattern emphasis</h4>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
            Help students see the repeating unit as one group — not separate boxes
            around each icon. Example: pattern{" "}
            <span className="font-semibold text-slate-800">F·L·F·L·F·L</span>,
            highlight unit <span className="font-semibold text-rose-700">F·L</span>{" "}
            sits in one capsule. Then add size, coral border, and/or blink.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <DragTokenRowEditor
          title="Unit to highlight"
          description="Different from the full pattern — e.g. add F then L while the pattern is F·L·F·L·F·L."
          tokens={emphasis.highlightChunk ?? []}
          onChange={(highlightChunk) => patch({ highlightChunk })}
          accent="violet"
        />
        {(lesson.exampleChunk?.length ?? 0) > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() =>
              patch({ highlightChunk: [...(lesson.exampleChunk ?? [])] })
            }
          >
            Copy from example chunk
          </Button>
        )}
        {usingFallback && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900">
            Using the example chunk as the highlight unit. Add tokens above to set a
            dedicated unit instead.
          </p>
        )}
        {!hasHighlightUnit && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900">
            Add the repeating unit here (e.g. F·L) so we know which part of the full
            pattern to emphasize.
          </p>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Pattern size
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { value: "normal" as const, label: "Normal" },
              { value: "large" as const, label: "Large" },
              { value: "xlarge" as const, label: "Extra large" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => patch({ scale: opt.value })}
              className={cn(
                "rounded-xl border-2 px-2 py-2.5 text-xs font-semibold transition",
                emphasis.scale === opt.value
                  ? "border-violet-500 bg-violet-50 text-violet-900 ring-2 ring-violet-200"
                  : "border-slate-200 bg-white text-slate-600 hover:border-violet-200"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Highlight which match
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { value: "none" as const, label: "Off", hint: "No highlight" },
              { value: "first" as const, label: "First", hint: "First match only" },
              { value: "all" as const, label: "All", hint: "Every match" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={!hasHighlightUnit && opt.value !== "none"}
              onClick={() => patch({ highlightScope: opt.value })}
              className={cn(
                "rounded-xl border-2 px-2 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-40",
                emphasis.highlightScope === opt.value
                  ? "border-rose-500 bg-rose-50 ring-2 ring-rose-200"
                  : "border-slate-200 bg-white hover:border-rose-200"
              )}
            >
              <span className="block text-xs font-bold text-slate-900">{opt.label}</span>
              <span className="block text-[10px] text-slate-500">{opt.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Highlight effects <span className="font-normal normal-case">(combine freely)</span>
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              {
                key: "bigger" as const,
                label: "Bigger",
                icon: <Zap className="h-3.5 w-3.5" />,
                hint: "Grow highlighted icons",
              },
              {
                key: "redBorder" as const,
                label: "Red border",
                icon: <Highlighter className="h-3.5 w-3.5" />,
                hint: "Wrap the whole unit",
              },
              {
                key: "blink" as const,
                label: "Blink",
                icon: <Eye className="h-3.5 w-3.5" />,
                hint: "Soft pulse animation",
              },
            ] as const
          ).map((opt) => {
            const on = emphasis[opt.key];
            const disabled = emphasis.highlightScope === "none";
            return (
              <motion.button
                key={opt.key}
                type="button"
                disabled={disabled}
                whileHover={disabled ? undefined : { y: -1, scale: 1.01 }}
                whileTap={disabled ? undefined : { scale: 0.97 }}
                onClick={() => patch({ [opt.key]: !on })}
                className={cn(
                  "flex items-start gap-2 rounded-xl border-2 px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-40",
                  on && !disabled
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-6 w-6 items-center justify-center rounded-lg",
                    on && !disabled ? "bg-white/15" : "bg-slate-100"
                  )}
                >
                  {opt.icon}
                </span>
                <span>
                  <span className="block text-xs font-bold">{opt.label}</span>
                  <span
                    className={cn(
                      "block text-[10px]",
                      on && !disabled ? "text-white/70" : "text-slate-500"
                    )}
                  >
                    {opt.hint}
                  </span>
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-dashed border-violet-200 bg-gradient-to-b from-white via-rose-50/30 to-violet-50/40 px-3 py-4">
        <div className="mb-3 flex items-center justify-center gap-2">
          <motion.span
            className="h-1.5 w-1.5 rounded-full bg-rose-500"
            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          />
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-600">
            Live preview
          </p>
          <motion.span
            className="h-1.5 w-1.5 rounded-full bg-violet-500"
            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: 0.2 }}
          />
        </div>
        <PatternPreviewRow lesson={lesson} />
      </div>
    </motion.div>
  );
}

function StudentCanvasPreview({
  lesson,
  guidedActions,
}: {
  lesson: CanvasLessonConfig;
  guidedActions: string[];
}) {
  const blanks = Math.max(1, lesson.blankSlotCount ?? 4);
  const stripMode = (lesson.stripMode ?? "EMPTY") as CanvasStripMode;
  const stripMeta = getCanvasStripType(stripMode);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100/80 shadow-inner">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 bg-white/80 px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <Eye className="h-3.5 w-3.5" />
          Student view
        </div>
        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
          {stripMeta.label}
        </span>
      </div>

      {/* White board */}
      <div className="relative mx-2 mt-3 min-h-[280px] overflow-hidden rounded-2xl border-2 border-slate-200/90 bg-white p-6 shadow-sm">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #0f172a 1px, transparent 0)",
            backgroundSize: "18px 18px",
          }}
        />
        <div className="relative z-[1] flex flex-col items-center gap-5 text-center">
          <AnimatePresence mode="wait">
            {lesson.prompt?.trim() ? (
              <motion.div
                key={richTextToPlain(lesson.prompt) || lesson.prompt}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl text-lg font-semibold leading-snug text-slate-800"
              >
                <RichTextPreview html={lesson.prompt} empty="Add a prompt…" />
              </motion.div>
            ) : (
              <p className="text-sm italic text-slate-400">Add a prompt…</p>
            )}
          </AnimatePresence>

          {lesson.imageUrl ? (
            (() => {
              const px = resolveCanvasLessonImagePx(lesson.imageSize);
              const previewH = Math.min(220, Math.round(px.height * 0.35));
              return (
                <div
                  className="relative w-full max-w-2xl overflow-hidden rounded-lg border border-slate-100 bg-slate-50"
                  style={{ height: previewH }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={lesson.imageUrl}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                </div>
              );
            })()
          ) : (
            <div className="flex h-16 w-full max-w-xs items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-xs text-slate-400">
              <ImageIcon className="h-4 w-4" />
              Optional image
            </div>
          )}

          {lesson.audioUrl && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-200">
              <Volume2 className="h-3.5 w-3.5" />
              Listen
              {lesson.playAudioAutomatically !== false ? " · autoplay" : ""}
            </span>
          )}

          {(lesson.exampleChunk?.length ?? 0) > 0 && (
            <div className="w-full max-w-md rounded-xl border border-teal-200 bg-teal-50/60 px-3 py-2">
              {resolveCanvasSectionLabel(lesson.chunkLabel, "CHUNK") && (
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-teal-700">
                  {resolveCanvasSectionLabel(lesson.chunkLabel, "CHUNK")}
                </p>
              )}
              <div className="flex flex-wrap justify-center gap-1.5">
                {lesson.exampleChunk!.map((t, i) => (
                  <TokenChip key={`${t}-${i}`} action={t} size="sm" />
                ))}
              </div>
            </div>
          )}

          {(lesson.patternPreview?.length ?? 0) > 0 && (
            <div className="w-full max-w-3xl overflow-hidden">
              {resolveCanvasSectionLabel(lesson.patternLabel, null) && (
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-violet-600">
                  {resolveCanvasSectionLabel(lesson.patternLabel, null)}
                </p>
              )}
              <PatternPreviewRow lesson={lesson} />
            </div>
          )}
        </div>
      </div>

      {/* Yellow strip */}
      <div className="mx-3 mb-3 mt-3 overflow-hidden rounded-xl border border-amber-300/80 bg-gradient-to-b from-amber-200 to-amber-300 px-3 py-3 shadow-sm">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-amber-900/70">
          Yellow strip · {stripMeta.stripSummary}
        </p>
        <div className="flex min-h-[3.25rem] flex-wrap items-center gap-2 rounded-lg bg-amber-100/50 px-2 py-2">
          {stripMode === "EMPTY" && (
            <span className="text-xs text-amber-800/70">Empty — students build here</span>
          )}
          {stripMode === "BLANKS" &&
            Array.from({ length: blanks }).map((_, i) => (
              <span
                key={i}
                className="mx-0.5 inline-block h-1.5 w-10 rounded-full bg-slate-500/80"
                title="Blank dash slot"
              />
            ))}
          {stripMode === "SEED_PROGRAM" &&
            (guidedActions.length > 0 ? (
              guidedActions.map((t, i) => <TokenChip key={`${t}-${i}`} action={t} size="sm" />)
            ) : (
              <span className="text-xs text-amber-800/70">
                Set starter program below…
              </span>
            ))}
          {stripMode === "COUNT_ANSWER" && (
            <CountAnswerCounterPreview
              value={lesson.countInitialValue ?? 0}
              min={lesson.countMin ?? 0}
              max={lesson.countMax ?? 20}
              readOnly
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function CanvasLessonEditor({ config, onChange }: Props) {
  const lesson: CanvasLessonConfig = {
    ...DEFAULT_CANVAS_LESSON,
    ...config.canvasLesson,
  };
  const enabled = new Set(resolveEnabledActionButtons(config));
  const repeatVisible = enabled.has("repeat");
  const isCountMode = lesson.stripMode === "COUNT_ANSWER";
  const countAction = (lesson.countAction ?? "forward") as CanvasCountAction;
  const patternCount = countActionInPattern(lesson.patternPreview, countAction);

  function patch(partial: Partial<CanvasLessonConfig>) {
    const next: CanvasLessonConfig = { ...lesson, ...partial };
    const updates: LevelGameplayConfig = { ...config, canvasLesson: next };

    if (next.stripMode === "COUNT_ANSWER") {
      updates.enabledActionButtons = [];
      const correct = next.correctCount ?? patternCount;
      updates.assessment = {
        ...config.assessment,
        correctPrograms: [[formatCountAnswerToken(correct)]],
      };
    }

    onChange(updates);
  }

  function selectStripMode(mode: CanvasStripMode) {
    if (mode === "COUNT_ANSWER") {
      const action = (lesson.countAction ?? "forward") as CanvasCountAction;
      const auto = countActionInPattern(lesson.patternPreview, action);
      const correct = lesson.correctCount ?? auto;
      onChange({
        ...config,
        enabledActionButtons: [],
        canvasLesson: {
          ...lesson,
          stripMode: "COUNT_ANSWER",
          countAction: action,
          correctCount: correct,
          countInitialValue: lesson.countInitialValue ?? 0,
          countMin: lesson.countMin ?? 0,
          countMax: lesson.countMax ?? 20,
          prompt: lesson.prompt?.trim() || defaultCountPrompt(action),
        },
        assessment: {
          ...config.assessment,
          correctPrograms: [[formatCountAnswerToken(correct)]],
        },
      });
      return;
    }

    // Leaving count mode: restore a motion palette if it was cleared.
    const palette =
      (config.enabledActionButtons?.length ?? 0) === 0
        ? (["forward", "backward", "turn left", "turn right", "repeat"] as RobotActionButton[])
        : config.enabledActionButtons;

    onChange({
      ...config,
      enabledActionButtons: palette,
      canvasLesson: { ...lesson, stripMode: mode },
    });
  }

  function setRepeatVisible(visible: boolean) {
    const motions = (["forward", "backward", "turn left", "turn right"] as RobotActionButton[]).filter(
      (a) => enabled.has(a)
    );
    const base =
      motions.length > 0
        ? motions
        : (["forward", "backward", "turn left", "turn right"] as RobotActionButton[]);
    onChange({
      ...config,
      canvasLesson: lesson,
      enabledActionButtons: visible ? [...base, "repeat"] : [...base],
    });
  }

  const stripMeta = getCanvasStripType(lesson.stripMode);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
        <div className="space-y-5 p-4 sm:p-5">
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-900">Yellow strip</p>
            <CanvasStripModePicker
              value={(lesson.stripMode ?? "EMPTY") as CanvasStripMode}
              onChange={selectStripMode}
            />
          </div>

          {lesson.stripMode === "BLANKS" && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-slate-600">Blank slots</span>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() =>
                    patch({ blankSlotCount: Math.max(1, (lesson.blankSlotCount ?? 4) - 1) })
                  }
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="w-8 text-center text-sm font-semibold tabular-nums">
                  {lesson.blankSlotCount ?? 4}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() =>
                    patch({ blankSlotCount: Math.min(20, (lesson.blankSlotCount ?? 4) + 1) })
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {isCountMode && (
            <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3">
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600">Count</span>
                <select
                  className="block h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm"
                  value={countAction}
                  onChange={(e) => {
                    const action = e.target.value as CanvasCountAction;
                    const auto = countActionInPattern(lesson.patternPreview, action);
                    patch({
                      countAction: action,
                      correctCount: auto,
                      prompt: defaultCountPrompt(action),
                    });
                  }}
                >
                  <option value="forward">Forwards</option>
                  <option value="backward">Backwards</option>
                  <option value="turn left">Turn left</option>
                  <option value="turn right">Turn right</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600">Correct answer</span>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={() =>
                      patch({
                        correctCount: Math.max(0, (lesson.correctCount ?? patternCount) - 1),
                      })
                    }
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <Input
                    type="number"
                    min={0}
                    max={99}
                    value={lesson.correctCount ?? patternCount}
                    onChange={(e) =>
                      patch({
                        correctCount: Math.max(0, Math.min(99, Number(e.target.value) || 0)),
                      })
                    }
                    className="h-8 w-14 text-center"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={() =>
                      patch({
                        correctCount: Math.min(99, (lesson.correctCount ?? patternCount) + 1),
                      })
                    }
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  <button
                    type="button"
                    className="text-xs font-medium text-slate-500 underline-offset-2 hover:underline"
                    onClick={() => patch({ correctCount: patternCount })}
                  >
                    from pattern ({patternCount})
                  </button>
                </div>
              </label>
            </div>
          )}

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-slate-900">Prompt</span>
            <RichTextEditor
              value={lesson.prompt ?? ""}
              onChange={(prompt) => patch({ prompt })}
              placeholder={
                isCountMode
                  ? "How many forwards do you see?"
                  : "Build a program that matches the pattern…"
              }
              minHeight={72}
            />
          </label>

          <DragTokenRowEditor
            title="Pattern"
            description="Shown on the white board."
            tokens={lesson.patternPreview ?? []}
            onChange={(patternPreview) => {
              if (isCountMode) {
                const action = (lesson.countAction ?? "forward") as CanvasCountAction;
                const auto = countActionInPattern(patternPreview, action);
                patch({
                  patternPreview,
                  correctCount: lesson.correctCount ?? auto,
                });
              } else {
                patch({ patternPreview });
              }
            }}
            accent="violet"
          />

          {!isCountMode && (lesson.patternPreview?.length ?? 0) > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                const patternOnly = (lesson.patternPreview ?? []).filter(
                  (t) => t.trim().toLowerCase() !== "blank"
                );
                const variants = suggestProgramVariants(patternOnly);
                if (!variants.length) return;
                onChange({
                  ...config,
                  canvasLesson: lesson,
                  assessment: { ...config.assessment, correctPrograms: variants },
                });
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Use pattern as accepted answers
            </Button>
          )}

          <details className="group rounded-xl border border-slate-200">
            <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-slate-700 [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                More options
                <span className="text-xs font-normal text-slate-400 group-open:hidden">
                  image, audio, chunk, labels, Repeat…
                </span>
              </span>
            </summary>
            <div className="space-y-4 border-t border-slate-100 px-3 py-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <HintImageUpload
                    imageUrl={lesson.imageUrl}
                    onChange={(url) => patch({ imageUrl: url })}
                    label="Board image"
                  />
                  {lesson.imageUrl ? (
                    <div className="space-y-1.5">
                      <span className="text-xs font-medium text-slate-600">Image size in game</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(
                          [
                            ["sm", "S"],
                            ["md", "M"],
                            ["lg", "L"],
                            ["xl", "XL"],
                          ] as const satisfies ReadonlyArray<readonly [CanvasLessonImageSize, string]>
                        ).map(([value, label]) => {
                          const active = (lesson.imageSize ?? "lg") === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => patch({ imageSize: value })}
                              className={cn(
                                "rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors",
                                active
                                  ? "border-[#4F46E5] bg-[#4F46E5]/10 text-[#4F46E5]"
                                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              )}
                              title={
                                value === "sm"
                                  ? "Small"
                                  : value === "md"
                                    ? "Medium"
                                    : value === "lg"
                                      ? "Large (default)"
                                      : "Extra large"
                              }
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Default is Large. Change size without re-uploading the image.
                      </p>
                    </div>
                  ) : null}
                </div>
                <HintAudioUpload
                  audioUrl={lesson.audioUrl}
                  playAutomatically={lesson.playAudioAutomatically !== false}
                  onChange={(url) => patch({ audioUrl: url })}
                  onPlayAutomaticallyChange={(v) => patch({ playAudioAutomatically: v })}
                />
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">Pattern label</span>
                <Input
                  value={lesson.patternLabel ?? ""}
                  onChange={(e) => patch({ patternLabel: e.target.value })}
                  placeholder="Optional — leave empty to hide"
                  className="h-9"
                />
              </label>

              {!isCountMode && (
                <>
                  <DragTokenRowEditor
                    title="Example chunk"
                    description="Optional chip on the board."
                    tokens={lesson.exampleChunk ?? []}
                    onChange={(exampleChunk) => patch({ exampleChunk })}
                    accent="teal"
                  />
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-slate-600">Chunk label</span>
                    <Input
                      value={lesson.chunkLabel ?? "CHUNK"}
                      onChange={(e) => patch({ chunkLabel: e.target.value })}
                      placeholder="CHUNK"
                      className="h-9"
                    />
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                      checked={repeatVisible}
                      onChange={(e) => setRepeatVisible(e.target.checked)}
                    />
                    Show Repeat in palette
                  </label>
                </>
              )}

              {isCountMode && (
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-slate-600">
                    Counter starts at
                  </span>
                  <CountAnswerCounterPreview
                    value={lesson.countInitialValue ?? 0}
                    min={lesson.countMin ?? 0}
                    max={lesson.countMax ?? 20}
                    onChange={(n) => patch({ countInitialValue: n })}
                  />
                </label>
              )}

              {(lesson.patternPreview?.length ?? 0) > 0 && (
                <PatternEmphasisControls
                  lesson={lesson}
                  onChange={(patternEmphasis) => patch({ patternEmphasis })}
                />
              )}

              {lesson.stripMode === "SEED_PROGRAM" && (
                <p className="text-xs text-slate-500">
                  Set the starter blocks in the section below this studio.
                </p>
              )}
            </div>
          </details>
        </div>

        <aside className="border-t border-slate-100 bg-slate-50/60 p-3 lg:border-l lg:border-t-0">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Preview · {stripMeta.label}
          </p>
          <StudentCanvasPreview
            lesson={lesson}
            guidedActions={config.guidedActions ?? []}
          />
        </aside>
      </div>
    </section>
  );
}
