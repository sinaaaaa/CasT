"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type WizardStepperItem<T extends string = string> = {
  id: T;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
};

type Props<T extends string> = {
  steps: WizardStepperItem<T>[];
  currentStep: T;
  completedSteps: Set<T>;
  onStepClick: (id: T) => void;
};

export function WizardStepper<T extends string>({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
}: Props<T>) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <nav aria-label="Builder steps" className="w-full">
      <ol className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
        {steps.map((step, index) => {
          const done = completedSteps.has(step.id);
          const active = step.id === currentStep;
          const past = index < currentIndex;
          const Icon = step.icon;

          return (
            <li key={step.id} className="flex min-w-0 flex-1 items-center">
              <button
                type="button"
                onClick={() => onStepClick(step.id)}
                className={cn(
                  "group flex w-full min-w-[4.5rem] flex-col items-center gap-1.5 rounded-xl px-2 py-2 transition-all",
                  active && "bg-primary/10",
                  !active && "hover:bg-slate-100"
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all",
                    active && "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25",
                    done && !active && "border-emerald-500 bg-emerald-50 text-emerald-700",
                    !active && !done && past && "border-slate-300 bg-white text-slate-600",
                    !active && !done && !past && "border-slate-200 bg-slate-50 text-slate-400"
                  )}
                >
                  {done && !active ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <span
                  className={cn(
                    "hidden text-center text-[11px] font-medium leading-tight sm:block",
                    active ? "text-primary" : "text-slate-600 group-hover:text-slate-900"
                  )}
                >
                  {step.shortLabel}
                </span>
              </button>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "mx-0.5 hidden h-0.5 min-w-[1rem] flex-1 rounded-full sm:block",
                    index < currentIndex ? "bg-emerald-400" : "bg-slate-200"
                  )}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
      <motion.p
        key={currentStep}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-2 text-center text-sm text-slate-500"
      >
        {steps.find((s) => s.id === currentStep)?.description}
      </motion.p>
    </nav>
  );
}
