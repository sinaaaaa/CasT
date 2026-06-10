"use client";

import { cn } from "@/lib/utils";
import type { WizardStepId } from "./wizard-types";
import { WIZARD_STEPS } from "./wizard-types";

type Props = {
  currentStep: WizardStepId;
  completedSteps: Set<WizardStepId>;
  onStepClick: (id: WizardStepId) => void;
};

export function ItemBuilderMobileSteps({ currentStep, completedSteps, onStepClick }: Props) {
  const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="lg:hidden">
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {WIZARD_STEPS.map((step, index) => {
          const active = step.id === currentStep;
          const done = completedSteps.has(step.id);
          const reachable = index <= currentIndex || done;

          return (
            <button
              key={step.id}
              type="button"
              disabled={!reachable}
              onClick={() => reachable && onStepClick(step.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                active && "border-[#4F46E5] bg-[#4F46E5] text-white",
                !active && done && "border-emerald-200 bg-emerald-50 text-emerald-800",
                !active && !done && reachable && "border-slate-200 bg-white text-slate-700",
                !reachable && "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
              )}
            >
              {step.shortLabel}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Step {currentIndex + 1} of {WIZARD_STEPS.length} · {WIZARD_STEPS[currentIndex]?.label}
      </p>
    </div>
  );
}
