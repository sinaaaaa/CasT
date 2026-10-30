"use client";

import { motion } from "framer-motion";
import { Lock, Play, RotateCcw, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  difficultyColor,
  levelTaskMeta,
  type LevelPlayStatus,
  type LevelTaskLabel,
} from "@/lib/student-ui";

type Props = {
  name: string;
  levelNumber: number;
  taskLabel: LevelTaskLabel;
  difficultyLabel: string;
  difficulty: number;
  status: LevelPlayStatus;
  score?: number | null;
  index?: number;
  queuedForReplay?: boolean;
  highlight?: boolean;
  locked?: boolean;
  lockHint?: string;
  size?: "default" | "compact";
  onClick?: () => void;
};

const statusBadge: Record<
  LevelPlayStatus,
  { label: string; className: string; action: string }
> = {
  completed: {
    label: "Already played",
    className: "bg-emerald-100 text-emerald-800",
    action: "Play this again",
  },
  in_progress: {
    label: "Keep going",
    className: "bg-amber-100 text-amber-800",
    action: "Pick up here",
  },
  new: {
    label: "Not started",
    className: "bg-sky-100 text-sky-800",
    action: "Play this",
  },
};

export function SparcLevelCard({
  name,
  levelNumber,
  taskLabel,
  difficultyLabel: diffLabel,
  difficulty,
  status,
  score,
  index = 0,
  queuedForReplay,
  highlight,
  locked,
  lockHint,
  size = "default",
  onClick,
}: Props) {
  const compact = size === "compact";
  const meta = levelTaskMeta(taskLabel);
  const Icon = meta.icon;
  const badge = locked
    ? { label: "Locked", className: "bg-stone-200 text-stone-700", action: lockHint ?? "Finish the current item first" }
    : queuedForReplay
      ? { label: "Try again", className: "bg-violet-100 text-violet-800", action: "Play this again" }
      : statusBadge[status];
  const showTask = !name.toLowerCase().includes(taskLabel.toLowerCase());

  return (
    <motion.button
      type="button"
      initial={false}
      whileHover={locked ? undefined : { y: compact ? -4 : -6, scale: 1.015 }}
      whileTap={locked ? undefined : { scale: 0.98 }}
      onClick={onClick}
      aria-disabled={locked}
      title={locked ? lockHint : name}
      className={cn(
        "group w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F9B8E] focus-visible:ring-offset-2",
        locked && "cursor-not-allowed"
      )}
    >
      <div
        className={cn(
          "h-full overflow-hidden border-2 bg-white transition-shadow",
          compact ? "rounded-2xl shadow-md shadow-slate-200/70" : "rounded-3xl shadow-lg shadow-slate-200/80",
          locked
            ? "border-stone-200 shadow-none"
            : highlight
              ? "border-teal-300 shadow-teal-100 group-hover:shadow-xl"
              : "border-white group-hover:shadow-xl group-hover:shadow-indigo-200/40"
        )}
      >
        <div
          className={cn(
            "relative flex items-center justify-center bg-gradient-to-br",
            meta.gradient,
            compact ? "h-20" : "h-32",
            locked && "brightness-[0.92]"
          )}
        >
          {locked ? (
            <Lock className={cn("text-white drop-shadow-md", compact ? "h-8 w-8" : "h-12 w-12")} strokeWidth={2} />
          ) : (
            <Icon className={cn("text-white drop-shadow-md", compact ? "h-8 w-8" : "h-14 w-14")} strokeWidth={1.75} />
          )}
          <span
            className={cn(
              "absolute flex items-center justify-center rounded-xl bg-white/95 font-bold text-stone-800 shadow",
              compact ? "left-2.5 top-2.5 h-7 w-7 text-xs" : "left-4 top-4 h-9 w-9 text-sm"
            )}
          >
            {levelNumber}
          </span>
          {!locked && status === "completed" && score != null && score >= 70 && (
            <span
              className={cn(
                "absolute flex items-center gap-1 rounded-full bg-white/95 font-bold text-amber-700 shadow",
                compact ? "right-2.5 top-2.5 px-1.5 py-0.5 text-[10px]" : "right-4 top-4 px-2 py-1 text-xs"
              )}
            >
              <Star className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5", "fill-amber-400 text-amber-400")} />
              {score}
            </span>
          )}
        </div>

        <div className={cn(compact ? "space-y-1.5 p-3.5" : "space-y-2.5 p-5", locked && "opacity-90")}>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn("rounded-full font-semibold", compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs", badge.className)}>
              {badge.label}
            </span>
            <span className={cn("rounded-full font-semibold", compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs", difficultyColor(difficulty))}>
              {diffLabel}
            </span>
          </div>
          <h3 className={cn("font-bold leading-snug text-stone-800", compact ? "text-sm" : "text-lg")}>{name}</h3>
          {showTask && (
            <p className={cn("font-semibold text-teal-700", compact ? "text-xs" : "text-sm")}>{taskLabel}</p>
          )}
          {!compact && (
            <p className="text-sm leading-snug text-stone-500">{locked ? lockHint : meta.hint}</p>
          )}
          <p
            className={cn(
              "inline-flex items-center gap-1.5 font-bold",
              compact ? "pt-0.5 text-xs" : "pt-1 text-sm",
              locked ? "text-stone-500" : "text-stone-700 group-hover:text-teal-700"
            )}
          >
            {locked ? (
              <Lock className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
            ) : queuedForReplay || status === "completed" ? (
              <RotateCcw className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
            ) : (
              <Play className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
            )}
            {locked ? "Locked" : highlight ? "Play next" : badge.action}
          </p>
        </div>
      </div>
    </motion.button>
  );
}
