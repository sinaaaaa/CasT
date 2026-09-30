"use client";

import { useMemo } from "react";
import type { LevelType } from "@prisma/client";
import {
  ArrowLeftRight,
  Blocks,
  Briefcase,
  CheckCircle2,
  Minus,
  MoveHorizontal,
  Play,
  Plus,
  Puzzle,
  Repeat,
  Replace,
  ShieldCheck,
  Trash2,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { LevelGameplayConfig } from "@/lib/level-config";
import {
  DEBUG_EDIT_KINDS,
  DEBUG_EDIT_KIND_HINTS,
  DEBUG_EDIT_KIND_LABELS,
  DEBUG_ITEM_TYPES,
  DEBUG_ITEM_TYPE_LABELS,
  DEFAULT_DEBUGGING_CONFIG,
  describeDebuggingConfig,
  preservedStarterItemCount,
  resolveDebuggingConfig,
  type DebugEditKind,
  type DebugItemType,
  type DebuggingConfig,
} from "@/lib/debugging-config";
import { resolveStudentPalette } from "@/lib/assessment/programStructureAnalysis";
import { checkDebuggingFeasibility, countProgramItems } from "@/lib/assessment/debuggingEditAnalysis";
import { cn } from "@/lib/utils";
import { RuleSection, RuleToggleCard } from "./rules-ui";

const EDIT_ICONS: Record<DebugEditKind, LucideIcon> = {
  add: Plus,
  remove: Trash2,
  replace: Replace,
  reorder: ArrowLeftRight,
  editRepeat: Repeat,
};

const ITEM_ICONS: Record<DebugItemType, LucideIcon> = {
  arrows: MoveHorizontal,
  repeat: Repeat,
  commandBag: Briefcase,
  actionChunk: Puzzle,
};

function Stepper({
  value,
  min,
  max,
  onChange,
  suffix,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border-2 border-slate-200 bg-white p-1">
      <button
        type="button"
        aria-label="Decrease"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-[4.5rem] text-center text-sm font-bold tabular-nums text-slate-900">
        {value}
        {suffix ? <span className="ml-1 font-medium text-slate-500">{suffix}</span> : null}
      </span>
      <button
        type="button"
        aria-label="Increase"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

function BudgetRow({
  icon: Icon,
  title,
  description,
  value,
  max,
  unit,
  defaultValue,
  onChange,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  value: number | undefined;
  max: number;
  unit: string;
  defaultValue: number;
  onChange: (v: number | undefined) => void;
}) {
  const limited = value != null;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="font-bold text-slate-900">{title}</p>
          <p className="text-sm text-slate-600">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-xl border-2 border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className={cn("rounded-lg px-3 py-1.5", !limited ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
          >
            Unlimited
          </button>
          <button
            type="button"
            onClick={() => onChange(value ?? defaultValue)}
            className={cn("rounded-lg px-3 py-1.5", limited ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
          >
            Limit
          </button>
        </div>
        {limited && <Stepper value={value} min={1} max={max} onChange={onChange} suffix={unit} />}
      </div>
    </div>
  );
}

type Props = {
  levelType: LevelType;
  config: LevelGameplayConfig;
  onChange: (c: LevelGameplayConfig) => void;
};

export function DebuggingRulesEditor({ levelType, config, onChange }: Props) {
  const dc = resolveDebuggingConfig(levelType, config) ?? DEFAULT_DEBUGGING_CONFIG;
  const palette = resolveStudentPalette(config, levelType);
  const starterTokens = (config.guidedActions ?? []).filter((t) => t !== "blank");
  const starterItems = countProgramItems(starterTokens);

  const typeAvailable: Record<DebugItemType, boolean> = {
    arrows: palette.arrows || starterTokens.some((t) => !/^(bag:|chunk:|repeat)/.test(t)),
    repeat: palette.repeat || starterTokens.some((t) => t.startsWith("repeat")),
    commandBag: palette.bags || starterTokens.some((t) => t.startsWith("bag:")),
    actionChunk: palette.chunks || starterTokens.some((t) => t.startsWith("chunk:")),
  };

  function patch(partial: Partial<DebuggingConfig>) {
    onChange({ ...config, debuggingConfig: { ...dc, ...partial } });
  }

  function toggle<T extends string>(list: readonly T[], value: T, order: readonly T[]): T[] {
    const set = new Set(list);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    return order.filter((v) => set.has(v));
  }

  const feasibility = useMemo(
    () => checkDebuggingFeasibility(config, levelType),
    // Only the starter, rules, board and tools affect the check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      JSON.stringify(config.guidedActions),
      JSON.stringify(config.debuggingConfig),
      JSON.stringify(config.gridObjects),
      JSON.stringify(config.goalCell),
      JSON.stringify(config.robotStartPosition),
      JSON.stringify(config.robotStartFacing),
      JSON.stringify(config.commandBags),
      JSON.stringify(config.geometryPath),
      levelType,
    ]
  );

  const presets: { id: string; label: string; hint: string; apply: () => void }[] = [
    {
      id: "free",
      label: "Free editing",
      hint: "Any edit, no limits",
      apply: () => onChange({ ...config, debuggingConfig: { ...DEFAULT_DEBUGGING_CONFIG } }),
    },
    {
      id: "targeted",
      label: "Targeted fix",
      hint: "Replace / Repeat only, tight budget",
      apply: () =>
        onChange({
          ...config,
          debuggingConfig: {
            ...DEFAULT_DEBUGGING_CONFIG,
            allowedEdits: ["replace", "reorder", "editRepeat"],
            editBudget: Math.max(1, (feasibility?.costUnderRules ?? feasibility?.minimalEdits ?? 1) + 1),
            preserveProgramStructure: true,
          },
        }),
    },
    {
      id: "limited",
      label: "Limited edits",
      hint: "All edits, 4 edits, 3 runs",
      apply: () =>
        onChange({
          ...config,
          debuggingConfig: {
            ...DEFAULT_DEBUGGING_CONFIG,
            editBudget: 4,
            runBudget: 3,
            preserveProgramStructure: true,
          },
        }),
    },
  ];

  const keep = preservedStarterItemCount(starterItems);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-white to-white p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#4F46E5] text-white">
            <Wrench className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-slate-900">Debugging rules</p>
            <p className="mt-0.5 text-sm text-slate-600">
              Control how students may repair the starter program. One edit budget is shared by arrows, Repeat
              blocks, Command Bags and Action Chunks. A drag that doesn&apos;t change the program is free.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={p.apply}
                  className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:border-indigo-300"
                >
                  <span className="block text-sm font-bold text-slate-900">{p.label}</span>
                  <span className="block text-[11px] text-slate-500">{p.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <RuleSection icon={Wrench} title="Allowed edits" description="Turned-off edits are disabled in the game.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {DEBUG_EDIT_KINDS.map((kind) => {
            const on = dc.allowedEdits.includes(kind);
            const Icon = EDIT_ICONS[kind];
            const disabled = kind === "editRepeat" && !typeAvailable.repeat;
            return (
              <button
                key={kind}
                type="button"
                disabled={disabled}
                aria-pressed={on}
                onClick={() => patch({ allowedEdits: toggle(dc.allowedEdits, kind, DEBUG_EDIT_KINDS) })}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border-2 p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40",
                  on ? "border-[#4F46E5] bg-indigo-50/70" : "border-slate-200 bg-white hover:border-slate-300"
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    on ? "bg-[#4F46E5] text-white" : "bg-slate-100 text-slate-400"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span>
                  <span className={cn("block text-sm font-bold", on ? "text-slate-900" : "text-slate-500 line-through")}>
                    {DEBUG_EDIT_KIND_LABELS[kind]}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {disabled ? "No Repeat blocks in this item." : DEBUG_EDIT_KIND_HINTS[kind]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </RuleSection>

      <RuleSection
        icon={Blocks}
        title="Editable blocks"
        description="Locked block types stay exactly where the starter puts them."
      >
        <div className="flex flex-wrap gap-2">
          {DEBUG_ITEM_TYPES.map((t) => {
            const on = dc.editableItemTypes.includes(t);
            const Icon = ITEM_ICONS[t];
            const available = typeAvailable[t];
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => patch({ editableItemTypes: toggle(dc.editableItemTypes, t, DEBUG_ITEM_TYPES) })}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition-all",
                  on
                    ? "border-[#4F46E5] bg-indigo-50 text-[#4F46E5]"
                    : "border-slate-200 bg-slate-50 text-slate-400 line-through decoration-slate-300",
                  !available && "opacity-50"
                )}
                title={available ? undefined : "Not used in this item"}
              >
                <Icon className="h-4 w-4" />
                {DEBUG_ITEM_TYPE_LABELS[t]}
                {!available && <span className="text-[10px] font-medium no-underline">(not in item)</span>}
              </button>
            );
          })}
        </div>
      </RuleSection>

      <RuleSection
        icon={ShieldCheck}
        title="Budgets"
        description="Edits restart on every try (Reset or Try Again bring back the starter). Runs count for the whole item."
      >
        <div className="space-y-3">
          <BudgetRow
            icon={Wrench}
            title="Edit budget"
            description="Each committed add, remove, replace, reorder or Repeat change costs 1. Reset and Try Again give the edits back."
            value={dc.editBudget}
            max={50}
            unit="edits"
            defaultValue={Math.max(2, (feasibility?.costUnderRules ?? 2) + 1)}
            onChange={(v) => patch({ editBudget: v })}
          />
          <BudgetRow
            icon={Play}
            title="Run budget"
            description={`Each RUN press costs 1. Failed runs still end the item after ${config.maxAttempts ?? 3} attempts.`}
            value={dc.runBudget}
            max={20}
            unit="runs"
            defaultValue={Math.min(3, config.maxAttempts ?? 3)}
            onChange={(v) => patch({ runBudget: v })}
          />
        </div>
      </RuleSection>

      <RuleSection icon={Blocks} title="Program structure">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border-2 border-slate-200 bg-white p-4">
            <p className="font-bold text-slate-900">Minimum blocks</p>
            <p className="mt-1 text-sm text-slate-600">
              Students can&apos;t delete below this many blocks. A Repeat block counts as one. The starter has{" "}
              {starterItems}.
            </p>
            <div className="mt-3">
              <Stepper
                value={dc.minProgramItems}
                min={0}
                max={Math.max(starterItems, dc.minProgramItems, 1)}
                onChange={(v) => patch({ minProgramItems: v })}
                suffix={dc.minProgramItems === 0 ? "(off)" : "blocks"}
              />
            </div>
          </div>
          <RuleToggleCard
            icon={ShieldCheck}
            title="Preserve program structure"
            description={`No delete-all-and-rebuild: students must keep at least ${keep} of the ${starterItems} starter blocks.`}
            checked={dc.preserveProgramStructure}
            onChange={(v) => patch({ preserveProgramStructure: v })}
            accent="violet"
          />
        </div>
      </RuleSection>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Summary</h3>
        <ul className="space-y-1 text-sm text-slate-700">
          {describeDebuggingConfig(dc).map((line) => (
            <li key={line} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
              {line}
            </li>
          ))}
        </ul>
        {feasibility && feasibility.feasible != null && (
          <div
            className={cn(
              "flex items-start gap-2 rounded-xl border px-3 py-2 text-sm",
              feasibility.feasible
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-rose-200 bg-rose-50 text-rose-900"
            )}
          >
            {feasibility.feasible ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>
              {feasibility.feasible
                ? `The starter can be fixed within these rules — the smallest fix takes ${feasibility.costUnderRules} edit${feasibility.costUnderRules === 1 ? "" : "s"}.`
                : feasibility.issue}
              {feasibility.fixDescription && (
                <span className="mt-0.5 block text-xs opacity-80">Smallest fix: {feasibility.fixDescription}</span>
              )}
            </span>
          </div>
        )}
        {feasibility?.issue && feasibility.feasible == null && (
          <p className="text-xs text-slate-500">{feasibility.issue}</p>
        )}
      </section>
    </div>
  );
}
