"use client";

import type { DebuggingAnalysisResult } from "@/lib/assessment/debuggingAnalysis";
import { RepairInsightCard } from "@/components/assessment/debugging/repair-insight-card";
import { buildRepairInsights } from "@/lib/assessment/program-diff-visual";

export function CompactDiagnosisPanel({ result }: { result: DebuggingAnalysisResult }) {
  const fixCommands =
    result.closestWorkingFix?.commands ??
    (result.correctProgram.length > 0 ? result.correctProgram : null);

  const divergenceStep = result.firstMistakeStep;
  const semantic = result.semanticIssue;

  const chips = buildRepairInsights({
    exactIssue: result.exactIssue,
    robotOutcome: result.robotOutcome,
    bugFixed: result.bugFixed,
    passedThroughGoal: result.passedThroughGoal,
    stoppedBeforeGoal: result.stoppedBeforeGoal,
    distanceFromGoal: result.distanceFromGoal,
    repairStatus: result.repairStatus,
    editDistance: result.editDistance,
    commandsAdded: result.commandsAdded,
    commandsChanged: result.commandsChanged,
    commandsRemoved: result.commandsRemoved,
    commandsReordered: result.commandsReordered,
    extraCommandsComparedToFix: result.extraCommandsComparedToFix,
    missingCommandsComparedToFix: result.missingCommandsComparedToFix,
    divergenceStep,
    studentProgram: result.studentProgram,
    preferredFix: fixCommands,
    semanticIssue: semantic ?? undefined,
  });

  const items = semantic
    ? [
        { label: "Main issue", value: semantic.teacherMessage || semantic.primaryIssue },
        { label: "Robot outcome", value: semantic.robotOutcomeMessage },
        ...(chips.bugLocation
          ? [{ label: "First incorrect command", value: chips.bugLocation }]
          : []),
      ]
    : [
        { label: "Issue", value: chips.issue },
        { label: "Robot result", value: chips.robotResult },
        { label: "Repair action", value: chips.repairAction },
        { label: "Difference", value: chips.difference },
        ...(chips.bugLocation
          ? [{ label: "First mistake", value: chips.bugLocation }]
          : []),
      ];

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <RepairInsightCard key={item.label} label={item.label} value={item.value} />
      ))}
    </div>
  );
}
