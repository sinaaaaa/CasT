"use client";

import type { LucideIcon } from "lucide-react";
import type { RobotActionButton } from "@/lib/level-config";
import { cn } from "@/lib/utils";

export function RuleToggleCard({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
  accent = "indigo",
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  accent?: "indigo" | "teal" | "amber" | "violet" | "rose";
  children?: React.ReactNode;
}) {
  const accents = {
    indigo: {
      on: "border-[#4F46E5] bg-indigo-50/80 ring-2 ring-[#4F46E5]/15",
      icon: "bg-[#4F46E5] text-white",
      track: "bg-[#4F46E5]",
    },
    teal: {
      on: "border-teal-500 bg-teal-50/80 ring-2 ring-teal-500/15",
      icon: "bg-teal-600 text-white",
      track: "bg-teal-600",
    },
    amber: {
      on: "border-amber-500 bg-amber-50/80 ring-2 ring-amber-500/15",
      icon: "bg-amber-500 text-white",
      track: "bg-amber-500",
    },
    violet: {
      on: "border-violet-500 bg-violet-50/80 ring-2 ring-violet-500/15",
      icon: "bg-violet-600 text-white",
      track: "bg-violet-600",
    },
    rose: {
      on: "border-rose-500 bg-rose-50/80 ring-2 ring-rose-500/15",
      icon: "bg-rose-500 text-white",
      track: "bg-rose-500",
    },
  };

  const a = accents[accent];

  return (
    <div
      className={cn(
        "rounded-2xl border-2 bg-white p-4 transition-all",
        checked ? a.on : "border-slate-200 hover:border-slate-300"
      )}
    >
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="flex w-full items-start gap-4 text-left"
      >
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors",
            checked ? a.icon : "bg-slate-100 text-slate-500"
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1 pt-0.5">
          <span className="flex items-center justify-between gap-3">
            <span className="font-bold text-slate-900">{title}</span>
            <span
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors",
                checked ? a.track : "bg-slate-200"
              )}
              aria-hidden
            >
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                  checked ? "translate-x-5" : "translate-x-0.5"
                )}
              />
            </span>
          </span>
          <span className="mt-1 block text-sm leading-relaxed text-slate-600">{description}</span>
        </span>
      </button>
      {checked && children && <div className="mt-4 border-t border-slate-200/80 pt-4">{children}</div>}
    </div>
  );
}

export function RuleSection({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-slate-600">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function AttemptPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const options = [
    { value: 1, label: "1", hint: "Single try" },
    { value: 2, label: "2", hint: "Quick retry" },
    { value: 3, label: "3", hint: "Standard" },
    { value: 5, label: "5", hint: "Practice" },
    { value: 10, label: "10", hint: "Exploration" },
  ];

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-slate-800">Maximum attempts</p>
      <p className="text-xs text-slate-500">How many times a student can press RUN before the item ends.</p>
      <div className="grid grid-cols-5 gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-xl border-2 px-2 py-3 text-center transition-all",
              value === opt.value
                ? "border-[#4F46E5] bg-indigo-50 shadow-md shadow-indigo-100"
                : "border-slate-200 bg-white hover:border-indigo-200"
            )}
          >
            <p className="text-lg font-extrabold text-slate-900">{opt.label}</p>
            <p className="mt-0.5 text-[10px] font-medium text-slate-500">{opt.hint}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export function FacingPicker({
  value,
  onChange,
  options,
}: {
  value: { x: number; y: number };
  onChange: (v: { x: number; y: number }) => void;
  options: readonly { value: { x: number; y: number }; label: string }[];
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-slate-800">Robo facing at start</p>
      <p className="text-xs text-slate-500">
        Which direction Robo points when the item begins. You can also drag Robo on the board step.
      </p>
      <div className={cn("grid gap-2", options.length <= 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
        {options.map((opt) => {
          const selected = value.x === opt.value.x && value.y === opt.value.y;
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                "rounded-xl border-2 px-3 py-3 text-sm font-bold transition-all",
                selected
                  ? "border-[#4F46E5] bg-indigo-50 text-[#4F46E5]"
                  : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ActionButtonChips({
  enabled,
  onToggle,
  onEnableAll,
  onForwardBackwardOnly,
  showNumberLinePreset,
}: {
  enabled: Set<RobotActionButton>;
  onToggle: (action: RobotActionButton, checked: boolean) => void;
  onEnableAll: () => void;
  onForwardBackwardOnly?: () => void;
  showNumberLinePreset?: boolean;
}) {
  const actions: { id: RobotActionButton; label: string; emoji: string }[] = [
    { id: "forward", label: "Forward", emoji: "↑" },
    { id: "backward", label: "Backward", emoji: "↓" },
    { id: "turn left", label: "Turn left", emoji: "↺" },
    { id: "turn right", label: "Turn right", emoji: "↻" },
  ];

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-800">Available action buttons</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Hidden buttons won&apos;t appear in the game or in route analysis.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const on = enabled.has(action.id);
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => onToggle(action.id, !on)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition-all",
                on
                  ? "border-[#4F46E5] bg-indigo-50 text-[#4F46E5]"
                  : "border-slate-200 bg-slate-50 text-slate-400 line-through decoration-slate-300"
              )}
            >
              <span className="text-base">{action.emoji}</span>
              {action.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onEnableAll}
          className="text-xs font-semibold text-[#4F46E5] hover:underline"
        >
          Enable all four
        </button>
        {showNumberLinePreset && onForwardBackwardOnly && (
          <button
            type="button"
            onClick={onForwardBackwardOnly}
            className="text-xs font-semibold text-teal-700 hover:underline"
          >
            Number line: forward / backward only
          </button>
        )}
      </div>
    </div>
  );
}

export function RulesSummaryBar({
  items,
}: {
  items: { label: string; tone?: "default" | "success" | "muted" }[];
}) {
  return (
    <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
      {items.map((item) => (
        <span
          key={item.label}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            item.tone === "success" && "bg-emerald-50 text-emerald-800",
            item.tone === "muted" && "bg-slate-100 text-slate-500",
            (!item.tone || item.tone === "default") && "bg-indigo-50 text-indigo-800"
          )}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function RulesCategoryNav<T extends string>({
  categories,
  active,
  onChange,
}: {
  categories: { id: T; label: string; icon: LucideIcon }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <nav
      aria-label="Rules categories"
      className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {categories.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "inline-flex shrink-0 items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition-all",
            active === id
              ? "border-[#4F46E5] bg-[#4F46E5] text-white shadow-md shadow-indigo-200"
              : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200"
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </nav>
  );
}
