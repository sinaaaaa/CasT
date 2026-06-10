"use client";

import { useState } from "react";
import { ArrowRight, Minus, RefreshCw } from "lucide-react";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CommandIconSequence } from "@/components/assessment/command-icon-sequence";
import type { NumberLineEvidence } from "@/lib/assessment/assessmentTypes";
import { numberLineMetricRows } from "@/lib/assessment/numberLineAnalysis";
import type { CommandToken } from "@/lib/command-icons";
import { COMMAND_ICON_PATHS, COMMAND_ARIA_LABELS } from "@/lib/command-icons";

const FACING_ARROW: Record<string, string> = {
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
};

function tickLabel(tick: number): string {
  return `Tick ${tick + 1}`;
}

export type NumberLineAssessmentPanelProps = {
  attemptId: string;
  evidence: NumberLineEvidence | null;
  interpretation: string;
  supported: boolean;
};

export function NumberLineAssessmentPanel({
  attemptId,
  evidence,
  interpretation,
  supported,
}: NumberLineAssessmentPanelProps) {
  const [busy, setBusy] = useState(false);

  async function reanalyze() {
    setBusy(true);
    try {
      await fetch("/api/ct/analyze-attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId }),
      });
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-lg">Number-line movement</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{interpretation}</CardContent>
      </Card>
    );
  }

  if (!evidence) {
    return (
      <Card className="border-dashed border-indigo-200">
        <CardHeader>
          <CardTitle className="text-lg">Number-line movement</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-amber-900">{interpretation}</CardContent>
      </Card>
    );
  }

  const tokens = evidence.commands.filter((c): c is CommandToken =>
    ["forward", "backward", "turn left", "turn right"].includes(c)
  );
  const metrics = numberLineMetricRows(evidence);

  return (
    <Card className="overflow-hidden border-indigo-300/60 shadow-md">
      <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-violet-50/50">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Minus className="h-5 w-5 text-indigo-700" />
              Number-line movement
            </CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              Measures tick movement along the line — not grid route efficiency or obstacles.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={reanalyze} disabled={busy}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${busy ? "animate-spin" : ""}`} />
            Re-analyze
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <p className="rounded-lg border border-indigo-200/80 bg-indigo-50 px-4 py-3 text-sm leading-relaxed text-indigo-950">
          {interpretation}
        </p>

        <NumberLineJourneyFlow evidence={evidence} commands={tokens} />

        {evidence.visitObjectSequence && evidence.visit1 && evidence.visit2 && (
          <div className="rounded-lg border border-amber-200/80 bg-amber-50/40 px-4 py-3 text-sm text-amber-950">
            <p className="text-xs font-semibold uppercase tracking-wide">Two-object visit route</p>
            <p className="mt-1">
              Robo spawn {tickLabel(evidence.startTick)} →{" "}
              <span className="font-medium capitalize">{evidence.visit1.label}</span>{" "}
              {tickLabel(evidence.visit1.tick)} →{" "}
              <span className="font-medium capitalize">{evidence.visit2.label}</span>{" "}
              {tickLabel(evidence.visit2.tick)}
            </p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((m) => (
            <div key={m.key} className="rounded-lg border bg-white p-3 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {m.label}
              </p>
              <p className="mt-1 text-2xl font-bold text-indigo-800">{m.value}%</p>
              <Progress value={m.value} className="mt-2 h-1.5" />
            </div>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <TeacherNoteCard title="Direction" text={evidence.teacherNotes.directionConfusion} />
          <TeacherNoteCard title="Counting" text={evidence.teacherNotes.countingErrors} />
          <TeacherNoteCard title="Consistency" text={evidence.teacherNotes.movementConsistency} />
          <TeacherNoteCard
            title="Orientation"
            text={evidence.teacherNotes.orientationUnderstanding}
          />
        </div>

        {evidence.movementSteps.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Step-by-step along the line
            </p>
            <ul className="space-y-2 text-sm">
              {evidence.movementSteps.map((step, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-center gap-2 rounded-lg border bg-white px-3 py-2"
                >
                  <StepCommandIcon command={step.command} />
                  <span>
                    {tickLabel(step.tickBefore)} → {tickLabel(step.tickAfter)}
                  </span>
                  {!step.correspondenceOk && (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                      arrow mismatch
                    </span>
                  )}
                  {!step.towardGoal && isMovement(step.command) && (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-900">
                      away from goal
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function isMovement(cmd: string): boolean {
  return cmd === "forward" || cmd === "backward";
}

function StepCommandIcon({ command }: { command: string }) {
  const tok = command as CommandToken;
  if (!COMMAND_ICON_PATHS[tok]) return null;
  return (
    <span
      className="inline-flex h-8 w-8 items-center justify-center rounded border bg-white"
      title={COMMAND_ARIA_LABELS[tok]}
    >
      <Image src={COMMAND_ICON_PATHS[tok]} alt="" width={22} height={22} className="object-contain" />
    </span>
  );
}

function FlowArrow() {
  return (
    <div className="flex shrink-0 items-center justify-center text-indigo-400">
      <ArrowRight className="hidden h-7 w-7 lg:block" aria-hidden />
      <ArrowRight className="h-5 w-5 rotate-90 lg:hidden" aria-hidden />
    </div>
  );
}

function NumberLineJourneyFlow({
  evidence,
  commands,
}: {
  evidence: NumberLineEvidence;
  commands: CommandToken[];
}) {
  const visitMode =
    evidence.visitObjectSequence && evidence.visit1 && evidence.visit2;

  return (
    <div className="rounded-xl border-2 border-indigo-200 bg-gradient-to-b from-white to-indigo-50/30 p-5">
      <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-center">
        <JourneyPhase
          label="START"
          tick={evidence.startTick}
          facing={evidence.startFacing}
          tone="start"
        />
        {visitMode && (
          <>
            <FlowArrow />
            <JourneyPhase
              label="VISIT 1"
              tick={evidence.visit1!.tick}
              objectLabel={evidence.visit1!.label}
              reached={evidence.visit1!.reached}
              tone="visit1"
            />
          </>
        )}
        <FlowArrow />
        <JourneyPhase label="MOVEMENT" movementOnly commands={commands} tone="movement" />
        {visitMode ? (
          <>
            <FlowArrow />
            <JourneyPhase
              label="VISIT 2"
              tick={evidence.visit2!.tick}
              facing={evidence.endFacing}
              objectLabel={evidence.visit2!.label}
              reached={evidence.visit2!.reached}
              tone="visit2"
            />
          </>
        ) : (
          <>
            <FlowArrow />
            <JourneyPhase
              label="END"
              tick={evidence.endTick}
              facing={evidence.endFacing}
              goalTick={evidence.goalTick}
              tone="end"
            />
          </>
        )}
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        {visitMode ? (
          <>
            Visit <span className="font-medium capitalize">{evidence.visit1!.label}</span> then{" "}
            <span className="font-medium capitalize">{evidence.visit2!.label}</span>
            {evidence.correctVisitOrder && evidence.visit2!.reached
              ? " · correct order"
              : !evidence.visit1!.reached
                ? " · first object missed"
                : !evidence.visit2!.reached
                  ? " · second object missed"
                  : " · order incorrect"}
            {evidence.optimalMoveCount > 0 &&
              ` · ≈ ${evidence.optimalMoveCount} move${evidence.optimalMoveCount === 1 ? "" : "s"} on line`}
          </>
        ) : (
          <>
            {evidence.goalTick != null && (
              <>
                Goal tick {evidence.goalTick + 1}
                {evidence.endTick === evidence.goalTick
                  ? " · reached"
                  : " · not reached on final run"}
              </>
            )}
            {evidence.optimalMoveCount > 0 &&
              ` · shortest path ≈ ${evidence.optimalMoveCount} move${evidence.optimalMoveCount === 1 ? "" : "s"}`}
          </>
        )}
      </p>
    </div>
  );
}

function JourneyPhase({
  label,
  tick,
  facing,
  goalTick,
  objectLabel,
  reached,
  movementOnly,
  commands,
  tone,
}: {
  label: string;
  tick?: number;
  facing?: string;
  goalTick?: number | null;
  objectLabel?: string;
  reached?: boolean;
  movementOnly?: boolean;
  commands?: CommandToken[];
  tone: "start" | "movement" | "end" | "visit1" | "visit2";
}) {
  const border =
    tone === "start"
      ? "border-lime-300 bg-lime-50/80"
      : tone === "end" || tone === "visit2"
        ? "border-violet-300 bg-violet-50/80"
        : tone === "visit1"
          ? "border-amber-300 bg-amber-50/80"
          : "border-sky-300 bg-sky-50/80";

  return (
    <div className={`min-w-0 flex-1 rounded-xl border-2 px-4 py-4 ${border}`}>
      <p className="text-xs font-bold tracking-widest text-slate-700">{label}</p>
      {movementOnly && commands ? (
        <div className="mt-3">
          {commands.length > 0 ? (
            <CommandIconSequence commands={commands} size={40} />
          ) : (
            <span className="text-sm text-muted-foreground">No moves recorded</span>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {commands.length} command{commands.length === 1 ? "" : "s"} in program
          </p>
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-2xl font-bold text-slate-900">
            {tick != null ? tickLabel(tick) : "—"}
          </p>
          {objectLabel && (
            <p className="mt-1 text-sm font-medium capitalize text-slate-800">{objectLabel}</p>
          )}
          {reached != null && (
            <p
              className={`mt-1 text-xs font-medium ${reached ? "text-emerald-700" : "text-amber-800"}`}
            >
              {reached ? "Reached" : "Not reached"}
            </p>
          )}
          {facing && (
            <p className="mt-1 text-sm text-slate-600">
              Facing {facing} {FACING_ARROW[facing] ?? ""}
            </p>
          )}
          {goalTick != null && tone === "end" && (
            <p className="mt-1 text-xs text-violet-800">Target {tickLabel(goalTick)}</p>
          )}
        </div>
      )}
    </div>
  );
}

function TeacherNoteCard({ title, text }: { title: string; text?: string }) {
  if (!text) return null;
  return (
    <div className="rounded-lg border border-indigo-100 bg-white p-3 text-sm text-slate-800">
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-800">{title}</p>
      <p className="mt-1 leading-relaxed">{text}</p>
    </div>
  );
}
