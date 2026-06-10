"use client";

import { motion } from "framer-motion";
import { Lock, Star } from "lucide-react";
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
  onClick?: () => void;
};

const statusBadge = {
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-800" },
  in_progress: { label: "In Progress", className: "bg-amber-100 text-amber-800" },
  new: { label: "New", className: "bg-indigo-100 text-indigo-800" },
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
  onClick,
}: Props) {
  const meta = levelTaskMeta(taskLabel);
  const Icon = meta.icon;
  const badge = statusBadge[status];

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -8, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2"
    >
      <div className="overflow-hidden rounded-3xl border-2 border-white bg-white shadow-lg shadow-slate-200/80 transition-shadow group-hover:shadow-xl group-hover:shadow-indigo-200/50">
        <div
          className={cn(
            "relative flex h-36 items-center justify-center bg-gradient-to-br",
            meta.gradient
          )}
        >
          <Icon className="h-16 w-16 text-white/90 drop-shadow-md" strokeWidth={1.5} />
          <span className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl bg-white/90 text-sm font-bold text-indigo-700 shadow">
            {levelNumber}
          </span>
          {status === "completed" && score != null && score >= 70 && (
            <span className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-xs font-bold text-amber-600 shadow">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {score}
            </span>
          )}
          <span className="absolute bottom-3 right-3 text-2xl opacity-80">{meta.emoji}</span>
        </div>

        <div className="space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", badge.className)}>
              {badge.label}
            </span>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", difficultyColor(difficulty))}>
              {diffLabel}
            </span>
          </div>
          <h3 className="text-lg font-bold leading-snug text-slate-900">{name}</h3>
          <p className="text-sm font-medium text-indigo-600">{taskLabel}</p>
        </div>
      </div>
    </motion.button>
  );
}

/** Locked preview card for upcoming levels */
export function SparcLevelCardLocked({ index = 0 }: { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05 }}
      className="overflow-hidden rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/80 opacity-70"
    >
      <div className="flex h-36 items-center justify-center bg-slate-100">
        <Lock className="h-10 w-10 text-slate-400" />
      </div>
      <div className="p-5">
        <p className="text-sm font-medium text-slate-500">More adventures coming soon!</p>
      </div>
    </motion.div>
  );
}
