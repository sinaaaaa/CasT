"use client";

import { ArrowRight, GitCompare } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseCommandSequence, type CommandToken } from "@/lib/command-icons";
import { CommandIconSequence } from "@/components/assessment/command-icon-sequence";

export function CommandDiffPanel({
  initial,
  final,
}: {
  initial: string | null;
  final: string | null;
}) {
  const initialSteps = parseCommandSequence(initial?.replace(/;/g, ","));
  const finalSteps = parseCommandSequence(final?.replace(/;/g, ","));
  const maxLen = Math.max(initialSteps.length, finalSteps.length);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <CommandBlock title="Initial program" commands={initialSteps} variant="initial" raw={initial} />
        <CommandBlock title="Final program" commands={finalSteps} variant="final" raw={final} />
      </div>

      {maxLen > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-primary" />
            <h4 className="font-semibold">Step-by-step comparison</h4>
          </div>
          <ol className="space-y-2">
            {Array.from({ length: maxLen }).map((_, i) => {
              const a = initialSteps[i];
              const b = finalSteps[i];
              const changed = a !== b;
              const added = !a && b;
              const removed = a && !b;
              return (
                <li
                  key={i}
                  className={cn(
                    "grid gap-2 rounded-lg border p-3 text-sm transition-colors sm:grid-cols-[1fr_auto_1fr]",
                    changed && "border-amber-200 bg-amber-50/50",
                    added && "border-emerald-200 bg-emerald-50/50",
                    removed && "border-red-200 bg-red-50/50",
                    !changed && a && "border-border bg-muted/20"
                  )}
                >
                  <span className={cn(removed && "opacity-50")}>
                    {a ? <CommandIconSequence commands={[a]} size={28} /> : <span className="text-muted-foreground italic">—</span>}
                  </span>
                  <ArrowRight className="mx-auto hidden h-4 w-4 text-muted-foreground sm:block" />
                  <span>
                    {b ? <CommandIconSequence commands={[b]} size={28} /> : <span className="text-muted-foreground italic">—</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

function CommandBlock({
  title,
  commands,
  variant,
  raw,
}: {
  title: string;
  commands: CommandToken[];
  variant: "initial" | "final";
  raw: string | null;
}) {
  const isFinal = variant === "final";
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md",
        isFinal ? "border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 to-card" : "border-sky-200/80 bg-gradient-to-br from-sky-50/80 to-card"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 border-b px-4 py-3",
          isFinal ? "border-emerald-100 bg-emerald-100/40" : "border-sky-100 bg-sky-100/40"
        )}
      >
        <h4 className="font-semibold">{title}</h4>
        <span className="ml-auto text-xs text-muted-foreground">{commands.length} steps</span>
      </div>
      <div className="p-4">
        {commands.length > 0 ? (
          <CommandIconSequence commands={commands} size={40} />
        ) : (
          <p className="text-sm text-muted-foreground">{raw?.trim() ? "Could not parse commands" : "No commands recorded"}</p>
        )}
      </div>
    </div>
  );
}
