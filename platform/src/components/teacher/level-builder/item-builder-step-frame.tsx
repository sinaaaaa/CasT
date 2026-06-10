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
    indigo: "from-[#4F46E5]/12 to-violet-500/5 border-indigo-100 text-indigo-700",
    teal: "from-[#14B8A6]/12 to-emerald-500/5 border-teal-100 text-teal-700",
    violet: "from-violet-500/12 to-fuchsia-500/5 border-violet-100 text-violet-700",
    amber: "from-amber-500/12 to-orange-500/5 border-amber-100 text-amber-700",
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
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">{title}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">{subtitle}</p>
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
        "rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6",
        className
      )}
    >
      <div className="mb-5">
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      </div>
      {children}
    </section>
  );
}
