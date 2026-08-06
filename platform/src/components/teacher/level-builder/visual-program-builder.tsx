"use client";

import { useCallback, useMemo, useState } from "react";
import { motion, Reorder } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  CornerDownLeft,
  CornerDownRight,
  HelpCircle,
  Minus,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import type { LevelGameplayConfig } from "@/lib/level-config";
import { GUIDED_ACTIONS } from "@/lib/level-editor-constants";
import {
  enrichCorrectProgramsWithVariants,
  formatRepeatStart,
  parseRepeatStart,
  suggestProgramVariants,
} from "@/lib/assessment/expand-repeats";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  config: LevelGameplayConfig;
  onChange: (config: LevelGameplayConfig) => void;
  showBlanks?: boolean;
  /** guidedActions (default) or assessment.correctPrograms[0] for canvas patterns */
  storage?: "guided" | "correctProgram";
};

type ProgramBlock = { id: string; action: string };

const ACTION_STYLES: Record<string, { bg: string; border: string; icon: React.ReactNode }> = {
  forward: {
    bg: "bg-sky-50",
    border: "border-sky-300",
    icon: <ArrowUp className="h-4 w-4 text-sky-600" />,
  },
  backward: {
    bg: "bg-indigo-50",
    border: "border-indigo-300",
    icon: <ArrowDown className="h-4 w-4 text-indigo-600" />,
  },
  "turn left": {
    bg: "bg-amber-50",
    border: "border-amber-300",
    icon: <CornerDownLeft className="h-4 w-4 text-amber-600" />,
  },
  "turn right": {
    bg: "bg-orange-50",
    border: "border-orange-300",
    icon: <CornerDownRight className="h-4 w-4 text-orange-600" />,
  },
  blank: {
    bg: "bg-violet-50",
    border: "border-violet-400 border-dashed",
    icon: <HelpCircle className="h-4 w-4 text-violet-600" />,
  },
  "repeat:1": {
    bg: "bg-purple-100",
    border: "border-purple-400",
    icon: <RotateCcw className="h-4 w-4 text-purple-700" />,
  },
  "repeat:2": {
    bg: "bg-purple-100",
    border: "border-purple-400",
    icon: <RotateCcw className="h-4 w-4 text-purple-700" />,
  },
  "repeat-end": {
    bg: "bg-orange-100",
    border: "border-orange-400",
    icon: <RotateCcw className="h-4 w-4 text-orange-700" />,
  },
};

const CATEGORIES = [
  { id: "move", label: "Move", actions: ["forward", "backward"] as const },
  { id: "turn", label: "Turn", actions: ["turn left", "turn right"] as const },
  { id: "loop", label: "Repeat", actions: ["repeat:1", "repeat-end"] as const },
  { id: "student", label: "Student choice", actions: ["blank"] as const },
];

function actionLabel(value: string) {
  const count = parseRepeatStart(value);
  if (count != null) return `Repeat start (×${count})`;
  return GUIDED_ACTIONS.find((g) => g.value === value)?.label ?? value;
}

function toBlocks(actions: string[]): ProgramBlock[] {
  return actions.map((action, i) => ({ id: `block-${i}-${action}`, action }));
}

export function VisualProgramBuilder({
  config,
  onChange,
  showBlanks = true,
  storage = "guided",
}: Props) {
  const programs = config.assessment?.correctPrograms ?? [];
  const [activeProgramIndex, setActiveProgramIndex] = useState(0);
  const safeIndex =
    storage === "correctProgram"
      ? Math.min(Math.max(0, activeProgramIndex), Math.max(0, programs.length - 1))
      : 0;

  const actions =
    storage === "correctProgram"
      ? (programs[safeIndex] ?? [])
      : (config.guidedActions ?? []);
  const blanks = config.blanks ?? [];
  const [previewRun, setPreviewRun] = useState(false);
  const blocks = useMemo(() => toBlocks(actions), [actions]);

  function setActions(next: string[]) {
    if (storage === "correctProgram") {
      const list = [...(config.assessment?.correctPrograms ?? [])];
      if (list.length === 0) list.push([]);
      const idx = Math.min(safeIndex, list.length - 1);
      list[idx] = next;
      onChange({
        ...config,
        assessment: {
          ...config.assessment,
          correctPrograms: list,
        },
      });
      return;
    }
    onChange({ ...config, guidedActions: next });
  }

  function addAcceptedProgram() {
    const list = [...(config.assessment?.correctPrograms ?? [[]])];
    if (list.length === 0) list.push([]);
    list.push([]);
    onChange({
      ...config,
      assessment: { ...config.assessment, correctPrograms: list },
    });
    setActiveProgramIndex(list.length - 1);
  }

  function removeAcceptedProgram(index: number) {
    const list = [...(config.assessment?.correctPrograms ?? [])];
    if (list.length <= 1) {
      onChange({
        ...config,
        assessment: { ...config.assessment, correctPrograms: [[]] },
      });
      setActiveProgramIndex(0);
      return;
    }
    list.splice(index, 1);
    onChange({
      ...config,
      assessment: { ...config.assessment, correctPrograms: list },
    });
    setActiveProgramIndex(Math.min(index, list.length - 1));
  }

  function setRepeatCountAt(index: number, nextCount: number) {
    const count = Math.max(1, Math.min(9, nextCount));
    const next = [...actions];
    if (parseRepeatStart(next[index]) == null) return;
    next[index] = formatRepeatStart(count);
    setActions(next);
  }

  function addSmartVariants() {
    const source =
      storage === "correctProgram"
        ? (programs[safeIndex]?.length
            ? programs[safeIndex]
            : (config.canvasLesson?.patternPreview ?? []))
        : actions;
    if (!source.length && !(config.canvasLesson?.patternPreview?.length)) return;

    const seed = source.length
      ? source
      : (config.canvasLesson?.patternPreview ?? []);
    const variants = suggestProgramVariants(seed);
    if (!variants.length) return;

    if (storage === "correctProgram") {
      const merged = enrichCorrectProgramsWithVariants([
        ...(config.assessment?.correctPrograms ?? []),
        ...variants,
      ]);
      onChange({
        ...config,
        assessment: { ...config.assessment, correctPrograms: merged },
      });
      setActiveProgramIndex(0);
      return;
    }
    setActions(variants[0] ?? actions);
  }

  function setBlocks(next: ProgramBlock[]) {
    setActions(next.map((b) => b.action));
  }

  function addAction(value: string) {
    setActions([...actions, value]);
  }

  function setBlanks(next: NonNullable<LevelGameplayConfig["blanks"]>) {
    onChange({ ...config, blanks: next });
  }

  const blankList =
    blanks.length > 0
      ? blanks
      : [{ correctAnswer: "turn left", enabledArrows: ["turn left", "turn right"] }];

  const runPreview = useCallback(() => {
    setPreviewRun(true);
    setTimeout(() => setPreviewRun(false), 2400);
  }, []);

  const programCount = Math.max(1, programs.length);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {storage === "correctProgram" && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-violet-200 bg-violet-50/50 p-3">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-violet-700">
            Accepted answers
          </span>
          {Array.from({ length: programCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveProgramIndex(i)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                safeIndex === i
                  ? "bg-violet-600 text-white shadow-sm"
                  : "bg-white text-violet-800 hover:bg-violet-100"
              )}
            >
              Program {i + 1}
              {(programs[i]?.length ?? 0) > 0 ? ` (${programs[i].length})` : ""}
            </button>
          ))}
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={addAcceptedProgram}>
            <Sparkles className="h-3 w-3" />
            Add another accepted program
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1 border-emerald-300 bg-emerald-50 text-xs text-emerald-900 hover:bg-emerald-100"
            onClick={addSmartVariants}
            title="Detect repeating chunks and add both expanded and Repeat forms"
          >
            <Sparkles className="h-3 w-3" />
            Smart: add Repeat ↔ expanded variants
          </Button>
          {programCount > 1 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-red-600"
              onClick={() => removeAcceptedProgram(safeIndex)}
            >
              Remove program {safeIndex + 1}
            </Button>
          )}
          <p className="w-full text-xs text-violet-700/80">
            Students pass if their strip matches any accepted program (exact Repeat nesting or same
            expanded motions). Use <strong>Smart variants</strong> to auto-add both forms from the
            pattern (e.g. F·R·F·R and Repeat×2 [F·R]).
          </p>
        </div>
      )}

      <motion.div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-sky-50/40 p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">
              {storage === "correctProgram"
                ? `Accepted program ${safeIndex + 1}`
                : "Command sequence"}
            </h4>
            <p className="text-xs text-slate-500">
              {storage === "correctProgram"
                ? "One valid way students can answer — add more for Repeat vs expanded variants"
                : "What students will see in the action queue"}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2 border-sky-200 bg-white hover:bg-sky-50"
            onClick={runPreview}
            disabled={actions.length === 0}
          >
            <Play className={cn("h-3.5 w-3.5", previewRun && "text-sky-600")} />
            Preview run
          </Button>
        </div>

        <div
          className={cn(
            "relative min-h-[5.5rem] rounded-xl border-2 border-dashed p-4 transition-colors",
            actions.length === 0 ? "border-slate-200 bg-white/60" : "border-sky-200/80 bg-white",
            previewRun && "border-sky-400 ring-2 ring-sky-200"
          )}
        >
          {blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-4 text-center">
              <Sparkles className="h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">No commands yet</p>
              <p className="max-w-xs text-xs text-slate-400">
                Tap the colorful blocks below to build the program students will follow.
              </p>
            </div>
          ) : (
            <Reorder.Group axis="x" values={blocks} onReorder={setBlocks} className="flex flex-wrap gap-2">
              {blocks.map((block, i) => {
                const repeatCount = parseRepeatStart(block.action);
                const style =
                  ACTION_STYLES[block.action] ??
                  (repeatCount != null
                    ? ACTION_STYLES["repeat:1"]
                    : ACTION_STYLES.forward);
                return (
                  <Reorder.Item
                    key={block.id}
                    value={block}
                    className={cn(
                      "flex cursor-grab items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-medium shadow-sm active:cursor-grabbing",
                      style.bg,
                      style.border,
                      previewRun && "animate-pulse"
                    )}
                    whileDrag={{ scale: 1.05, zIndex: 10 }}
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/80 text-xs font-bold text-slate-500">
                      {i + 1}
                    </span>
                    {style.icon}
                    <span>{actionLabel(block.action)}</span>
                    {repeatCount != null && (
                      <span className="ml-1 inline-flex items-center gap-0.5 rounded-lg bg-white/90 p-0.5 ring-1 ring-purple-200">
                        <button
                          type="button"
                          className="rounded p-0.5 text-purple-700 hover:bg-purple-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRepeatCountAt(i, repeatCount - 1);
                          }}
                          aria-label="Decrease repeat count"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-[1.25rem] text-center text-xs font-bold tabular-nums text-purple-900">
                          {repeatCount}
                        </span>
                        <button
                          type="button"
                          className="rounded p-0.5 text-purple-700 hover:bg-purple-100"
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
                      className="ml-1 rounded-md p-0.5 text-slate-400 hover:bg-white/80 hover:text-red-500"
                      onClick={() => setActions(actions.filter((_, j) => j !== i))}
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </Reorder.Item>
                );
              })}
            </Reorder.Group>
          )}
          {previewRun && actions.length > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-3 text-center text-xs font-medium text-sky-600"
            >
              Simulating {actions.length} step{actions.length !== 1 ? "s" : ""}…
            </motion.p>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-400">Drag blocks to reorder · Numbers show execution order</p>
      </motion.div>

      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-slate-800">Add a command</h4>
        <div className="grid gap-4 sm:grid-cols-3">
          {CATEGORIES.filter((c) => showBlanks || c.id !== "student").map((cat) => (
            <div key={cat.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{cat.label}</p>
              <motion.div className="flex flex-col gap-2">
                {cat.actions.map((value) => {
                  const style = ACTION_STYLES[value];
                  return (
                    <motion.button
                      key={value}
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => addAction(value)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left text-sm font-medium transition-shadow hover:shadow-md",
                        style.bg,
                        style.border
                      )}
                    >
                      {style.icon}
                      {actionLabel(value)}
                    </motion.button>
                  );
                })}
              </motion.div>
            </div>
          ))}
        </div>
        {actions.length > 0 && (
          <Button type="button" variant="ghost" size="sm" className="gap-2 text-slate-500" onClick={() => setActions([])}>
            <RotateCcw className="h-3.5 w-3.5" />
            Clear all commands
          </Button>
        )}
      </div>

      {showBlanks && actions.includes("blank") && (
        <div className="space-y-4 rounded-2xl border border-violet-200 bg-violet-50/30 p-5">
          <div>
            <h4 className="text-sm font-semibold text-violet-900">Student choice blanks</h4>
            <p className="text-xs text-violet-700/80">
              For each blank, pick the correct answer and which buttons students can tap.
            </p>
          </div>
          {blankList.map((b, bi) => (
            <motion.div
              key={bi}
              layout
              className="space-y-3 rounded-xl border border-violet-100 bg-white p-4 shadow-sm"
            >
              <p className="text-xs font-medium text-slate-500">Blank #{bi + 1}</p>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Correct answer</span>
                <select
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  value={b.correctAnswer}
                  onChange={(e) => {
                    const next = [...blankList];
                    next[bi] = { ...next[bi], correctAnswer: e.target.value };
                    setBlanks(next);
                  }}
                >
                  {GUIDED_ACTIONS.filter((g) => g.value !== "blank").map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Buttons shown to students</p>
                <div className="flex flex-wrap gap-2">
                  {["turn left", "turn right", "forward", "backward"].map((arrow) => (
                    <label
                      key={arrow}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                        b.enabledArrows?.includes(arrow)
                          ? "border-violet-400 bg-violet-100 text-violet-900"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      )}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={b.enabledArrows?.includes(arrow) ?? false}
                        onChange={(e) => {
                          const next = [...blankList];
                          const cur = new Set(next[bi]?.enabledArrows ?? []);
                          if (e.target.checked) cur.add(arrow);
                          else cur.delete(arrow);
                          next[bi] = { ...next[bi], enabledArrows: [...cur] };
                          setBlanks(next);
                        }}
                      />
                      {actionLabel(arrow)}
                    </label>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
