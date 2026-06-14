"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { MetricInfo } from "@/components/assessment/metric-info";
import type { GlossaryKey } from "@/lib/assessment/assessmentGlossary";
import { cn } from "@/lib/utils";
import { resolveEduIcon, type EduIconName } from "@/components/edu/edu-icons";

export function MetricTile({
  label,
  value,
  sub,
  icon,
  iconName,
  tone = "default",
  href,
  index = 0,
  info,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon?: LucideIcon;
  iconName?: EduIconName;
  tone?: "default" | "success" | "danger" | "warning" | "info";
  href?: string;
  index?: number;
  info?: GlossaryKey;
}) {
  const Icon = icon ?? (iconName ? resolveEduIcon(iconName) : undefined);
  const tones = {
    default: "from-white to-indigo-50/30 ring-slate-100",
    success: "from-white to-emerald-50/50 ring-emerald-100",
    danger: "from-white to-rose-50/50 ring-rose-100",
    warning: "from-white to-amber-50/50 ring-amber-100",
    info: "from-white to-teal-50/50 ring-teal-100",
  };
  const iconTones = {
    default: "bg-[#4F46E5] text-white shadow-indigo-200",
    success: "bg-[#22C55E] text-white shadow-emerald-200",
    danger: "bg-[#EF4444] text-white shadow-rose-200",
    warning: "bg-[#F59E0B] text-white shadow-amber-200",
    info: "bg-[#14B8A6] text-white shadow-teal-200",
  };

  const className = cn(
    "block rounded-2xl bg-gradient-to-br p-5 shadow-sm ring-1 transition-all hover:-translate-y-1 hover:shadow-md",
    tones[tone],
    href && "cursor-pointer"
  );

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-500">
          {label}
          {info && <MetricInfo metric={info} />}
        </p>
        {Icon && (
          <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl shadow-md", iconTones[tone])}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">{value}</p>
      {sub && <p className="mt-1.5 text-sm text-slate-600">{sub}</p>}
    </>
  );

  const wrapped = href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
    >
      {wrapped}
    </motion.div>
  );
}
