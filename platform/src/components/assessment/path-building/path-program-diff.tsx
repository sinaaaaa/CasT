"use client";

import { ArrowRight } from "lucide-react";
import { CommandIconSequence } from "@/components/assessment/command-icon-sequence";
import type { CommandToken } from "@/lib/command-icons";
import { cn } from "@/lib/utils";

export type PathProgramDiffProps = {
  starterProgram?: CommandToken[];
  studentProgram?: CommandToken[];
  optimalProgram?: CommandToken[];
  className?: string;
};

/**
 * Path-building levels: starter vs student vs best route (command icons).
 * Used by route assessment UI; kept as a real module so Tailwind/dev watchers resolve the path.
 */
export function PathProgramDiff({
  starterProgram = [],
  studentProgram = [],
  optimalProgram,
  className,
}: PathProgramDiffProps) {
  const columns = [
    { title: "Starter", commands: starterProgram, tone: "slate" as const },
    { title: "Student", commands: studentProgram, tone: "sky" as const },
    ...(optimalProgram?.length
      ? [{ title: "Best route", commands: optimalProgram, tone: "amber" as const }]
      : []),
  ];

  return (
    <div
      className={cn(
        "grid gap-3",
        columns.length === 3 ? "lg:grid-cols-[1fr_auto_1fr_auto_1fr]" : "lg:grid-cols-[1fr_auto_1fr]",
        className
      )}
    >
      {columns.map((col, i) => (
        <div key={col.title} className="flex items-center gap-3">
          {i > 0 && (
            <ArrowRight className="hidden h-5 w-5 shrink-0 text-sky-600/80 lg:block" aria-hidden />
          )}
          <div
            className={cn(
              "min-w-0 flex-1 rounded-xl border p-3",
              col.tone === "slate" && "border-slate-200 bg-slate-50/80",
              col.tone === "sky" && "border-sky-200 bg-sky-50/50",
              col.tone === "amber" && "border-amber-200 bg-amber-50/40"
            )}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {col.title}
            </p>
            <div className="mt-2 min-h-[40px]">
              {col.commands.length > 0 ? (
                <CommandIconSequence commands={col.commands} size={36} />
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
