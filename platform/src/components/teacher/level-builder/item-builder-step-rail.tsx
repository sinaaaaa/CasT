"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepRailItem<T extends string = string> = {
  id: T;
  label: string;
  description: string;
  icon: LucideIcon;
};

type Props<T extends string> = {
  steps: StepRailItem<T>[];
  currentStep: T;
  completedSteps: Set<T>;
  onStepClick: (id: T) => void;
};

export function ItemBuilderStepRail<T extends string>({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
}: Props<T>) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <nav aria-label="Item builder steps" className="space-y-1">
      {steps.map((step, index) => {
        const active = step.id === currentStep;
        const done = completedSteps.has(step.id);
        const Icon = step.icon;

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepClick(step.id)}
            className={cn(
              "group relative flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-all",
              active && "bg-[#4F46E5]/10 ring-1 ring-[#4F46E5]/20",
              !active && "hover:bg-slate-100"
            )}
          >
            {active && (
              <motion.span
                layoutId="builder-step-active"
                className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#4F46E5]/8 to-transparent"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <span
              className={cn(
                "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 transition-all",
                active && "border-[#4F46E5] bg-[#4F46E5] text-white shadow-lg shadow-indigo-200",
                done && !active && "border-emerald-500 bg-emerald-50 text-emerald-700",
                !active && !done && index <= currentIndex && "border-slate-300 bg-white text-slate-600",
                !active && !done && index > currentIndex && "border-slate-200 bg-slate-50 text-slate-400"
              )}
            >
              {done && !active ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </span>
            <span className="relative min-w-0 pt-0.5">
              <span
                className={cn(
                  "block text-sm font-bold",
                  active ? "text-[#4F46E5]" : "text-slate-800"
                )}
              >
                {step.label}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-slate-500">{step.description}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
