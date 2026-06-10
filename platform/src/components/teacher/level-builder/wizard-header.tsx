"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Cloud, CloudOff, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

type Props = {
  levelName: string;
  stepIndex: number;
  totalSteps: number;
  autosaveStatus: AutosaveStatus;
  isNew: boolean;
};

export function WizardHeader({ levelName, stepIndex, totalSteps, autosaveStatus, isNew }: Props) {
  const progress = Math.round(((stepIndex + 1) / totalSteps) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-30 -mx-4 border-b border-slate-200/80 bg-white/90 px-4 py-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
    >
      <div className="mx-auto max-w-5xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-primary">Item builder</p>
            <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">
              {levelName.trim() || "Untitled item"}
            </h1>
          </div>
          <AutosaveBadge status={autosaveStatus} isNew={isNew} />
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-500">
            <span>
              Step {stepIndex + 1} of {totalSteps}
            </span>
            <span>{progress}% complete</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      </div>
    </motion.div>
  );
}

function AutosaveBadge({ status, isNew }: { status: AutosaveStatus; isNew: boolean }) {
  if (isNew) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
        <CloudOff className="h-3.5 w-3.5" />
        Save once to enable auto-save
      </span>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={status}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
          status === "saved" && "border-emerald-200 bg-emerald-50 text-emerald-800",
          status === "saving" && "border-slate-200 bg-slate-50 text-slate-600",
          status === "error" && "border-red-200 bg-red-50 text-red-800",
          status === "idle" && "border-slate-200 bg-slate-50 text-slate-500"
        )}
      >
        {status === "saving" && (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Saving…
          </>
        )}
        {status === "saved" && (
          <>
            <CheckCircle2 className="h-3.5 w-3.5" />
            All changes saved
          </>
        )}
        {status === "error" && (
          <>
            <AlertCircle className="h-3.5 w-3.5" />
            Could not save
          </>
        )}
        {status === "idle" && (
          <>
            <Cloud className="h-3.5 w-3.5" />
            Auto-save on
          </>
        )}
      </motion.span>
    </AnimatePresence>
  );
}
