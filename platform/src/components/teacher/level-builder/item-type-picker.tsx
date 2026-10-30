"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Blocks,
  Check,
  Flag,
  Hash,
  Minus,
  Pentagon,
  PencilLine,
  Puzzle,
  Sparkles,
  SquareDashed,
  Wrench,
} from "lucide-react";
import { LevelType } from "@prisma/client";
import type { LevelGameplayConfig } from "@/lib/level-config";
import {
  ITEM_FAMILIES,
  activitiesInFamily,
  applyItemActivity,
  resolveItemActivity,
  type ActivityIconName,
  type ItemActivity,
  type ItemActivityId,
  type ItemFamily,
  type ItemFamilyId,
} from "@/lib/item-activity";
import { FAMILY_UI, activityBuilderPath } from "@/lib/item-family-ui";
import { cn } from "@/lib/utils";

const ICONS: Record<ActivityIconName, typeof Blocks> = {
  blocks: Blocks,
  wrench: Wrench,
  blank: Puzzle,
  line: Minus,
  flag: Flag,
  pencil: PencilLine,
  shape: Pentagon,
  pattern: SquareDashed,
  slots: Puzzle,
  starter: Sparkles,
  hash: Hash,
};

type Props = {
  levelType: LevelType;
  config: LevelGameplayConfig;
  onApply: (next: { levelType: LevelType; config: LevelGameplayConfig }) => void;
  /** New items start on the four family cards so teachers are not dumped into 11 types. */
  startAtFamilyChooser?: boolean;
  onCommitted?: () => void;
};

export function ItemTypePicker({
  levelType,
  config,
  onApply,
  startAtFamilyChooser = false,
  onCommitted,
}: Props) {
  const selected = useMemo(
    () => resolveItemActivity(levelType, config),
    [levelType, config]
  );
  const [familyId, setFamilyId] = useState<ItemFamilyId | null>(
    startAtFamilyChooser ? null : selected.family
  );

  const family = ITEM_FAMILIES.find((f) => f.id === familyId) ?? null;
  const familyTone = family ? FAMILY_UI[family.id] : null;
  const SelectedIcon = ICONS[selected.icon];

  function apply(activity: ItemActivity) {
    if (activity.id !== selected.id) {
      onApply(applyItemActivity(activity.id as ItemActivityId, config));
    }
    onCommitted?.();
  }

  function chooseFamily(group: ItemFamily) {
    setFamilyId(group.id);
    const variants = activitiesInFamily(group.id);
    const keepCurrent = selected.family === group.id;
    apply(keepCurrent ? selected : variants[0]!);
  }

  if (!familyId || !family || !familyTone) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Start with the student job. You will name the item after this.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {ITEM_FAMILIES.map((group) => {
            const groupTone = FAMILY_UI[group.id];
            const FamilyIcon = ICONS[group.icon];
            const count = activitiesInFamily(group.id).length;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => chooseFamily(group)}
                className="group relative overflow-hidden rounded-3xl border border-stone-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-lg sm:p-5"
              >
                <span
                  className="absolute inset-x-0 top-0 h-1.5"
                  style={{
                    background: `linear-gradient(90deg, ${groupTone.fromHex}, ${groupTone.toHex})`,
                  }}
                />
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-sm"
                  style={{
                    background: `linear-gradient(135deg, ${groupTone.fromHex}, ${groupTone.toHex})`,
                  }}
                >
                  <FamilyIcon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 text-lg font-extrabold tracking-tight text-stone-800">
                  {group.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{group.studentJob}</p>
                <p
                  className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold"
                  style={{ color: groupTone.toHex }}
                >
                  {count} {count === 1 ? "way" : "ways"} to play
                  <ArrowRight className="h-3.5 w-3.5" />
                </p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const variants = activitiesInFamily(family.id);
  const path = activityBuilderPath(selected.id);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setFamilyId(null)}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All student jobs
        </button>
        <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", familyTone.chip)}>
          {family.title}
        </span>
      </div>

      <div
        className={cn(
          "flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/80 bg-gradient-to-br px-4 py-3 shadow-sm",
          familyTone.glow,
          familyTone.ring,
          "ring-1"
        )}
      >
        <span
          className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm"
          style={{ background: `linear-gradient(135deg, ${familyTone.fromHex}, ${familyTone.toHex})` }}
        >
          <SelectedIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Students will
          </p>
          <p className="text-sm font-bold text-slate-900 sm:text-base">{selected.studentJob}</p>
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {variants.map((activity) => {
          const Icon = ICONS[activity.icon];
          const on = selected.id === activity.id;
          return (
            <button
              key={activity.id}
              type="button"
              onClick={() => apply(activity)}
              className={cn(
                "group relative flex items-start gap-3 rounded-2xl border p-4 text-left transition",
                on ? familyTone.selected : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
              )}
            >
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                  on ? "text-white" : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                )}
                style={
                  on
                    ? { background: `linear-gradient(135deg, ${familyTone.fromHex}, ${familyTone.toHex})` }
                    : undefined
                }
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-900">{activity.title}</span>
                  {on && (
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full text-white"
                      style={{ backgroundColor: familyTone.barHex }}
                    >
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
                  {activity.studentJob}
                </span>
                <span className="mt-1.5 block text-[11px] font-medium text-slate-400">
                  {activity.example}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
          After this, you will
        </p>
        <ol className="mt-2 space-y-1.5">
          {path.map((step, i) => (
            <li key={step} className="flex gap-2 text-sm text-slate-600">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-bold text-slate-500 ring-1 ring-slate-200">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
