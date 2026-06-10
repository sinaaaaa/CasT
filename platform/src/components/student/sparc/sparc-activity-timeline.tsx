"use client";

import { motion } from "framer-motion";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  levelName: string;
  passed: boolean;
  score: number | null;
  endedAt: string | null;
};

export function SparcActivityTimeline({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-8 text-center">
        <p className="text-lg font-semibold text-indigo-800">No adventures yet!</p>
        <p className="mt-1 text-slate-600">Press Play and complete your first challenge.</p>
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {items.map((item, i) => (
        <motion.li
          key={item.id}
          initial={{ opacity: 0, x: -12 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.06 }}
          className="flex gap-4 rounded-2xl border-2 border-white bg-white p-4 shadow-sm"
        >
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
              item.passed ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
            )}
          >
            {item.passed ? (
              <CheckCircle2 className="h-6 w-6" />
            ) : (
              <RotateCcw className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-slate-900">
              {item.passed ? "Completed" : "Tried"}: {item.levelName}
            </p>
            <p className="text-sm text-slate-500">
              {item.endedAt
                ? new Date(item.endedAt).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })
                : "Recently"}
              {item.score != null && ` · Score ${item.score}`}
            </p>
          </div>
        </motion.li>
      ))}
    </ol>
  );
}
