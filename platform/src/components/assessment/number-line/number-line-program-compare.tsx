"use client";

import { useMemo } from "react";
import { AlertTriangle, GitCompareArrows } from "lucide-react";
import { ProgramDiffTrack } from "@/components/assessment/debugging/command-diff-chip";
import type { NumberLineEvidence } from "@/lib/assessment/assessmentTypes";
import {
  buildStudentProgramDisplay,
  extraCommandChipLabel,
  referenceFixSlots,
} from "@/lib/assessment/program-diff-visual";
import type { CommandToken } from "@/lib/command-icons";

function numberLineMistakeLabel(evidence: NumberLineEvidence): string | null {
  const step = evidence.firstMistakeStep;
  if (step == null) return null;
  const cmd = evidence.commands[step - 1];
  const token = cmd as CommandToken | undefined;

  if (
    evidence.goalOutcome === "overshot" &&
    token &&
    (token === "forward" || token === "backward")
  ) {
    return `${extraCommandChipLabel(token)} at Step ${step}`;
  }
  if (evidence.goalOutcome === "stopped_early") {
    return `Stopped early at Step ${step}`;
  }
  if (token && evidence.optimalCommands[step - 1] != null && token !== evidence.optimalCommands[step - 1]) {
    return `Wrong command at Step ${step}`;
  }
  if (token && (token === "forward" || token === "backward")) {
    return `${extraCommandChipLabel(token)} at Step ${step}`;
  }
  return `First mistake at Step ${step}`;
}

export function NumberLineProgramCompare({ evidence }: { evidence: NumberLineEvidence }) {
  const student = evidence.commands.filter((c): c is CommandToken =>
    ["forward", "backward"].includes(c)
  );
  const optimal = evidence.optimalCommands.filter((c): c is CommandToken =>
    ["forward", "backward"].includes(c)
  );

  const firstMistakeStep = evidence.firstMistakeStep;
  const mistakeLabel = useMemo(() => numberLineMistakeLabel(evidence), [evidence]);

  const studentDisplay = useMemo(
    () =>
      buildStudentProgramDisplay({
        student,
        reference: optimal,
        firstMistakeStep,
        softenAfterFirstMistake: true,
        issueHints: {
          stoppedEarly:
            evidence.goalOutcome === "stopped_early" && firstMistakeStep != null,
        },
      }),
    [student, optimal, firstMistakeStep, evidence.goalOutcome]
  );

  if (student.length === 0 && optimal.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GitCompareArrows className="h-4 w-4 text-sky-700" />
          <h3 className="text-sm font-semibold text-slate-900">Programs compared</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Compared to the best (shortest) route along the number line
        </p>
      </div>

      {mistakeLabel && (
        <p className="flex items-center gap-2 rounded-lg border border-amber-300/70 bg-amber-50/80 px-3 py-2 text-sm font-medium text-amber-950">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          {mistakeLabel}
        </p>
      )}

      {studentDisplay.missingSummary && evidence.goalOutcome === "stopped_early" && (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-2 text-sm text-amber-950">
          {studentDisplay.missingSummary}
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <ProgramDiffTrack
          label="Student route"
          sublabel={`${student.length} step${student.length === 1 ? "" : "s"}`}
          slots={studentDisplay.slots}
        />
        <ProgramDiffTrack
          label="Best (shortest) way"
          sublabel={`${optimal.length} step${optimal.length === 1 ? "" : "s"}`}
          slots={referenceFixSlots(optimal)}
        />
      </div>
    </section>
  );
}
