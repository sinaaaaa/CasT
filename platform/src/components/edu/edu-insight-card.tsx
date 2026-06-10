"use client";

import { motion } from "framer-motion";
import { TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { resolveEduIcon, type EduIconName } from "@/components/edu/edu-icons";

export function EduInsightCard({
  label,
  value,
  explanation,
  iconName,
  tone = "default",
  trend,
  href,
  index = 0,
}: {
  label: string;
  value: React.ReactNode;
  explanation?: string;
  iconName: EduIconName;
  tone?: "default" | "success" | "warning" | "danger" | "teal";
  trend?: "up" | "down" | "neutral";
  href?: string;
  index?: number;
}) {
  const Icon = resolveEduIcon(iconName);
  const tones = {
    default: "from-indigo-500/10 to-violet-500/5 ring-indigo-100",
    success: "from-emerald-500/10 to-teal-500/5 ring-emerald-100",
    warning: "from-amber-500/10 to-orange-500/5 ring-amber-100",
    danger: "from-rose-500/10 to-red-500/5 ring-rose-100",
    teal: "from-teal-500/10 to-cyan-500/5 ring-teal-100",
  };

  const iconTones = {
    default: "bg-[#4F46E5] text-white",
    success: "bg-[#22C55E] text-white",
    warning: "bg-[#F59E0B] text-white",
    danger: "bg-[#EF4444] text-white",
    teal: "bg-[#14B8A6] text-white",
  };

  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4 }}
      whileHover={{ y: -4 }}
      className={cn(
        "relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 shadow-sm ring-1 transition-shadow hover:shadow-lg",
        tones[tone],
        href && "cursor-pointer"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl shadow-md", iconTones[tone])}>
          <Icon className="h-5 w-5" />
        </span>
        {trend && trend !== "neutral" && (
          <span className={cn("rounded-full p-1.5", trend === "up" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
            {trend === "up" ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          </span>
        )}
      </div>
      <p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">{value}</p>
      {explanation && (
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{explanation}</p>
      )}
    </motion.div>
  );

  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}
