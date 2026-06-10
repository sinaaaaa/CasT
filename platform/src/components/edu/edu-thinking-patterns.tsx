"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function EduThinkingPatterns({
  patterns,
}: {
  patterns: { label: string; count: number }[];
}) {
  const max = Math.max(...patterns.map((p) => p.count), 1);

  const defaults = [
    "Wrong turns",
    "Extra movements",
    "Obstacle collisions",
    "Prediction errors",
    "Debugging difficulties",
  ];

  const items =
    patterns.length > 0
      ? patterns
      : defaults.map((label) => ({ label, count: 0 }));

  return (
    <section className="mt-10">
      <div className="mb-5">
        <h3 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
          How students are thinking
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Common patterns from recent robot challenges — use these to plan your next lesson.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p, i) => {
          const pct = p.count > 0 ? Math.round((p.count / max) * 100) : 0;
          return (
            <motion.div
              key={p.label}
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -3 }}
              className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">{p.label}</p>
                {p.count > 0 && (
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">
                    {p.count}
                  </span>
                )}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    pct > 66 ? "bg-[#EF4444]" : pct > 33 ? "bg-[#F59E0B]" : "bg-[#14B8A6]"
                  )}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${Math.max(pct, p.count > 0 ? 8 : 0)}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: i * 0.06 }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {p.count === 0 ? "No data yet — students will populate this as they play." : "Observed in recent attempts"}
              </p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
