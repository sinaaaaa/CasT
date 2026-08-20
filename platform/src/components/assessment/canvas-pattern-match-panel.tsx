"use client";

import { CheckCircle2, XCircle, SquareDashed, Hash, AlertTriangle } from "lucide-react";
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

function stripTitle(kind: CanvasPatternMatchPayload["stripKind"]): {
  title: string;
  subtitle: string;
} {
  switch (kind) {
    case "count":
      return {
        title: "Canvas count answer",
        subtitle:
          "Student counted a pattern element with +/− and submitted a number — scored against the expected count.",
      };
    case "blanks":
      return {
        title: "Canvas blank fill",
        subtitle: "Filled blank slots compared with each accepted program (Repeat expands for equivalence).",
      };
    case "seed":
      return {
        title: "Canvas seeded program",
        subtitle: "Edited starter strip compared with accepted programs (Repeat expands for equivalence).",
      };
    default:
      return {
        title: "Canvas pattern match",
        subtitle: "Student program compared with each accepted answer (Repeat expands for equivalence).",
      };
  }
}

function CountAnswerEvidence({ result }: { result: CanvasPatternMatchPayload }) {
  const expected = result.expectedCount ?? 0;
  const student = result.studentCount;

  return (
    <div className="space-y-5">
      {result.answerMissing && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div>
            <p className="font-semibold">Answer not recorded in telemetry</p>
            <p className="mt-0.5 text-amber-900/90">
              Unity stored a completion placeholder instead of{" "}
              <code className="rounded bg-amber-100 px-1">count:N</code>. The database status
              (Incorrect) is the reliable grade for this attempt. Rebuild WebGL so future count
              answers are saved.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div
          className={cn(
            "rounded-2xl border p-5",
            result.matched
              ? "border-emerald-300 bg-emerald-50/60"
              : "border-rose-200 bg-rose-50/40"
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Student count
          </p>
          <p
            className={cn(
              "mt-2 font-semibold tabular-nums tracking-tight",
              student == null ? "text-3xl text-slate-400" : "text-5xl text-slate-900"
            )}
          >
            {student == null ? "—" : student}
          </p>
          <p className="mt-2 text-xs text-slate-600">
            {result.answerMissing
              ? "Missing from logged commands"
              : student == null
                ? "Could not parse a number"
                : "From the yellow-strip +/− counter"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Expected count
          </p>
          <p className="mt-2 text-5xl font-semibold tabular-nums tracking-tight text-slate-900">
            {expected}
          </p>
          <p className="mt-2 text-xs text-slate-600">
            Teacher-authored correct count for this pattern question
          </p>
        </div>
      </div>

      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
        {result.explanation}
      </p>
    </div>
  );
}

export function CanvasPatternMatchPanel({ result }: { result: CanvasPatternMatchPayload }) {
  const studentExpanded = toMotionIcons(result.studentTokens);
  const hasRepeat =
    result.studentTokens.some(parseRepeatish) ||
    result.acceptedPrograms.some((p) => p.some(parseRepeatish));
  const { title, subtitle } = stripTitle(result.stripKind);
  const isCount = result.stripKind === "count";

  return (
    <Card className="overflow-hidden border-slate-200/70 shadow-sm">
      <AssessmentPanelHeader
        icon={isCount ? Hash : SquareDashed}
        title={title}
        subtitle={subtitle}
        badges={
          <Badge variant={result.matched ? "success" : "danger"} className="gap-1 text-sm">
            {result.matched ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <XCircle className="h-3.5 w-3.5" />
            )}
            {result.matched ? "Correct" : "Incorrect"}
            {!isCount && result.matchedProgramIndex != null
              ? ` · matched program ${result.matchedProgramIndex + 1}`
              : ""}
            {isCount && result.matched ? " · count matches" : ""}
          </Badge>
        }
      />

      <CardContent className="space-y-5 pt-6">
        {isCount ? (
          <CountAnswerEvidence result={result} />
        ) : (
          <>
            <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">
                Student program
              </p>
              <p className="mt-1 text-xs text-sky-700/80">
                Shown like the yellow strip — Repeat Start / End use the same icons as in the game.
              </p>
              <div className="mt-3 overflow-x-auto rounded-xl border border-amber-200/80 bg-gradient-to-b from-amber-100 to-amber-200/90 p-3">
                {result.answerMissing ? (
                  <p className="text-sm text-amber-900/80">
                    No program recorded ({result.studentTokens.join("; ") || "empty"})
                  </p>
                ) : (
                  <ProgramSequenceVisualizer
                    tokens={result.studentTokens}
                    size={40}
                    tone={result.matched ? "match" : "miss"}
                  />
                )}
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
                <p className="text-sm text-muted-foreground">
                  No accepted programs configured on this item.
                </p>
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

            <p className="text-sm text-slate-600">{result.explanation}</p>
          </>
        )}
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
