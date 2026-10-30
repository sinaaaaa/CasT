"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ItemBuilderStepFrame({
  icon: Icon,
  title,
  subtitle,
  accent = "indigo",
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  accent?: "indigo" | "teal" | "violet" | "amber";
  children?: React.ReactNode;
  className?: string;
}) {
  const accents = {
    indigo: "from-[#4F46E5]/10 to-[#F5F2EB] border-stone-200 text-indigo-700",
    teal: "from-[#0F9B8E]/10 to-[#F5F2EB] border-stone-200 text-teal-800",
    violet: "from-[#9E66EB]/10 to-[#F5F2EB] border-stone-200 text-violet-800",
    amber: "from-[#F7E37D]/50 to-[#F5F2EB] border-[#E8C547]/50 text-amber-900",
  };

  return (
    <div className={cn("space-y-6", className)}>
      <div
        className={cn(
          "rounded-2xl border bg-gradient-to-br p-5 sm:p-6",
          accents[accent]
        )}
      >
        <div className="flex gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
            <Icon className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-stone-800 sm:text-xl">{title}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-stone-600">{subtitle}</p>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

export function ItemBuilderPanel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm ring-1 ring-stone-100/80 sm:p-6",
        className
      )}
    >
      <div className="mb-5">
        <h3 className="text-base font-bold text-stone-900">{title}</h3>
        {description && <p className="mt-1 text-sm text-stone-600">{description}</p>}
      </div>
      {children}
    </section>
  );
}
