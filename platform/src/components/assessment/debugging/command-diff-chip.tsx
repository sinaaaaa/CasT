"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import {
  COMMAND_ARIA_LABELS,
  COMMAND_ICON_PATHS,
  type CommandToken,
} from "@/lib/command-icons";
import type { DiffSlotStatus } from "@/lib/assessment/program-diff-visual";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<
  DiffSlotStatus,
  { ring: string; bg: string; glow?: string; pulse?: boolean; labelClass?: string }
> = {
  match: { ring: "ring-slate-200/80", bg: "bg-white" },
  correct: {
    ring: "ring-emerald-400/90",
    bg: "bg-emerald-50",
    glow: "shadow-[0_0_10px_rgba(16,185,129,0.35)]",
    labelClass: "text-emerald-800",
  },
  added: { ring: "ring-orange-300/90", bg: "bg-orange-50", glow: "shadow-[0_0_10px_rgba(249,115,22,0.3)]", pulse: true },
  extra: { ring: "ring-orange-300/90", bg: "bg-orange-50", glow: "shadow-[0_0_10px_rgba(249,115,22,0.3)]", pulse: true },
  removed: { ring: "ring-red-200/80", bg: "bg-red-50/60" },
  changed: { ring: "ring-amber-300/90", bg: "bg-amber-50", glow: "shadow-[0_0_8px_rgba(245,158,11,0.25)]" },
  missing: { ring: "ring-slate-200", bg: "bg-slate-100/80 opacity-50" },
  divergence: { ring: "ring-red-500/90", bg: "bg-red-50", glow: "shadow-[0_0_12px_rgba(239,68,68,0.4)]", pulse: true },
  wrong: {
    ring: "ring-red-500/90",
    bg: "bg-red-50",
    glow: "shadow-[0_0_12px_rgba(239,68,68,0.45)]",
    pulse: true,
    labelClass: "text-red-700 font-semibold",
  },
  wrongLater: {
    ring: "ring-red-300/80",
    bg: "bg-red-50/70",
    labelClass: "text-red-600",
  },
  afterFirstMistake: {
    ring: "ring-amber-200/50",
    bg: "bg-amber-50/30",
    labelClass: "text-amber-800/60",
  },
  hitObstacle: {
    ring: "ring-red-600/90",
    bg: "bg-red-100",
    glow: "shadow-[0_0_12px_rgba(220,38,38,0.45)]",
    pulse: true,
    labelClass: "text-red-800 font-semibold",
  },
};

export function CommandDiffChip({
  status,
  command,
  from,
  to,
  tooltip,
  step,
  chipLabel,
  size = 40,
  active,
  onHover,
}: {
  status: DiffSlotStatus;
  command?: CommandToken;
  from?: CommandToken;
  to?: CommandToken;
  tooltip: string;
  step: number;
  chipLabel?: string;
  size?: number;
  active?: boolean;
  onHover?: (step: number | null) => void;
}) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.match;

  if (status === "missing") {
    return null;
  }

  if (status === "changed" && from && to) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-1"
        title={tooltip}
        onMouseEnter={() => onHover?.(step)}
        onMouseLeave={() => onHover?.(null)}
      >
        <CommandIcon command={from} size={size - 6} className="opacity-40 line-through" />
        <ArrowRight className="h-3 w-3 shrink-0 text-amber-600" />
        <CommandIcon
          command={to}
          size={size}
          ring={style.ring}
          bg={style.bg}
          glow={style.glow}
          active={active}
          pulse={style.pulse}
        />
      </motion.div>
    );
  }

  const cmd = command ?? to;
  if (!cmd) return null;

  const prefix =
    status === "added" || status === "extra" ? (
      <span className="mr-0.5 text-[10px] font-bold text-orange-600">+</span>
    ) : null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: (step - 1) * 0.04 }}
      className="flex flex-col items-center gap-0.5"
      title={tooltip}
      onMouseEnter={() => onHover?.(step)}
      onMouseLeave={() => onHover?.(null)}
    >
      <div className="flex items-center">
        {prefix}
        <CommandIcon
          command={cmd}
          size={size}
          ring={style.ring}
          bg={style.bg}
          glow={style.glow}
          active={active}
          pulse={style.pulse}
        />
      </div>
      {chipLabel ? (
        <span className={cn("max-w-[72px] text-center text-[9px] leading-tight", style.labelClass)}>
          {chipLabel}
        </span>
      ) : (
        <span className="text-[9px] tabular-nums text-muted-foreground">{step}</span>
      )}
    </motion.div>
  );
}

function CommandIcon({
  command,
  size,
  ring,
  bg = "bg-white",
  glow,
  active,
  pulse,
  className,
}: {
  command: CommandToken;
  size: number;
  ring?: string;
  bg?: string;
  glow?: string;
  active?: boolean;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-lg ring-2 transition-transform",
        bg,
        ring ?? "ring-slate-200",
        glow,
        active && "scale-110 ring-sky-400",
        pulse && "animate-[pulse_2s_ease-in-out_infinite]",
        className
      )}
      style={{ width: size, height: size }}
      aria-label={COMMAND_ARIA_LABELS[command]}
    >
      <Image
        src={COMMAND_ICON_PATHS[command]}
        alt=""
        width={size - 8}
        height={size - 8}
        className="object-contain"
      />
    </span>
  );
}

export function ProgramDiffTrack({
  label,
  sublabel,
  slots,
  onStepHover,
  activeStep,
}: {
  label: string;
  sublabel?: string;
  slots: import("@/lib/assessment/program-diff-visual").ProgramDiffSlot[];
  onStepHover?: (step: number | null) => void;
  activeStep?: number | null;
}) {
  return (
    <div className="rounded-xl border border-white/60 bg-white/70 p-3 shadow-sm backdrop-blur-sm">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{label}</p>
          {sublabel && <p className="text-[10px] text-muted-foreground">{sublabel}</p>}
        </div>
        <span className="text-[10px] tabular-nums text-muted-foreground">{slots.length} steps</span>
      </div>
      <ol className="flex flex-wrap items-end gap-2" aria-label={label}>
        {slots
          .filter((slot) => slot.status !== "missing")
          .map((slot, i) => (
          <li key={`${slot.step}-${i}-${slot.status}`} className="list-none">
            <CommandDiffChip
              {...slot}
              active={activeStep === slot.step}
              onHover={onStepHover}
            />
          </li>
        ))}
        {slots.length === 0 && (
          <li className="text-sm text-muted-foreground">No commands</li>
        )}
      </ol>
    </div>
  );
}
