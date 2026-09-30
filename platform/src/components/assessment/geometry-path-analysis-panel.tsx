"use client";

import { Hexagon, Map, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AssessmentPanelHeader } from "@/components/assessment/assessment-panel-header";
import { MetricTile } from "@/components/assessment/metric-tile";
import { GRID_COLS, GRID_ROWS } from "@/lib/level-editor-constants";
import type { GeometryPathAnalysisResult } from "@/lib/assessment/geometryPathAnalysis";
import { cn } from "@/lib/utils";

function cellCenter(x: number, y: number) {
  return { cx: x + 0.5, cy: GRID_ROWS - 0.5 - y };
}

function facingName(v: { x: number; y: number }): string {
  if (v.y > 0) return "up";
  if (v.y < 0) return "down";
  if (v.x > 0) return "right";
  if (v.x < 0) return "left";
  return "—";
}

const STATUS_STROKE: Record<string, string> = {
  correct: "#10b981",
  missed: "#a78bfa",
  extra: "#f43f5e",
};

const COMBINED_LABEL: Record<string, string> = {
  geometry_and_destination: "Geometry + destination",
  geometry_only: "Geometry only",
  destination_only: "Destination only",
  both_incomplete: "Both incomplete",
  geometry_complete_no_destination_required: "Geometry complete",
  unknown: "Recorded",
};

export function GeometryPathAnalysisPanel({
  result,
  studentProgram,
  hideStructureRequirements = false,
  startCell = null,
}: {
  result: GeometryPathAnalysisResult;
  studentProgram?: string[];
  /** Shown with met / not-met status in the program-structure panel instead. */
  hideStructureRequirements?: boolean;
  /** Where the robot started (from the replay), drawn as a ring on the map. */
  startCell?: { x: number; y: number } | null;
}) {
  if (!result.available) return null;

  const outcomeLabel =
    result.outcome === "correct"
      ? "Correct"
      : result.outcome === "partial"
        ? "Partial"
        : result.outcome === "incorrect"
          ? "Incorrect"
          : "Recorded";

  const outcomeClass =
    result.outcome === "correct"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : result.outcome === "partial"
        ? "bg-amber-50 text-amber-900 border-amber-200"
        : result.outcome === "incorrect"
          ? "bg-rose-50 text-rose-800 border-rose-200"
          : "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <Card className="overflow-hidden border-slate-200/70 shadow-sm">
      <AssessmentPanelHeader
        icon={Hexagon}
        title="Geometry Path"
        subtitle={
          result.requiresDestination
            ? "Shape tracing and final destination — one activity."
            : "Target edges vs the path the robot traveled."
        }
        badges={
          <Badge variant="outline" className={cn("font-semibold", outcomeClass)}>
            {outcomeLabel}
          </Badge>
        }
      />
      <CardContent className="grid items-start gap-6 pt-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200/70 bg-slate-50/40 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Map className="h-4 w-4 text-slate-500" />
            Target vs student path
          </div>
          <svg
            viewBox={`0 0 ${GRID_COLS} ${GRID_ROWS}`}
            className="mx-auto aspect-square w-full max-w-sm rounded-lg border border-slate-200 bg-white"
            role="img"
            aria-label="Geometry path comparison"
          >
            {Array.from({ length: GRID_ROWS }).map((_, row) =>
              Array.from({ length: GRID_COLS }).map((__, col) => (
                <rect
                  key={`${col}-${row}`}
                  x={col}
                  y={row}
                  width={1}
                  height={1}
                  fill="transparent"
                  stroke="#e2e8f0"
                  strokeWidth={0.03}
                />
              ))
            )}
            {result.edges.map((e) => {
              const a = cellCenter(e.from.x, e.from.y);
              const b = cellCenter(e.to.x, e.to.y);
              const stroke = STATUS_STROKE[e.status] ?? "#94a3b8";
              return (
                <line
                  key={`${e.key}-${e.status}`}
                  x1={a.cx}
                  y1={a.cy}
                  x2={b.cx}
                  y2={b.cy}
                  stroke={stroke}
                  strokeWidth={e.status === "correct" ? 0.16 : 0.14}
                  strokeLinecap="round"
                  opacity={e.status === "missed" ? 0.35 : e.status === "extra" ? 0.9 : 1}
                  strokeDasharray={e.status === "missed" ? "0.16 0.12" : undefined}
                />
              );
            })}
            {result.requiredFinishCell && (
              <rect
                x={result.requiredFinishCell.x + 0.12}
                y={GRID_ROWS - 1 - result.requiredFinishCell.y + 0.12}
                width={0.76}
                height={0.76}
                rx={0.12}
                fill={
                  result.destinationReached === true
                    ? "rgba(13,148,136,0.35)"
                    : "rgba(13,148,136,0.18)"
                }
                stroke="#0d9488"
                strokeWidth={0.06}
              />
            )}
            {startCell && (
              <circle
                cx={cellCenter(startCell.x, startCell.y).cx}
                cy={cellCenter(startCell.x, startCell.y).cy}
                r={0.2}
                fill="white"
                stroke="#0f172a"
                strokeWidth={0.07}
              />
            )}
            {result.finalCell && (
              <circle
                cx={cellCenter(result.finalCell.x, result.finalCell.y).cx}
                cy={cellCenter(result.finalCell.x, result.finalCell.y).cy}
                r={0.16}
                fill="#F97316"
              />
            )}
          </svg>
          <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[11px] text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-emerald-500" /> Traced correctly
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded border border-dashed border-violet-400 bg-violet-200" /> Missed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-rose-500" /> Off the shape
            </span>
            {startCell && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border-2 border-slate-900 bg-white" /> Start
              </span>
            )}
            {result.finalCell && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> Robot ended
              </span>
            )}
            {result.requiresDestination && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3 w-3 text-teal-600" /> Destination cell
              </span>
            )}
          </div>
        </section>

        <div className="space-y-4">
          <p className="text-sm text-slate-600">{result.summary}</p>

          {result.requiresDestination && (
            <div className="rounded-xl border border-teal-100 bg-teal-50/50 px-3 py-2 text-xs font-medium text-teal-900">
              Overall: {COMBINED_LABEL[result.combinedOutcome] ?? result.combinedOutcome}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <MetricTile
              label="Edges traced"
              value={`${result.completedEdgeCount}/${result.targetEdgeCount}`}
              sub={`${result.pathCompletionPct}% of the shape`}
              tone={result.completedEdgeCount === result.targetEdgeCount ? "success" : "warning"}
            />
            <MetricTile
              label="Off-shape edges"
              value={String(result.extraEdgeCount)}
              sub={`${result.pathAccuracyPct}% of traveled edges were on the shape`}
              tone={result.extraEdgeCount > 0 ? "warning" : "default"}
            />
            {result.requiresDestination ? (
              <>
                <MetricTile
                  label="Destination"
                  value={
                    result.destinationReached === true
                      ? "Reached"
                      : result.destinationReached === false
                        ? "Missed"
                        : "—"
                  }
                  tone={result.destinationReached === true ? "success" : result.destinationReached === false ? "danger" : "default"}
                />
                <MetricTile label="After shape" value={`${result.extraMovementAfterShape} moves`} />
              </>
            ) : (
              <MetricTile
                label="Shape finished"
                value={result.shapeCompleted ? "Yes" : "No"}
                tone={result.shapeCompleted ? "success" : "warning"}
              />
            )}
            <MetricTile
              label="Robot ended"
              value={result.finalCell ? `(${result.finalCell.x}, ${result.finalCell.y})` : "—"}
              sub={result.finalFacing ? `facing ${facingName(result.finalFacing)}` : undefined}
            />
          </div>

          {!hideStructureRequirements &&
            (result.requireRepeat || result.requireActionChunk || result.requireCommandBag) && (
              <section className="rounded-xl border border-slate-200/60 bg-white p-4 text-sm">
                <h3 className="font-semibold text-slate-900">Structure requirements</h3>
                <ul className="mt-2 list-inside list-disc text-slate-600">
                  {result.requireRepeat && <li>Must use Repeat</li>}
                  {result.requireActionChunk && <li>Must use an Action Chunk</li>}
                  {result.requireCommandBag && <li>Must use a Command Bag</li>}
                </ul>
              </section>
            )}

          {studentProgram && studentProgram.length > 0 && (
            <section className="rounded-xl border border-slate-200/60 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">Student program</h3>
              <p className="mt-2 break-words font-mono text-xs text-slate-700">
                {studentProgram.join(" → ")}
              </p>
            </section>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
