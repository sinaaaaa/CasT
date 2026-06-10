"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Cloud, CloudOff, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AutosaveStatus } from "./wizard-header";

type Props = {
  itemName: string;
  isNew: boolean;
  autosaveStatus: AutosaveStatus;
  currentStepLabel: string;
};

export function ItemBuilderTopbar({ itemName, isNew, autosaveStatus, currentStepLabel }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/teacher/levels"
            className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Items</span>
          </Link>
          <div className="hidden h-6 w-px bg-slate-200 sm:block" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#4F46E5]">
              {isNew ? "Create item" : "Edit item"}
            </p>
            <h1 className="truncate text-base font-extrabold text-slate-900 sm:text-lg">
              {itemName.trim() || "Untitled item"}
            </h1>
            <p className="truncate text-xs text-slate-500">{currentStepLabel}</p>
          </div>
        </div>
        <AutosaveBadge status={autosaveStatus} isNew={isNew} />
      </div>
    </header>
  );
}

function AutosaveBadge({ status, isNew }: { status: AutosaveStatus; isNew: boolean }) {
  if (isNew) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">
        <CloudOff className="h-3.5 w-3.5" />
        Save once to enable auto-save
      </span>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={status}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold",
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
            Saved
          </>
        )}
        {status === "error" && (
          <>
            <AlertCircle className="h-3.5 w-3.5" />
            Save failed
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
