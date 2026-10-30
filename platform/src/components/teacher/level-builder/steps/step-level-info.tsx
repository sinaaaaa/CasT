"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { LevelType } from "@prisma/client";
import { ChevronDown, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type LevelGameplayConfig, suggestLevelKeyFromName } from "@/lib/level-config";
import { CornerHintEditor } from "@/components/teacher/level-designer/corner-hint-editor";
import { ItemBuilderPanel, ItemBuilderStepFrame } from "../item-builder-step-frame";
import { ItemTypePicker } from "../item-type-picker";
import { cn } from "@/lib/utils";

const DIFFICULTY_OPTIONS = [
  { value: 1, label: "Warm-up" },
  { value: 2, label: "Easy" },
  { value: 3, label: "Medium" },
  { value: 4, label: "Hard" },
  { value: 5, label: "Expert" },
] as const;

type Props = {
  isEdit: boolean;
  activityPicked: boolean;
  onActivityPicked: () => void;
  levelKey: string;
  setLevelKey: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  orderIndex: number;
  setOrderIndex: (v: number) => void;
  difficulty: number;
  setDifficulty: (v: number) => void;
  levelType: LevelType;
  applyActivity: (next: { levelType: LevelType; config: LevelGameplayConfig }) => void;
  config: LevelGameplayConfig;
  setConfig: (c: LevelGameplayConfig) => void;
};

export function StepLevelInfo(props: Props) {
  const {
    isEdit,
    activityPicked,
    onActivityPicked,
    levelKey,
    setLevelKey,
    name,
    setName,
    description,
    setDescription,
    orderIndex,
    setOrderIndex,
    difficulty,
    setDifficulty,
    levelType,
    applyActivity,
    config,
    setConfig,
  } = props;

  const levelKeyTouched = useRef(isEdit);

  function handleNameChange(value: string) {
    setName(value);
    if (!isEdit && !levelKeyTouched.current) {
      setLevelKey(suggestLevelKeyFromName(value));
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="space-y-8"
    >
      <ItemBuilderStepFrame
        icon={Sparkles}
        title="What will students do?"
        subtitle={
          activityPicked
            ? "Change the activity if you need to, then give it a classroom name below."
            : "Pick a family, then one activity. The rest of the builder follows this choice."
        }
        accent="teal"
      >
        <ItemTypePicker
          levelType={levelType}
          config={config}
          onApply={applyActivity}
          startAtFamilyChooser={!isEdit && !activityPicked}
          onCommitted={onActivityPicked}
        />
      </ItemBuilderStepFrame>

      {activityPicked && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
          <ItemBuilderPanel
            title="Classroom name"
            description="Students see this. Keep it short and concrete."
          >
            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-slate-800">Display name</span>
              <Input
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Deliver the newspaper"
                className="h-12 rounded-xl border-slate-200 text-base"
                required
              />
            </label>
          </ItemBuilderPanel>

          <div className="space-y-6">
            <ItemBuilderPanel title="Difficulty" description="Used in reports and sequencing.">
              <div className="flex gap-1.5">
                {DIFFICULTY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDifficulty(opt.value)}
                    className={cn(
                      "flex-1 rounded-xl border-2 py-2.5 text-center text-[11px] font-bold transition sm:text-xs",
                      difficulty === opt.value
                        ? "border-navy bg-navy text-white shadow-sm"
                        : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </ItemBuilderPanel>

            <ItemBuilderPanel title="Counts in reports?">
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: "ASSESSMENT" as const, title: "Assessment", hint: "Scored" },
                    { value: "INTRO" as const, title: "Practice", hint: "Not scored" },
                  ] as const
                ).map((opt) => {
                  const selected = (config.itemPurpose ?? "ASSESSMENT") === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setConfig({ ...config, itemPurpose: opt.value })}
                      className={cn(
                        "rounded-xl border-2 px-3 py-3 text-left transition",
                        selected
                          ? "border-[#0F9B8E] bg-[#0F9B8E]/10"
                          : "border-stone-200 bg-white hover:border-stone-300"
                      )}
                    >
                      <span className="block text-sm font-bold text-slate-900">{opt.title}</span>
                      <span className="text-[11px] text-slate-500">{opt.hint}</span>
                    </button>
                  );
                })}
              </div>
            </ItemBuilderPanel>
          </div>
        </div>
      )}

      {activityPicked && (
        <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">
            <span>More options · code, order, notes, student tip</span>
            <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
          </summary>
          <div className="space-y-5 border-t border-slate-100 px-5 pb-5 pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-800">Item code</span>
                <Input
                  value={levelKey}
                  onChange={(e) => {
                    levelKeyTouched.current = true;
                    setLevelKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"));
                  }}
                  placeholder="level_deliver_newspaper"
                  className="h-11 rounded-xl border-slate-200 font-mono text-sm"
                  disabled={isEdit}
                  required
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-800">Order</span>
                <Input
                  type="number"
                  className="h-11 rounded-xl border-slate-200"
                  value={orderIndex}
                  onChange={(e) => setOrderIndex(Number(e.target.value))}
                  min={0}
                />
                <p className="text-xs text-stone-500">
                  New items line up after the last one in the catalog.
                </p>
              </label>
            </div>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-slate-800">Private notes</span>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Only you see this"
                rows={2}
                className="rounded-xl border-slate-200"
              />
            </label>
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-800">Student tip while playing</p>
              <CornerHintEditor config={config} onChange={setConfig} label="" />
            </div>
          </div>
        </details>
      )}
    </motion.div>
  );
}
