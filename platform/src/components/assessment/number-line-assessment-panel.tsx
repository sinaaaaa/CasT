"use client";

import type { ReactNode } from "react";
import { Minus, Stethoscope, PlayCircle, Map } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssessmentPanelHeader } from "@/components/assessment/assessment-panel-header";
import { DiagnosticScoreInfo } from "@/components/assessment/diagnostic-score-info";
import { CommandIconSequence } from "@/components/assessment/command-icon-sequence";
import { NumberLineReplay } from "@/components/assessment/number-line/number-line-replay";
import { NumberLineMap } from "@/components/assessment/number-line/number-line-map";
import { NumberLineProgramCompare } from "@/components/assessment/number-line/number-line-program-compare";
import type { NumberLineEvidence } from "@/lib/assessment/assessmentTypes";
import type { CommandToken } from "@/lib/command-icons";
import { cn } from "@/lib/utils";

function tickLabel(tick: number): string {
  return `Tick ${tick + 1}`;
}

const FACING_ARROW: Record<string, string> = {
  left: "←",
  right: "→",
  up: "↑",
  down: "↓",
};

export type NumberLineAssessmentPanelProps = {
  attemptId: string;
  evidence: NumberLineEvidence | null;
  interpretation: string;
  supported: boolean;
  passed?: boolean;
};

export function NumberLineAssessmentPanel({
  evidence,
  interpretation,
  supported,
}: NumberLineAssessmentPanelProps) {
  if (!supported) {
    return (
      <Card className="border-dashed border-slate-200 shadow-sm">
        <AssessmentPanelHeader
          icon={Minus}
          title="Moving along the number line"
          subtitle="This item type is not fully configured for assessment."
        />
        <CardContent className="pt-4 text-sm text-muted-foreground">{interpretation}</CardContent>
      </Card>
    );
  }

  if (!evidence) {
    return (
      <Card className="border-dashed border-slate-200 shadow-sm">
        <AssessmentPanelHeader
          icon={Minus}
          title="Moving along the number line"
          subtitle="Assessment data is not available for this attempt."
        />
        <CardContent className="pt-4 text-sm text-amber-900">{interpretation}</CardContent>
      </Card>
    );
  }

  const tokens = evidence.commands.filter((c): c is CommandToken =>
    ["forward", "backward"].includes(c)
  );
  const visitMode = evidence.visitObjectSequence && evidence.visit1 && evidence.visit2;

  return (
    <Card className="overflow-hidden border-slate-200/70 shadow-sm">
      <AssessmentPanelHeader
        icon={Minus}
        title="Moving along the number line"
        subtitle="Forward and backward along the line — left/right facing only."
        badges={
          <>
            <Badge variant={evidence.passed ? "success" : "danger"}>
              {evidence.passed ? "Reached goal" : "Did not reach goal"}
            </Badge>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <DiagnosticScoreInfo variant="numberLine" />
            </span>
          </>
        }
      />

      <CardContent className="space-y-6 pt-6">
        <Tabs defaultValue="what" className="w-full">
          <TabsList>
            <TabsTrigger value="what" className="gap-1.5">
              <Stethoscope className="h-4 w-4" />
              What happened
            </TabsTrigger>
            <TabsTrigger value="replay" className="gap-1.5">
              <PlayCircle className="h-4 w-4" />
              Replay
            </TabsTrigger>
            <TabsTrigger value="map" className="gap-1.5">
              <Map className="h-4 w-4" />
              Map
            </TabsTrigger>
          </TabsList>

          <TabsContent value="what" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryTile
                label="Start"
                value={tickLabel(evidence.startTick)}
                detail={`Facing ${evidence.startFacing} ${FACING_ARROW[evidence.startFacing] ?? ""}`}
              />
              <SummaryTile
                label="Program"
                value={`${tokens.length} move${tokens.length === 1 ? "" : "s"}`}
                detail={
                  tokens.length > 0 ? (
                    <CommandIconSequence commands={tokens} size={32} />
                  ) : (
                    "No forward/backward recorded"
                  )
                }
              />
              <SummaryTile
                label="End"
                value={tickLabel(evidence.endTick)}
                detail={`Facing ${evidence.endFacing} ${FACING_ARROW[evidence.endFacing] ?? ""}`}
              />
            </div>

            {visitMode && (
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 px-4 py-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/80">
                  Two-object route
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <VisitChip
                    label={evidence.visit1!.label}
                    tick={evidence.visit1!.tick}
                    reached={evidence.visit1!.reached}
                    order={1}
                  />
                  <VisitChip
                    label={evidence.visit2!.label}
                    tick={evidence.visit2!.tick}
                    reached={evidence.visit2!.reached}
                    order={2}
                  />
                </div>
                <p className="mt-2 text-xs text-amber-950/80">
                  {evidence.correctVisitOrder && evidence.visit2!.reached
                    ? "Visited both objects in the correct order."
                    : !evidence.visit1!.reached
                      ? `Did not reach ${evidence.visit1!.label} first.`
                      : !evidence.visit2!.reached
                        ? `Reached ${evidence.visit1!.label} but not ${evidence.visit2!.label}.`
                        : "Visit order was incorrect."}
                  {evidence.optimalMoveCount > 0 &&
                    ` · Shortest path ≈ ${evidence.optimalMoveCount} step${evidence.optimalMoveCount === 1 ? "" : "s"}.`}
                </p>
              </div>
            )}

            <NumberLineProgramCompare evidence={evidence} />
          </TabsContent>

          <TabsContent value="replay" className="space-y-4">
            <NumberLineReplay evidence={evidence} />
            {evidence.movementSteps.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Step-by-step diagnosis
                </p>
                <ul className="space-y-2 text-sm">
                  {evidence.movementSteps.map((step, i) => (
                    <li
                      key={i}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2"
                    >
                      <span className="font-medium capitalize">{step.command}</span>
                      <span>
                        {tickLabel(step.tickBefore)} → {tickLabel(step.tickAfter)}
                      </span>
                      {!step.correspondenceOk && (
                        <Badge variant="warning" className="text-xs">
                          Arrow mismatch
                        </Badge>
                      )}
                      {!step.towardGoal && (step.command === "forward" || step.command === "backward") && (
                        <Badge variant="danger" className="text-xs">
                          Away from target
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>

          <TabsContent value="map" className="space-y-4">
            <NumberLineMap evidence={evidence} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function SummaryTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
      <div className="mt-1 text-sm text-slate-600">{detail}</div>
    </div>
  );
}

function VisitChip({
  label,
  tick,
  reached,
  order,
}: {
  label: string;
  tick: number;
  reached: boolean;
  order: number;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2",
        reached ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white"
      )}
    >
      <p className="text-xs font-semibold text-slate-600">Object {order}</p>
      <p className="font-medium capitalize text-slate-900">{label}</p>
      <p className="text-xs text-slate-600">
        {tickLabel(tick)} · {reached ? "Reached" : "Not reached"}
      </p>
    </div>
  );
}
