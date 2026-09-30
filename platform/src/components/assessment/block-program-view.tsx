"use client";

import { Briefcase, Puzzle, RotateCcw } from "lucide-react";
import { CommandIcon } from "@/components/assessment/debugging/command-diff-chip";
import type { StructureBlock } from "@/lib/assessment/programStructureAnalysis";
import type { CommandToken } from "@/lib/command-icons";
import type { BlockMark } from "@/lib/assessment/debugBlockView";
import { cn } from "@/lib/utils";

const MOTION = new Set(["forward", "backward", "turn left", "turn right"]);

const MARK_STYLE: Record<Exclude<BlockMark, null>, { ring: string; badge: string; text: string }> = {
  first_mistake: { ring: "ring-2 ring-rose-500 ring-offset-2", badge: "bg-rose-600 text-white", text: "First mistake" },
  changed: { ring: "ring-2 ring-amber-400 ring-offset-2", badge: "bg-amber-500 text-white", text: "Change" },
  extra: { ring: "ring-2 ring-rose-300 ring-offset-2 opacity-60", badge: "bg-rose-400 text-white", text: "Not needed" },
  added: { ring: "ring-2 ring-emerald-400 ring-offset-2", badge: "bg-emerald-600 text-white", text: "Added" },
};

function tint(color: string | undefined, alpha: string): string | undefined {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : undefined;
}

/** Step numbers per block (null when the program repeats, so numbers would be ambiguous). */
function stepNumbers(blocks: StructureBlock[]): (number[] | null)[] {
  if (blocks.some((b) => b.kind === "repeat-start")) return blocks.map(() => null);
  let n = 0;
  return blocks.map((b) => {
    const moves = b.kind === "motion" ? 1 : b.kind === "bag" || b.kind === "chunk" ? (b.inner?.length ?? 0) : 0;
    return Array.from({ length: moves }, () => ++n);
  });
}

function MoveTile({
  move,
  step,
  size,
  isMistake,
  active,
  onStepHover,
}: {
  move: string;
  step: number | null;
  size: number;
  isMistake: boolean;
  active: boolean;
  onStepHover?: (step: number | null) => void;
}) {
  if (!MOTION.has(move)) return null;
  return (
    <div
      className="flex flex-col items-center gap-0.5"
      onMouseEnter={() => step != null && onStepHover?.(step)}
      onMouseLeave={() => onStepHover?.(null)}
    >
      <CommandIcon
        command={move as CommandToken}
        size={size}
        ring={isMistake ? "ring-rose-500" : "ring-slate-200/80"}
        bg={isMistake ? "bg-rose-50" : "bg-white"}
        active={active}
      />
      {step != null && (
        <span className={cn("text-[9px] tabular-nums", isMistake ? "font-semibold text-rose-700" : "text-slate-400")}>
          {step}
        </span>
      )}
    </div>
  );
}

export function BlockProgramView({
  label,
  sublabel,
  blocks,
  marks,
  notes,
  firstMistakeStep,
  activeStep,
  onStepHover,
  compact = false,
  emptyText = "No blocks",
}: {
  label?: string;
  sublabel?: string;
  blocks: StructureBlock[];
  marks?: BlockMark[];
  notes?: (string | null)[];
  firstMistakeStep?: number | null;
  activeStep?: number | null;
  onStepHover?: (step: number | null) => void;
  compact?: boolean;
  emptyText?: string;
}) {
  const steps = stepNumbers(blocks);
  const moveCount = blocks.reduce((n, b) => n + (b.kind === "motion" ? 1 : b.inner?.length ?? 0), 0);
  const tile = compact ? 24 : 32;

  const body = (
    <ol className={cn("flex flex-wrap items-end", compact ? "gap-2" : "gap-3")} aria-label={label}>
      {blocks.map((b, i) => {
        const mark = marks?.[i] ?? null;
        const style = mark ? MARK_STYLE[mark] : null;
        const nums = steps[i];
        const note = notes?.[i] ?? null;
        const macro = b.kind === "bag" || b.kind === "chunk";

        const badge = style && (
          <span
            className={cn(
              "absolute -top-2.5 right-1 z-10 whitespace-nowrap rounded-full px-1.5 py-px text-[9px] font-semibold shadow-sm",
              style.badge
            )}
          >
            {style.text}
          </span>
        );

        let content: React.ReactNode;
        if (macro) {
          const Icon = b.kind === "bag" ? Briefcase : Puzzle;
          content = (
            <div
              className={cn(
                "relative rounded-xl border-2 shadow-sm",
                compact ? "px-1.5 pb-1 pt-0.5" : "px-2 pb-1.5 pt-1",
                b.missing && "border-dashed border-rose-300",
                style?.ring
              )}
              style={{
                borderColor: b.missing ? undefined : (b.color ?? "#94a3b8"),
                background: tint(b.color, "14") ?? "#f8fafc",
              }}
            >
              {badge}
              <div className="mb-1 flex items-center gap-1">
                <Icon className="h-3 w-3 shrink-0" style={{ color: b.color ?? "#64748b" }} />
                <span className={cn("font-semibold text-slate-700", compact ? "text-[10px]" : "text-[11px]")}>
                  {b.label}
                </span>
                <span className="text-[9px] uppercase tracking-wide text-slate-400">
                  {b.kind === "bag" ? "bag" : "chunk"}
                </span>
              </div>
              <div className="flex items-end gap-1">
                {(b.inner ?? []).map((move, k) => {
                  const step = nums?.[k] ?? null;
                  return (
                    <MoveTile
                      key={k}
                      move={move}
                      step={step}
                      size={tile}
                      isMistake={step != null && step === firstMistakeStep}
                      active={step != null && step === activeStep}
                      onStepHover={onStepHover}
                    />
                  );
                })}
                {(b.inner ?? []).length === 0 && <span className="text-[10px] text-rose-600">Empty / deleted</span>}
              </div>
            </div>
          );
        } else if (b.kind === "repeat-start" || b.kind === "repeat-end") {
          content = (
            <span
              className={cn(
                "relative inline-flex items-center gap-1 self-center rounded-full border border-purple-200 bg-purple-50 px-2 py-1 text-[10px] font-semibold text-purple-800",
                style?.ring
              )}
            >
              {badge}
              <RotateCcw className="h-3 w-3" />
              {b.kind === "repeat-start" ? b.label : "End"}
            </span>
          );
        } else {
          const step = nums?.[0] ?? null;
          content = (
            <div className={cn("relative rounded-lg", style?.ring)}>
              {badge}
              <MoveTile
                move={b.token}
                step={step}
                size={tile}
                isMistake={step != null && step === firstMistakeStep}
                active={step != null && step === activeStep}
                onStepHover={onStepHover}
              />
            </div>
          );
        }

        return (
          <li key={`${b.token}-${i}`} className="flex list-none flex-col items-start gap-1">
            {content}
            {note && !compact && (
              <span className="max-w-[10rem] text-[10px] leading-tight text-slate-500">{note}</span>
            )}
          </li>
        );
      })}
      {blocks.length === 0 && <li className="list-none text-sm text-muted-foreground">{emptyText}</li>}
    </ol>
  );

  if (!label) return body;
  return (
    <div className="rounded-xl border border-white/60 bg-white/70 p-3 shadow-sm backdrop-blur-sm">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{label}</p>
          {sublabel && <p className="text-[10px] text-muted-foreground">{sublabel}</p>}
        </div>
        <span className="whitespace-nowrap text-[10px] tabular-nums text-muted-foreground">
          {blocks.length} block{blocks.length === 1 ? "" : "s"} · {moveCount} moves
        </span>
      </div>
      {body}
    </div>
  );
}
