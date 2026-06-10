"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SparcCountUp } from "./sparc-count-up";

type Props = {
  icon: LucideIcon;
  label: string;
  value: number;
  suffix?: string;
  accent: string;
  index?: number;
};

export function SparcStatCard({ icon: Icon, label, value, suffix = "", accent, index = 0 }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.07, type: "spring", stiffness: 200 }}
      whileHover={{ y: -4 }}
      className="rounded-3xl border-2 border-white bg-white p-5 shadow-md shadow-slate-200/60"
    >
      <div className={cn("mb-3 flex h-11 w-11 items-center justify-center rounded-2xl", accent)}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-slate-900">
        <SparcCountUp value={value} />
        {suffix}
      </p>
    </motion.div>
  );
}

type RingProps = {
  percent: number;
  label: string;
  size?: number;
};

export function SparcProgressRing({ percent, label, size = 120 }: RingProps) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={stroke}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#4F46E5"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            whileInView={{ strokeDashoffset: offset }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold text-indigo-700">
            <SparcCountUp value={percent} />%
          </span>
        </div>
      </div>
      <p className="text-sm font-semibold text-slate-600">{label}</p>
    </div>
  );
}
