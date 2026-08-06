"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { motion, Reorder, AnimatePresence } from "framer-motion";
import {
  DEFAULT_CANVAS_LESSON,
  resolveEnabledActionButtons,
  type CanvasLessonConfig,
  type LevelGameplayConfig,
  type RobotActionButton,
} from "@/lib/level-config";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HintImageUpload } from "@/components/teacher/level-designer/hint-image-upload";
import { HintAudioUpload } from "@/components/teacher/level-designer/hint-audio-upload";
import { GUIDED_ACTIONS } from "@/lib/level-editor-constants";
import { suggestProgramVariants } from "@/lib/assessment/expand-repeats";
import { normalizeCommandToken, COMMAND_ICON_PATHS } from "@/lib/command-icons";
import {
  ArrowDown,
  ArrowUp,
  CornerDownLeft,
  CornerDownRight,
  Eye,
  GripVertical,
  ImageIcon,
  LayoutTemplate,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  config: LevelGameplayConfig;
  onChange: (config: LevelGameplayConfig) => void;
};

type TokenBlock = { id: string; action: string };

const STRIP_MODES: {
  value: CanvasLessonConfig["stripMode"];
  label: string;
  hint: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "EMPTY",
    label: "Empty strip",
    hint: "Students start from scratch",
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    value: "BLANKS",
    label: "Blank slots",
    hint: "Fixed slots to fill by drag",
    icon: <Minus className="h-4 w-4" />,
  },
  {
    value: "SEED_PROGRAM",
    label: "Seeded program",
    hint: "Pre-filled starter blocks",
    icon: <LayoutTemplate className="h-4 w-4" />,
  },
];

const TOKEN_PALETTE = [
  "forward",
  "backward",
  "turn left",
  "turn right",
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

function tokenLabel(value: string) {
  if (value.startsWith("repeat:") || value === "repeat" || value === "repeat-start") {
    const n = value.includes(":") ? value.split(":")[1] ?? "1" : "1";
    return `Repeat ×${n}`;
  }
  return GUIDED_ACTIONS.find((g) => g.value === value)?.label ?? value;
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
      {iconPath ? (
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
            {blocks.map((block, i) => (
              <Reorder.Item
                key={block.id}
                value={block}
                className="cursor-grab active:cursor-grabbing"
                whileDrag={{ scale: 1.06, zIndex: 20 }}
              >
                <span className="inline-flex items-center gap-1">
                  <TokenChip action={block.action} showGrip />
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
            ))}
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

function StudentCanvasPreview({
  lesson,
  guidedActions,
}: {
  lesson: CanvasLessonConfig;
  guidedActions: string[];
}) {
  const blanks = Math.max(1, lesson.blankSlotCount ?? 4);
  const stripMode = lesson.stripMode ?? "EMPTY";

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100/80 shadow-inner">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 bg-white/80 px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <Eye className="h-3.5 w-3.5" />
          Student view
        </div>
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
          Live preview
        </span>
      </div>

      {/* White board */}
      <div className="relative mx-3 mt-3 min-h-[220px] rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #0f172a 1px, transparent 0)",
            backgroundSize: "18px 18px",
          }}
        />
        <div className="relative z-[1] flex flex-col items-center gap-4 text-center">
          <AnimatePresence mode="wait">
            {lesson.prompt?.trim() ? (
              <motion.p
                key={lesson.prompt}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md text-base font-semibold leading-snug text-slate-800"
              >
                {lesson.prompt}
              </motion.p>
            ) : (
              <p className="text-sm italic text-slate-400">Add a prompt…</p>
            )}
          </AnimatePresence>

          {lesson.imageUrl ? (
            <div className="relative h-28 w-full max-w-xs overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lesson.imageUrl}
                alt=""
                className="h-full w-full object-contain"
              />
            </div>
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
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-teal-700">
                Chunk
              </p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {lesson.exampleChunk!.map((t, i) => (
                  <TokenChip key={`${t}-${i}`} action={t} size="sm" />
                ))}
              </div>
            </div>
          )}

          {(lesson.patternPreview?.length ?? 0) > 0 && (
            <div className="w-full max-w-md">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-600">
                Pattern
              </p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {lesson.patternPreview!.map((t, i) => (
                  <TokenChip key={`${t}-${i}`} action={t} size="sm" />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Yellow strip */}
      <div className="mx-3 mb-3 mt-3 overflow-hidden rounded-xl border border-amber-300/80 bg-gradient-to-b from-amber-200 to-amber-300 px-3 py-3 shadow-sm">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-amber-900/70">
          Yellow strip · {stripMode.replace("_", " ").toLowerCase()}
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

  function patch(partial: Partial<CanvasLessonConfig>) {
    onChange({
      ...config,
      canvasLesson: { ...lesson, ...partial },
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

  return (
    <section className="overflow-hidden rounded-2xl border border-violet-200/70 bg-white shadow-sm">
      <header className="flex flex-col gap-1 border-b border-violet-100 bg-gradient-to-r from-violet-50 via-white to-sky-50 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
          <LayoutTemplate className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900">Canvas lesson studio</h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Drag blocks onto the board content, then check the live student preview.
          </p>
        </div>
      </header>

      <div className="grid gap-6 p-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] lg:p-6">
        <div className="space-y-6">
          <label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition",
              repeatVisible
                ? "border-violet-300 bg-violet-50/80"
                : "border-slate-200 bg-slate-50"
            )}
          >
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300"
              checked={repeatVisible}
              onChange={(e) => setRepeatVisible(e.target.checked)}
            />
            <span>
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <RotateCcw className="h-4 w-4 text-violet-700" />
                Show Repeat in the game palette
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Uncheck to hide the Repeat button for this item (students only get arrow blocks).
              </span>
            </span>
          </label>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-800">How the yellow strip starts</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {STRIP_MODES.map((m) => {
                const active = lesson.stripMode === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => patch({ stripMode: m.value })}
                    className={cn(
                      "group rounded-2xl border px-3 py-3 text-left transition",
                      active
                        ? "border-violet-400 bg-violet-50 shadow-md shadow-violet-100"
                        : "border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/40"
                    )}
                  >
                    <span
                      className={cn(
                        "mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg",
                        active
                          ? "bg-violet-600 text-white"
                          : "bg-slate-100 text-slate-500 group-hover:bg-violet-100 group-hover:text-violet-700"
                      )}
                    >
                      {m.icon}
                    </span>
                    <span className="block text-sm font-semibold text-slate-900">{m.label}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{m.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {lesson.stripMode === "BLANKS" && (
            <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-amber-950">Blank slot count</span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-10 w-10"
                    onClick={() =>
                      patch({
                        blankSlotCount: Math.max(1, (lesson.blankSlotCount ?? 4) - 1),
                      })
                    }
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={lesson.blankSlotCount ?? 4}
                    onChange={(e) =>
                      patch({
                        blankSlotCount: Math.max(1, Math.min(20, Number(e.target.value) || 4)),
                      })
                    }
                    className="h-10 w-16 text-center"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-10 w-10"
                    onClick={() =>
                      patch({
                        blankSlotCount: Math.min(20, (lesson.blankSlotCount ?? 4) + 1),
                      })
                    }
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </label>
              <div className="flex flex-wrap items-center gap-2 pb-1">
                {Array.from({ length: lesson.blankSlotCount ?? 4 }).map((_, i) => (
                  <span
                    key={i}
                    className="inline-block h-1.5 w-10 rounded-full bg-slate-500/80"
                    title="Blank dash"
                  />
                ))}
              </div>
            </div>
          )}

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-slate-800">Prompt on white board</span>
            <textarea
              className="min-h-[96px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm shadow-inner transition focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
              value={lesson.prompt ?? ""}
              onChange={(e) => patch({ prompt: e.target.value })}
              placeholder="e.g. Find the chunk that repeats in this pattern…"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
              <HintImageUpload
                imageUrl={lesson.imageUrl}
                onChange={(url) => patch({ imageUrl: url })}
                label="Board image"
              />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
              <HintAudioUpload
                audioUrl={lesson.audioUrl}
                playAutomatically={lesson.playAudioAutomatically !== false}
                onChange={(url) => patch({ audioUrl: url })}
                onPlayAutomaticallyChange={(v) => patch({ playAudioAutomatically: v })}
              />
            </div>
          </div>

          <DragTokenRowEditor
            title="Pattern preview"
            description="Drag blocks from the palette, or tap to add. Reorder by dragging chips."
            tokens={lesson.patternPreview ?? []}
            onChange={(patternPreview) => patch({ patternPreview })}
            accent="violet"
          />

          {(lesson.patternPreview?.length ?? 0) > 0 && (
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
              onClick={() => {
                const variants = suggestProgramVariants(lesson.patternPreview ?? []);
                if (!variants.length) return;
                onChange({
                  ...config,
                  canvasLesson: lesson,
                  assessment: {
                    ...config.assessment,
                    correctPrograms: variants,
                  },
                });
              }}
            >
              <Sparkles className="h-4 w-4" />
              Use pattern as accepted answers (smart Repeat ↔ expanded)
            </Button>
          )}

          <DragTokenRowEditor
            title="Example chunk"
            description="Optional unit students should notice (shown as a chip on the board)."
            tokens={lesson.exampleChunk ?? []}
            onChange={(exampleChunk) => patch({ exampleChunk })}
            accent="teal"
          />

          {lesson.stripMode === "SEED_PROGRAM" && (
            <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs leading-relaxed text-sky-900">
              Seeded strip uses the <strong>starter program</strong> section below. Accepted
              answers are separate — list every valid student solution under Accepted programs.
            </p>
          )}
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <StudentCanvasPreview
            lesson={lesson}
            guidedActions={config.guidedActions ?? []}
          />
          <p className="mt-3 text-center text-[11px] text-slate-400">
            Preview mirrors Unity white board + yellow strip
          </p>
        </aside>
      </div>
    </section>
  );
}
