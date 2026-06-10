"use client";

import { Lightbulb } from "lucide-react";
import type { WizardStepId } from "./wizard-types";
import { WIZARD_STEP_CONTEXT } from "./wizard-types";

export function ItemBuilderContextPanel({ stepId }: { stepId: WizardStepId }) {
  const ctx = WIZARD_STEP_CONTEXT[stepId];

  return (
    <aside className="hidden w-72 shrink-0 xl:block">
      <div className="sticky top-24 space-y-4 pr-6">
        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-5">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm">
            <Lightbulb className="h-4 w-4 text-[#4F46E5]" />
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#4F46E5]">Design tip</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{ctx.title}</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{ctx.body}</p>
        </div>
        {ctx.checklist.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Before you continue</p>
            <ul className="mt-3 space-y-2">
              {ctx.checklist.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-slate-600">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4F46E5]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );
}
