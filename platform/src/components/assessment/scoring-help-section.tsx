"use client";

import { Info } from "lucide-react";
import {
  DiagnosticScoreInfo,
  ItemOutcomeInfo,
  type DiagnosticScoreVariant,
} from "@/components/assessment/diagnostic-score-info";

export function ScoringHelpSection({
  variant,
  goalLabel = "goal",
  visitSequence = false,
}: {
  variant: DiagnosticScoreVariant;
  goalLabel?: string;
  visitSequence?: boolean;
}) {
  return (
    <details className="group rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-slate-600 [&::-webkit-details-marker]:hidden">
        <Info className="h-3.5 w-3.5 text-slate-500" />
        How is this scored?
      </summary>
      <div className="mt-2 space-y-2 text-xs leading-relaxed text-slate-600">
        {variant === "flag" && (
          <>
            <p>
              <strong className="inline-flex items-center gap-1 text-slate-800">
                Item outcome
                <ItemOutcomeInfo />
              </strong>{" "}
              — Did the flag land on the cell where the robot actually stops? Correct = 100%, incorrect =
              0%.
            </p>
            <p>
              <strong className="inline-flex items-center gap-1 text-slate-800">
                Diagnostic score
                <DiagnosticScoreInfo variant="flag" />
              </strong>{" "}
              — For wrong flags, how closely the placement matches a known mistake pattern. It names the
              likely misconception; it is not partial credit for being near the right cell.
            </p>
          </>
        )}

        {variant === "pathBuilding" && (
          <>
            <p>
              The robot must <strong>stop on the {goalLabel}</strong>
              {visitSequence ? " in the required visit order" : ""} — passing through does not count.
            </p>
            <p>
              <strong className="inline-flex items-center gap-1 text-slate-800">
                Diagnostic score
                <DiagnosticScoreInfo variant="pathBuilding" />
              </strong>{" "}
              — Route quality (exact, valid, extra moves, partial, wrong order, obstacle, etc.) plus
              how much of the goal path was completed.
            </p>
          </>
        )}

        {variant === "debugging" && (
          <>
            <p>
              The robot must <strong>stop on the {goalLabel}</strong> after the student fixes the
              starter program — passing through does not count as fixed.
            </p>
            <p>
              <strong className="inline-flex items-center gap-1 text-slate-800">
                Diagnostic score
                <DiagnosticScoreInfo variant="debugging" />
              </strong>{" "}
              — Mix of bug fixed, how appropriate the edit was, edit focus, and whether the student
              understood the command sequence.
            </p>
          </>
        )}

        {variant === "numberLine" && (
          <>
            <p>
              The robot moves on a <strong>number line</strong> with <strong>forward</strong> and{" "}
              <strong>backward</strong> only (facing left or right).
              {visitSequence
                ? " Some items require visiting two objects in order."
                : " The robot must stop on the correct tick."}
            </p>
            <p>
              <strong className="inline-flex items-center gap-1 text-slate-800">
                Diagnostic score
                <DiagnosticScoreInfo variant="numberLine" />
              </strong>{" "}
              — Direction sense, step count vs shortest path, and whether each arrow moved one tick the
              right way. Pass/fail depends on stopping on the goal tick.
            </p>
          </>
        )}

        {variant === "choice" && (
          <p>
            <strong className="inline-flex items-center gap-1 text-slate-800">
              Diagnostic score
              <DiagnosticScoreInfo variant="choice" />
            </strong>{" "}
            — Share of guided blanks where the student chose the correct command. Item outcome is 100%
            only when every choice is correct.
          </p>
        )}

        {variant === "route" && (
          <>
            <p>
              Compares the student&apos;s route to the best route on the grid — position, facing,
              obstacles, and visit order when applicable.
            </p>
            <p>
              <strong className="inline-flex items-center gap-1 text-slate-800">
                Diagnostic score
                <DiagnosticScoreInfo variant="route" />
              </strong>{" "}
              — Goal completion, efficiency vs shortest route, turns, and collisions.
            </p>
          </>
        )}

        {variant === "general" && (
          <p>
            <strong className="inline-flex items-center gap-1 text-slate-800">
              Diagnostic score
              <DiagnosticScoreInfo variant="general" />
            </strong>{" "}
            — Summarizes how well the attempt matches success and how clear any mistake is for teaching.
          </p>
        )}
      </div>
    </details>
  );
}
