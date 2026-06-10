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
  { value: 1, label: "Warm-up", hint: "First exposure" },
  { value: 2, label: "Easy", hint: "Gentle challenge" },
  { value: 3, label: "Medium", hint: "Standard practice" },
  { value: 4, label: "Hard", hint: "Requires planning" },
  { value: 5, label: "Expert", hint: "Multi-step reasoning" },
] as const;

type Props = {
  isEdit: boolean;
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
  applyType: (t: LevelType) => void;
  config: LevelGameplayConfig;
  setConfig: (c: LevelGameplayConfig) => void;
};

export function StepLevelInfo(props: Props) {
  const {
    isEdit,
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
    applyType,
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
        title="What kind of challenge is this?"
        subtitle="Start by choosing how students will interact. Everything else adapts to this choice."
        accent="indigo"
      >
        <ItemTypePicker value={levelType} onChange={applyType} />
      </ItemBuilderStepFrame>

      <ItemBuilderPanel
        title="Name & identity"
        description="Students see the display name. The item code is for your records and exports."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-sm font-semibold text-slate-800">Display name</span>
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Deliver the newspaper"
              className="h-11 rounded-xl border-slate-200"
              required
            />
          </label>
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
            <span className="text-xs text-slate-500">Unique ID — auto-filled from name until you edit it</span>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-slate-800">Order in sequence</span>
            <Input
              type="number"
              className="h-11 rounded-xl border-slate-200"
              value={orderIndex}
              onChange={(e) => setOrderIndex(Number(e.target.value))}
              min={0}
            />
            <span className="text-xs text-slate-500">Lower numbers appear earlier in the item list</span>
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-sm font-semibold text-slate-800">Teacher notes</span>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Private notes — students never see this"
              rows={2}
              className="rounded-xl border-slate-200"
            />
          </label>
        </div>
      </ItemBuilderPanel>

      <ItemBuilderPanel
        title="Difficulty"
        description="Helps you filter analytics and balance your item sequence."
      >
        <div className="grid gap-2 sm:grid-cols-5">
          {DIFFICULTY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setDifficulty(opt.value)}
              className={cn(
                "rounded-xl border-2 px-3 py-3 text-left transition-all",
                difficulty === opt.value
                  ? "border-[#4F46E5] bg-indigo-50 shadow-md shadow-indigo-100"
                  : "border-slate-200 bg-white hover:border-indigo-200"
              )}
            >
              <p className="text-sm font-bold text-slate-900">{opt.label}</p>
              <p className="mt-0.5 text-xs text-slate-500">{opt.hint}</p>
            </button>
          ))}
        </div>
      </ItemBuilderPanel>

      <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
          <span>Student tip while playing (optional)</span>
          <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
        </summary>
        <div className="border-t border-slate-100 px-5 pb-5 pt-2">
          <CornerHintEditor config={config} onChange={setConfig} label="" />
        </div>
      </details>
    </motion.div>
  );
}
