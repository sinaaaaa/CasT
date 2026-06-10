"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Props = {
  emoji: string;
  title: string;
  description: string;
  gradient: string;
  accent: string;
  index?: number;
};

export function SparcFeatureCard({
  emoji,
  title,
  description,
  gradient,
  accent,
  index = 0,
}: Props) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay: index * 0.08 }}
      whileHover={{ y: -6, scale: 1.02 }}
      className={cn(
        "group relative overflow-hidden rounded-3xl border-2 bg-white p-6 shadow-md shadow-slate-200/60 transition-shadow hover:shadow-xl hover:shadow-indigo-200/40",
        accent
      )}
    >
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-60 transition-opacity group-hover:opacity-100",
          gradient
        )}
      />
      <div className="relative">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm">
          {emoji}
        </div>
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <p className="mt-2 text-base leading-relaxed text-slate-600">{description}</p>
      </div>
    </motion.article>
  );
}
