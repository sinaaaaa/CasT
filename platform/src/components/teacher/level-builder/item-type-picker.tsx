"use client";

import { motion } from "framer-motion";
import { Flag, GitBranch, MousePointerClick, Wrench } from "lucide-react";
import { LevelType } from "@prisma/client";
import { LEVEL_TYPE_HELP, LEVEL_TYPE_LABELS } from "@/lib/level-config";
import { cn } from "@/lib/utils";

const PLAYABLE_TYPES = [
  LevelType.DRAG_ACTIONS,
  LevelType.DRAG_EDIT_PROGRAM,
  LevelType.FLAG_PLACEMENT,
  LevelType.CHOOSE_BUTTONS,
] as const;

const TYPE_META: Record<
  (typeof PLAYABLE_TYPES)[number],
  { icon: typeof GitBranch; example: string; gradient: string }
> = {
  [LevelType.DRAG_ACTIONS]: {
    icon: GitBranch,
    example: "Build a path with drag-and-drop blocks",
    gradient: "from-teal-500 to-emerald-600",
  },
  [LevelType.DRAG_EDIT_PROGRAM]: {
    icon: Wrench,
    example: "Fix or extend a starter program",
    gradient: "from-rose-500 to-pink-600",
  },
  [LevelType.FLAG_PLACEMENT]: {
    icon: Flag,
    example: "Predict where the robot should finish",
    gradient: "from-amber-500 to-orange-600",
  },
  [LevelType.CHOOSE_BUTTONS]: {
    icon: MousePointerClick,
    example: "Fill in the missing turn or move",
    gradient: "from-sky-500 to-blue-600",
  },
};

export function ItemTypePicker({
  value,
  onChange,
}: {
  value: LevelType;
  onChange: (type: LevelType) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {PLAYABLE_TYPES.map((type, index) => {
        const meta = TYPE_META[type];
        const Icon = meta.icon;
        const selected = value === type;

        return (
          <motion.button
            key={type}
            type="button"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onChange(type)}
            className={cn(
              "group relative overflow-hidden rounded-2xl border-2 p-5 text-left transition-shadow",
              selected
                ? "border-[#4F46E5] bg-indigo-50/50 shadow-lg shadow-indigo-100 ring-2 ring-[#4F46E5]/20"
                : "border-slate-200 bg-white hover:border-indigo-200 hover:shadow-md"
            )}
          >
            <div
              className={cn(
                "mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md",
                meta.gradient
              )}
            >
              <Icon className="h-6 w-6" />
            </div>
            <p className="text-base font-bold text-slate-900">{LEVEL_TYPE_LABELS[type]}</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{LEVEL_TYPE_HELP[type]}</p>
            <p className="mt-3 text-xs font-semibold text-indigo-600">{meta.example}</p>
            {selected && (
              <span className="absolute right-4 top-4 rounded-full bg-[#4F46E5] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Selected
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
