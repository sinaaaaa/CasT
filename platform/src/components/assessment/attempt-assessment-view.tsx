"use client";

import Link from "next/link";
import {
  Clock,
  Hand,
  MessageSquare,
  Target,
  Timer,
  Trophy,
  ClipboardCheck,
  Stethoscope,
  Bug,
  Crosshair,
} from "lucide-react";
import { AttemptStatus } from "@prisma/client";
import { formatItemDisplayName } from "@/lib/item-display";
import { formatDuration } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/assessment/page-header";
import { ActivityTimeline, commandTimelineItem } from "@/components/assessment/activity-timeline";
import { CommandDiffPanel } from "@/components/assessment/command-diff-panel";
import { MetricTile } from "@/components/assessment/metric-tile";
import { cn } from "@/lib/utils";
import {
  StealthAssessmentPanel,
  type StealthAssessmentPayload,
} from "@/components/assessment/stealth-assessment-panel";
import { MetricInfo } from "@/components/assessment/metric-info";
import { ScoringHelpSection } from "@/components/assessment/scoring-help-section";
import { RouteAnalysisPanel } from "@/components/assessment/route-analysis-panel";
import { numberLineDiagnosticScore } from "@/lib/assessment/numberLineAnalysis";
import type { DiagnosticScoreVariant } from "@/components/assessment/diagnostic-score-info";
import { NumberLineAssessmentPanel } from "@/components/assessment/number-line-assessment-panel";
import { PredictionAnalysisPanel } from "@/components/assessment/prediction-analysis-panel";
import { ChoiceActionAnalysisPanel } from "@/components/assessment/choice-action-analysis-panel";
import { DebuggingAnalysisPanel } from "@/components/assessment/debugging-analysis-panel";
import { PathBuildingAnalysisPanel } from "@/components/assessment/path-building-analysis-panel";
import { AttemptVerdictBanner } from "@/components/assessment/attempt-verdict-banner";
import { buildAttemptVerdict } from "@/lib/assessment/attempt-verdict";
import type { LiveRouteAnalysis } from "@/lib/assessment/compute-attempt-route";
import type { CommandToken } from "@/lib/command-icons";
import type { GridObjectMarker } from "@/lib/assessment/assessmentConfig";
export type AttemptDetailPayload = {
  id: string;
  attemptNumber: number;
  attemptRunLabel: string;
  inLevelRunNumber: number | null;
  maxLevelRuns: number | null;
  status: AttemptStatus;
  passed: boolean;
  score: number | null;
  totalTimeSeconds: number | null;
  startedAt: string;
  endedAt: string | null;
  initialCommand: string | null;
  finalCommand: string | null;
  robotTouched: boolean;
  robotTouchCount: number;
  robotTouchDurationSeconds: number | null;
  mistakes: string[];
  objectVisit?: {
    startObjectType?: string;
    endObjectType?: string;
    reachedStart: boolean;
    reachedEnd: boolean;
    visitPattern: "both" | "start_only" | "end_only" | "neither";
  } | null;
  feedback: string | null;
  student: { id: string; displayName: string; externalId: string | null };
  level: { id: string; name: string; levelKey: string; levelType?: string };
  /** Edit starter program (drag & drop yellow strip). */
  isEditStarterLevel?: boolean;
  /** Drag action blocks — path-building from scratch. */
  isPathBuildingLevel?: boolean;
  isDebuggingLevel?: boolean;
  starterProgram?: CommandToken[];
  studentProgram?: CommandToken[];
  commandEvents: { timestamp: string; command: string; action: string; sequence: number }[];
  robotTouchEvents: { timestamp: string; eventType: string; durationSeconds: number | null }[];
  assessmentResult: {
    mistakePattern: string | null;
    assessmentNotes: string | null;
  } | null;
  teacherNotes: {
    id: string;
    content: string;
    createdAt: string;
    authorName: string;
  }[];
  stealthAssessment: StealthAssessmentPayload | null;
  resetCount: number;
  firstRobotTouchAt: string | null;
  stripCloseCount: number;
  liveRoute: LiveRouteAnalysis;
  commandProgram: string | null;
  visitLabels?: string[];
  mapAnchors?: {
    routeStartPosition: { x: number; y: number };
    routeGoalPosition: { x: number; y: number };
    goalLabel: string;
    objects: GridObjectMarker[];
  } | null;
};

export function AttemptAssessmentView({ attempt }: { attempt: AttemptDetailPayload }) {
  const commandItems = attempt.commandEvents.map(commandTimelineItem);
  const touchItems = attempt.robotTouchEvents.map((e) => ({
    timestamp: e.timestamp,
    title: e.eventType.replace(/_/g, " "),
    subtitle: e.durationSeconds != null ? `Duration: ${e.durationSeconds}s` : undefined,
    tone: e.eventType.includes("START") ? ("warning" as const) : ("success" as const),
  }));

  const statusTone =
    attempt.passed || attempt.status === AttemptStatus.CORRECT
      ? "success"
      : attempt.status === AttemptStatus.INCORRECT
        ? "danger"
        : "warning";

  const visitLabels =
    attempt.visitLabels ??
    (attempt.objectVisit
      ? [
          attempt.objectVisit.startObjectType ?? "first goal",
          attempt.objectVisit.endObjectType ?? "second goal",
        ].filter(Boolean)
      : undefined);

  const isFlagLevel = attempt.level.levelType === "FLAG_PLACEMENT";
  const isFlagAssessment = Boolean(
    attempt.liveRoute.predictionResult?.available ||
      (isFlagLevel && (attempt.liveRoute.predictionResult?.misconceptionMatches?.length ?? 0) > 0)
  );
  const flagResult = attempt.liveRoute.predictionResult;
  const debugResult = attempt.liveRoute.debuggingResult;
  const pathResult = attempt.liveRoute.pathBuildingResult;
  const isNumberLineAssessment = attempt.liveRoute.taskEnvironmentType === "number-line";
  const numberLineResult = attempt.liveRoute.numberLineEvidence;
  const isPathBuildingAssessment =
    Boolean(attempt.isPathBuildingLevel) &&
    Boolean(pathResult?.available) &&
    !isNumberLineAssessment;
  const isDebuggingAssessment =
    Boolean(attempt.isDebuggingLevel) && Boolean(debugResult?.available);
  const isChoiceAssessment = Boolean(attempt.liveRoute.choiceActionResult?.available);
  const choiceResult = attempt.liveRoute.choiceActionResult;

  const scoringVariant: DiagnosticScoreVariant = isFlagAssessment
    ? "flag"
    : isPathBuildingAssessment
      ? "pathBuilding"
      : isDebuggingAssessment
        ? "debugging"
        : isNumberLineAssessment
          ? "numberLine"
          : isChoiceAssessment
            ? "choice"
            : attempt.liveRoute.routeComparison
              ? "route"
              : "general";

  const numberLineScore =
    numberLineResult != null ? numberLineDiagnosticScore(numberLineResult) : null;

  const flagStatusTone = flagResult?.isCorrect
    ? "success"
    : flagResult?.detectedMistakeType === "oneStepCountingError" ||
        flagResult?.matchQuality === "strong" ||
        flagResult?.matchQuality === "close"
      ? "warning"
      : "danger";

  const displayStatusTone = isFlagAssessment ? flagStatusTone : statusTone;

  const verdict = buildAttemptVerdict({
    goalLabel: attempt.mapAnchors?.goalLabel ?? "goal",
    prediction: flagResult,
    choice: attempt.liveRoute.choiceActionResult,
    debugging: isDebuggingAssessment ? debugResult : null,
    pathBuilding: isPathBuildingAssessment ? pathResult : null,
    numberLine: isNumberLineAssessment ? numberLineResult : null,
    fallback: {
      passed: attempt.passed,
      status: attempt.status,
      score: attempt.score,
    },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${attempt.student.displayName} — ${formatItemDisplayName(attempt.level.name)}`}
        description={attempt.level.levelKey}
        breadcrumbs={[
          { label: "Dashboard", href: "/teacher/dashboard" },
          { label: "Items", href: "/teacher/levels" },
          {
            label: formatItemDisplayName(attempt.level.name),
            href: `/teacher/levels/${attempt.level.id}`,
          },
          { label: "Attempt evidence" },
        ]}
        actions={
          <>
            <Link
              href={`/teacher/students/${attempt.student.id}`}
              className="rounded-lg border bg-card px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
            >
              Student profile
            </Link>
            <Link
              href={`/teacher/levels/${attempt.level.id}/edit`}
              className="rounded-lg border bg-card px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
            >
              Edit item
            </Link>
          </>
        }
      />

      <AttemptVerdictBanner verdict={verdict} />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {isFlagAssessment && flagResult ? (
          <span
            className={cn(
              "inline-flex items-center rounded-md px-2 py-0.5 font-medium",
              flagResult.isCorrect
                ? "bg-emerald-100 text-emerald-800"
                : "bg-red-100 text-red-800"
            )}
          >
            {flagResult.isCorrect ? "Correct placement" : "Incorrect placement"}
          </span>
        ) : isNumberLineAssessment && numberLineResult ? (
          <StatusBadge
            status={numberLineResult.passed ? AttemptStatus.CORRECT : AttemptStatus.INCORRECT}
            passed={numberLineResult.passed}
          />
        ) : (
          <StatusBadge status={attempt.status} passed={attempt.passed} />
        )}
        <span>Started {new Date(attempt.startedAt).toLocaleString()}</span>
        {attempt.endedAt && <span>· Ended {new Date(attempt.endedAt).toLocaleString()}</span>}
      </div>

      <ScoringHelpSection
        variant={scoringVariant}
        goalLabel={attempt.mapAnchors?.goalLabel ?? "goal"}
        visitSequence={Boolean(numberLineResult?.visitObjectSequence)}
      />

      {(attempt.liveRoute.predictionResult?.available ||
        (attempt.level.levelType === "FLAG_PLACEMENT" &&
          (attempt.liveRoute.predictionResult?.misconceptionMatches?.length ?? 0) > 0)) &&
      attempt.liveRoute.predictionResult ? (
        <PredictionAnalysisPanel
          result={attempt.liveRoute.predictionResult}
          startPosition={
            attempt.liveRoute.routeStartPosition ?? attempt.liveRoute.studentPath[0] ?? null
          }
        />
      ) : attempt.liveRoute.choiceActionResult?.available ? (
        <ChoiceActionAnalysisPanel result={attempt.liveRoute.choiceActionResult} />
      ) : isNumberLineAssessment ? (
        <NumberLineAssessmentPanel
          attemptId={attempt.id}
          evidence={attempt.liveRoute.numberLineEvidence}
          interpretation={attempt.liveRoute.interpretation}
          supported={attempt.liveRoute.supported}
          passed={attempt.passed}
        />
      ) : isPathBuildingAssessment && pathResult ? (
        <PathBuildingAnalysisPanel result={pathResult} />
      ) : isDebuggingAssessment && debugResult ? (
        <DebuggingAnalysisPanel result={debugResult} />
      ) : (
        <RouteAnalysisPanel
          attemptId={attempt.id}
          routeComparison={attempt.liveRoute.routeComparison}
          interpretation={attempt.liveRoute.interpretation}
          supported={attempt.liveRoute.supported || Boolean(attempt.isEditStarterLevel)}
          commandProgram={attempt.commandProgram}
          visitLabels={visitLabels}
          isDragEditLevel={attempt.isEditStarterLevel}
          starterProgram={attempt.starterProgram}
          studentProgram={attempt.studentProgram}
          starterPath={attempt.liveRoute.starterPath}
          starterPathStates={attempt.liveRoute.starterPathStates}
          studentPath={attempt.liveRoute.studentPath}
          optimalPath={attempt.liveRoute.optimalPath}
          routeStartPosition={
            attempt.mapAnchors?.routeStartPosition ?? attempt.liveRoute.routeStartPosition
          }
          routeGoalPosition={attempt.mapAnchors?.routeGoalPosition}
          routeGoalLabel={attempt.mapAnchors?.goalLabel}
          objectMarkers={attempt.mapAnchors?.objects}
        />
      )}

      {attempt.stealthAssessment &&
        !isNumberLineAssessment &&
        !attempt.liveRoute.predictionResult?.available &&
        !attempt.liveRoute.choiceActionResult?.available &&
        !attempt.liveRoute.pathBuildingResult?.available &&
        !attempt.liveRoute.debuggingResult?.available &&
        !attempt.liveRoute.routeComparison && (
          <StealthAssessmentPanel data={attempt.stealthAssessment} />
        )}

      <div
        className={cn(
          "grid gap-4",
          isFlagAssessment
            ? "sm:grid-cols-2 lg:grid-cols-4"
            : isDebuggingAssessment || isPathBuildingAssessment
              ? "sm:grid-cols-2 lg:grid-cols-4"
              : "sm:grid-cols-3"
        )}
      >
        {isDebuggingAssessment && debugResult ? (
          <>
            <MetricTile
              label="Goal stop"
              value={
                debugResult.bugFixed
                  ? "On goal"
                  : debugResult.passedThroughGoal
                    ? "Passed goal"
                    : "Not on goal"
              }
              sub="Final robot position"
              icon={Bug}
              tone={
                debugResult.bugFixed
                  ? "success"
                  : debugResult.passedThroughGoal
                    ? "warning"
                    : "danger"
              }
            />
            <MetricTile
              label="Stopped on goal"
              value={debugResult.stoppedOnGoal ? "Yes" : "No"}
              sub={
                debugResult.passedThroughGoal
                  ? "Passed through — does not count as fixed"
                  : debugResult.distanceFromGoal > 0
                    ? `${debugResult.distanceFromGoal} step(s) away`
                    : undefined
              }
              icon={Crosshair}
              tone={debugResult.stoppedOnGoal ? "success" : "danger"}
            />
            <MetricTile
              label="Program edits"
              value={debugResult.editDistance}
              sub={
                debugResult.editDistance === 0
                  ? "Same as starter"
                  : `${debugResult.commandsAdded.length + debugResult.commandsChanged.length + debugResult.commandsRemoved.length} labeled change(s)`
              }
              icon={Target}
              tone={debugResult.editDistance > 0 ? "info" : "default"}
            />
            <MetricTile
              label="Diagnostic score"
              value={`${debugResult.score}%`}
              sub={debugResult.level}
              icon={Stethoscope}
              tone={statusTone}
              info="diagnosticScoreDebugging"
            />
          </>
        ) : isFlagAssessment && flagResult ? (
          <>
            <MetricTile
              label="Item outcome"
              value={flagResult.isCorrect ? "Correct" : "Incorrect"}
              sub={
                flagResult.isCorrect
                  ? "100% — flag on simulated end cell"
                  : "0% — flag not on simulated end cell"
              }
              icon={ClipboardCheck}
              tone={flagResult.isCorrect ? "success" : "danger"}
              info="itemOutcome"
            />
            <MetricTile
              label="Diagnostic score"
              value={`${flagResult.score}%`}
              sub="Misconception match (not the game pass score)"
              icon={Stethoscope}
              info="diagnosticScoreFlag"
              tone={
                flagResult.isCorrect
                  ? "success"
                  : flagResult.detectedMistakeType === "oneStepCountingError" ||
                      flagResult.matchQuality === "strong" ||
                      flagResult.matchQuality === "close"
                    ? "warning"
                    : "info"
              }
            />
          </>
        ) : isPathBuildingAssessment && pathResult ? (
          <>
            <MetricTile
              label="Route result"
              value={pathResult.routeQuality}
              sub={pathResult.whatHappened}
              icon={Target}
              tone={
                pathResult.reachedGoal
                  ? "success"
                  : pathResult.routeQuality.includes("Partial") ||
                      pathResult.routeQuality.includes("Close")
                    ? "warning"
                    : "danger"
              }
            />
            <MetricTile
              label="Diagnostic score"
              value={`${pathResult.score}%`}
              sub={`${pathResult.commandCount} commands · shortest ${pathResult.shortestCommandCount}`}
              icon={Trophy}
              tone={statusTone}
              info="diagnosticScorePathBuilding"
            />
          </>
        ) : isNumberLineAssessment && numberLineResult ? (
          <>
            <MetricTile
              label="Goal stop"
              value={numberLineResult.passed ? "On goal tick" : "Wrong tick"}
              sub={
                numberLineResult.goalTick != null
                  ? `Ended ${numberLineResult.endTick + 1}, goal ${numberLineResult.goalTick + 1}`
                  : undefined
              }
              icon={Target}
              tone={numberLineResult.passed ? "success" : "danger"}
            />
            <MetricTile
              label="Diagnostic score"
              value={`${numberLineScore ?? attempt.score ?? "—"}${numberLineScore != null || attempt.score != null ? "%" : ""}`}
              sub={`${numberLineResult.studentMoveCount} moves · best ${numberLineResult.optimalMoveCount}`}
              icon={Stethoscope}
              tone={statusTone}
              info="diagnosticScoreNumberLine"
            />
          </>
        ) : isChoiceAssessment && choiceResult ? (
          <>
            <MetricTile
              label="Item outcome"
              value={choiceResult.isCorrect ? "Correct" : "Incorrect"}
              sub={choiceResult.isCorrect ? "All choices correct" : "Some choices wrong"}
              icon={ClipboardCheck}
              tone={choiceResult.isCorrect ? "success" : "danger"}
              info="itemOutcome"
            />
            <MetricTile
              label="Diagnostic score"
              value={`${choiceResult.score}%`}
              sub="Correct choices out of all guided blanks"
              icon={Stethoscope}
              tone={statusTone}
              info="diagnosticScoreChoice"
            />
          </>
        ) : !isDebuggingAssessment && !isPathBuildingAssessment ? (
          <MetricTile
            label="Diagnostic score"
            value={attempt.score != null ? `${attempt.score}%` : "—"}
            icon={Trophy}
            tone={statusTone}
            info={attempt.liveRoute.routeComparison ? "diagnosticScoreRoute" : "diagnosticScore"}
          />
        ) : null}
        <MetricTile label="Time on item" value={formatDuration(attempt.totalTimeSeconds)} icon={Timer} />
      </div>

      {!attempt.liveRoute.predictionResult?.available &&
        !attempt.liveRoute.choiceActionResult?.available &&
        !attempt.liveRoute.pathBuildingResult?.available &&
        !attempt.liveRoute.debuggingResult?.available &&
        !isNumberLineAssessment && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Program
            </CardTitle>
            <CardDescription>Initial vs final command sequence (icons, not text)</CardDescription>
          </CardHeader>
          <CardContent>
            <CommandDiffPanel initial={attempt.initialCommand} final={attempt.finalCommand} />
          </CardContent>
        </Card>
      )}

      <Card className={cn("shadow-sm", attempt.robotTouched && "border-amber-200/80")}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Hand className="h-4 w-4" />
            Exploration & revision
          </CardTitle>
          <CardDescription>
            {isFlagAssessment
              ? "Robot touch and reset during the attempt"
              : "Robot touch, reset, and yellow-strip edits"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "grid gap-4 sm:grid-cols-2",
              isFlagAssessment ? "lg:grid-cols-3" : "lg:grid-cols-4"
            )}
          >
            <div className="rounded-lg border bg-card p-3">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                Robot touch <MetricInfo metric="robotTouch" />
              </p>
              <p className="mt-1 text-lg font-semibold">
                {attempt.robotTouched ? "Yes" : "No"}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  ({attempt.robotTouchCount}×)
                </span>
              </p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                Reset <MetricInfo metric="resetCount" />
              </p>
              <p className="mt-1 text-lg font-semibold">{attempt.resetCount}</p>
            </div>
            {!isFlagAssessment && (
              <div className="rounded-lg border bg-card p-3">
                <p className="text-xs text-muted-foreground">Yellow strip closes</p>
                <p className="mt-1 text-lg font-semibold">{attempt.stripCloseCount}</p>
              </div>
            )}
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Touch duration</p>
              <p className="mt-1 text-lg font-semibold">
                {formatDuration(attempt.robotTouchDurationSeconds)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
          <TabsTrigger value="timeline">Activity timeline</TabsTrigger>
          <TabsTrigger value="commands">Commands ({commandItems.length})</TabsTrigger>
          <TabsTrigger value="touch">Robot touch ({touchItems.length})</TabsTrigger>
          <TabsTrigger value="notes">Teacher notes</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" />
                Activity timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTimeline
                items={[...commandItems, ...touchItems].sort(
                  (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                )}
                emptyMessage="No activity recorded for this attempt."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commands">
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <ActivityTimeline
                items={commandItems}
                variant="command"
                emptyMessage="No command edits recorded."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="touch">
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <ActivityTimeline
                items={touchItems}
                variant="touch"
                emptyMessage="No robot touch events."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">What happened</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {attempt.objectVisit && (
                  <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-3 text-sky-950">
                    <p className="font-medium">Objects visited</p>
                    <p className="mt-1">
                      {attempt.objectVisit.startObjectType}:{" "}
                      {attempt.objectVisit.reachedStart ? "yes" : "no"} ·{" "}
                      {attempt.objectVisit.endObjectType}:{" "}
                      {attempt.objectVisit.reachedEnd ? "yes" : "no"}
                    </p>
                  </div>
                )}
                {attempt.mistakes.length > 0 ? (
                  <ul className="space-y-2">
                    {attempt.mistakes.map((m) => (
                      <li
                        key={m}
                        className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-red-800"
                      >
                        {m.replace(/_/g, " ")}
                      </li>
                    ))}
                  </ul>
                ) : (
                  !attempt.objectVisit && (
                    <p className="text-muted-foreground">No mistakes tagged.</p>
                  )
                )}
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-4 w-4" />
                  Teacher notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {attempt.feedback && (
                  <div className="rounded-lg border border-sky-100 bg-sky-50 p-3">{attempt.feedback}</div>
                )}
                {attempt.teacherNotes.length > 0 ? (
                  attempt.teacherNotes.map((n) => (
                    <div key={n.id} className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">
                        {n.authorName} · {new Date(n.createdAt).toLocaleString()}
                      </p>
                      <p className="mt-2">{n.content}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">No teacher notes yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
