"use client";

import { CheckCircle2, XCircle, SquareDashed } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AssessmentPanelHeader } from "@/components/assessment/assessment-panel-header";
import { CommandIconSequence } from "@/components/assessment/command-icon-sequence";
import { ProgramSequenceVisualizer } from "@/components/assessment/program-sequence-visualizer";
import { expandRepeatTokens } from "@/lib/assessment/expand-repeats";
import type { CanvasPatternMatchPayload } from "@/lib/assessment/canvas-pattern-match";
import { normalizeCommandToken, type CommandToken } from "@/lib/command-icons";
import { cn } from "@/lib/utils";

export type { CanvasPatternMatchPayload } from "@/lib/assessment/canvas-pattern-match";

function toMotionIcons(tokens: string[]): CommandToken[] {
  return expandRepeatTokens(tokens)
    .map((t) => {
      const n = normalizeCommandToken(t);
      if (n) return n;
      const lower = t.trim().toLowerCase();
      if (lower === "right") return "turn right" as const;
      if (lower === "left") return "turn left" as const;
      return null;
    })
    .filter((c): c is CommandToken => c != null);
}

export function CanvasPatternMatchPanel({ result }: { result: CanvasPatternMatchPayload }) {
  const studentExpanded = toMotionIcons(result.studentTokens);
  const hasRepeat =
    result.studentTokens.some(parseRepeatish) ||
    result.acceptedPrograms.some((p) => p.some(parseRepeatish));

  return (
    <Card className="overflow-hidden border-slate-200/70 shadow-sm">
      <AssessmentPanelHeader
        icon={SquareDashed}
        title="Canvas pattern match"
        subtitle="Student program compared with each accepted answer (Repeat expands for equivalence)."
        badges={
          <Badge variant={result.matched ? "success" : "danger"} className="gap-1 text-sm">
            {result.matched ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <XCircle className="h-3.5 w-3.5" />
            )}
            {result.matched ? "Correct" : "Incorrect"}
            {result.matchedProgramIndex != null
              ? ` · matched program ${result.matchedProgramIndex + 1}`
              : ""}
          </Badge>
        }
      />

      <CardContent className="space-y-5 pt-6">
        <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">
            Student program
          </p>
          <p className="mt-1 text-xs text-sky-700/80">
            Shown like the yellow strip — Repeat Start / End use the same icons as in the game.
          </p>
          <div className="mt-3 overflow-x-auto rounded-xl border border-amber-200/80 bg-gradient-to-b from-amber-100 to-amber-200/90 p-3">
            <ProgramSequenceVisualizer
              tokens={result.studentTokens}
              size={40}
              tone={result.matched ? "match" : "miss"}
            />
          </div>
          {studentExpanded.length > 0 && hasRepeat && (
            <div className="mt-4 border-t border-sky-100 pt-3">
              <p className="mb-2 text-xs text-muted-foreground">
                What RUN expands to (motions only)
              </p>
              <CommandIconSequence commands={studentExpanded} size={32} />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Accepted programs
          </p>
          {result.acceptedPrograms.length === 0 ? (
            <p className="text-sm text-muted-foreground">No accepted programs configured on this item.</p>
          ) : (
            result.acceptedPrograms.map((prog, i) => {
              const isMatch = result.matchedProgramIndex === i;
              const expanded = toMotionIcons(prog);
              const progHasRepeat = prog.some(parseRepeatish);
              return (
                <div
                  key={i}
                  className={cn(
                    "rounded-xl border p-4",
                    isMatch
                      ? "border-emerald-300 bg-emerald-50/50"
                      : "border-slate-200 bg-white"
                  )}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-900">Program {i + 1}</span>
                    <Badge variant={isMatch ? "success" : "outline"}>
                      {isMatch ? "Matched" : "Not matched"}
                    </Badge>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-amber-200/70 bg-gradient-to-b from-amber-50 to-amber-100/80 p-3">
                    <ProgramSequenceVisualizer
                      tokens={prog}
                      size={36}
                      tone={isMatch ? "match" : "neutral"}
                    />
                  </div>
                  {expanded.length > 0 && progHasRepeat && (
                    <div className="mt-3">
                      <p className="mb-2 text-xs text-muted-foreground">Expanded motions</p>
                      <CommandIconSequence commands={expanded} size={28} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function parseRepeatish(raw: string): boolean {
  const t = raw.trim().toLowerCase().replace(/_/g, "-");
  return (
    t === "repeat" ||
    t.startsWith("repeat:") ||
    t.startsWith("repeat-start") ||
    t === "repeat-end" ||
    t === "end-repeat"
  );
}
