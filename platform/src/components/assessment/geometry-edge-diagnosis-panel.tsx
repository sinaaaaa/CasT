"use client";

import { CheckCircle2, Info, Shapes, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AssessmentPanelHeader } from "@/components/assessment/assessment-panel-header";
import { MetricTile } from "@/components/assessment/metric-tile";
import type { GeometryEdgeDiagnosis } from "@/lib/assessment/geometryEdgeDiagnosis";
import { cn } from "@/lib/utils";

function cellLabel(v: { x: number; y: number }) {
  return `(${v.x}, ${v.y})`;
}

export function GeometryEdgeDiagnosisPanel({ result }: { result: GeometryEdgeDiagnosis }) {
  if (!result.available) return null;
  const allMet = result.metCount === result.targetCount;

  return (
    <Card className="overflow-hidden border-slate-200/70 shadow-sm">
      <AssessmentPanelHeader
        icon={Shapes}
        title="Edge-by-edge check"
        subtitle="Replays the program on the grid, checks every edge of the shape, and explains what happened where an edge was missed."
        badges={
          <Badge
            variant="outline"
            className={cn(
              "font-semibold",
              allMet && result.succeeded
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : allMet
                  ? "bg-amber-50 text-amber-900 border-amber-200"
                  : "bg-rose-50 text-rose-800 border-rose-200"
            )}
          >
            {result.metCount}/{result.targetCount} edges met
          </Badge>
        }
      />
      <CardContent className="space-y-6 pt-6">
        <p className="text-sm text-slate-700">{result.summary}</p>

        <div className="grid gap-3 sm:grid-cols-4">
          <MetricTile
            label="Edges met"
            value={`${result.metCount}/${result.targetCount}`}
            tone={allMet ? "success" : "danger"}
          />
          <MetricTile
            label="Shape finished"
            value={result.shapeCompleteAtStep ? `Step ${result.shapeCompleteAtStep}` : "No"}
            tone={result.shapeCompleteAtStep ? "success" : "warning"}
          />
          <MetricTile
            label="Off-shape edges"
            value={String(result.extraEdges.length)}
            sub={result.retracedEdgeCount ? `${result.retracedEdgeCount} edge${result.retracedEdgeCount === 1 ? "" : "s"} traced twice` : undefined}
            tone={result.extraEdges.length ? "warning" : "default"}
          />
          <MetricTile
            label="Robot ended"
            value={result.finalCell ? cellLabel(result.finalCell) : "—"}
            sub={result.finalFacing ? `facing ${result.finalFacing}` : undefined}
          />
        </div>

        {result.telemetryMismatch && (
          <p className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            The replay of the recorded program doesn't exactly match the edges the game recorded. Met / not met
            below uses what the game recorded; the explanations come from the replay.
          </p>
        )}

        {result.issues.length > 0 && (
          <section className="rounded-xl border border-rose-100 bg-rose-50/40 p-4">
            <h3 className="text-sm font-semibold text-slate-900">What happened</h3>
            <ol className="mt-2 space-y-3">
              {result.issues.map((issue, i) => (
                <li key={i} className="text-sm text-slate-700">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("font-semibold", i === 0 ? "text-rose-700" : "text-slate-800")}>
                      {issue.title}
                    </span>
                    {issue.block != null && (
                      <Badge variant="outline" className="border-slate-200 bg-white text-[10px] font-medium text-slate-600">
                        Block {issue.block}
                        {issue.blockLabel ? ` · ${issue.blockLabel}` : ""}
                      </Badge>
                    )}
                    {issue.step != null && (
                      <Badge variant="outline" className="border-slate-200 bg-white text-[10px] font-medium text-slate-500">
                        Move {issue.step}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5">{issue.message}</p>
                  {issue.fix && <p className="mt-0.5 text-xs text-indigo-700">Fix: {issue.fix}</p>}
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="rounded-xl border border-slate-200/60 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Edges of the shape</h3>
          <table className="mt-3 w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-2 font-semibold">#</th>
                <th className="pb-2 font-semibold">Edge</th>
                <th className="pb-2 font-semibold">Met?</th>
                <th className="pb-2 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.edges.map((e, i) => (
                <tr key={e.key} className={cn(!e.met && "bg-rose-50/50")}>
                  <td className="py-1.5 pr-2 text-slate-400">{i + 1}</td>
                  <td className="py-1.5 pr-2 font-medium text-slate-700">
                    {cellLabel(e.from)} → {cellLabel(e.to)}
                  </td>
                  <td className="py-1.5 pr-2">
                    {e.met ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-rose-600" />
                    )}
                  </td>
                  <td className="py-1.5 text-slate-600">
                    {e.met
                      ? e.metAtStep
                        ? `Traced at move ${e.metAtStep}${e.metByBlock ? ` (block ${e.metByBlock})` : ""}`
                        : "Traced"
                      : e.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {result.steps.length > 0 && (
          <details className="rounded-xl border border-slate-200/60 bg-white p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-900">
              Move-by-move replay ({result.steps.length} moves)
            </summary>
            <table className="mt-3 w-full text-left text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="pb-2 font-semibold">Move</th>
                  <th className="pb-2 font-semibold">Block</th>
                  <th className="pb-2 font-semibold">Command</th>
                  <th className="pb-2 font-semibold">From → to</th>
                  <th className="pb-2 font-semibold">Facing</th>
                  <th className="pb-2 font-semibold">Edge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.steps.map((s) => (
                  <tr
                    key={s.step}
                    className={cn(s.collision ? "bg-rose-50/60" : s.onShape === false ? "bg-amber-50/60" : undefined)}
                  >
                    <td className="py-1 pr-2 text-slate-400">{s.step}</td>
                    <td className="py-1 pr-2 text-slate-600">
                      {s.block} · {s.blockLabel}
                    </td>
                    <td className="py-1 pr-2 font-medium text-slate-700">{s.command}</td>
                    <td className="py-1 pr-2 text-slate-600">
                      {cellLabel(s.from)}
                      {s.edgeKey ? ` → ${cellLabel(s.to)}` : ""}
                    </td>
                    <td className="py-1 pr-2 text-slate-600">{s.facingAfter}</td>
                    <td className="py-1">
                      {s.collision ? (
                        <span className="font-medium text-rose-700">Hit a wall</span>
                      ) : s.onShape === true ? (
                        <span className="text-emerald-700">On shape</span>
                      ) : s.onShape === false ? (
                        <span className="font-medium text-amber-800">Off shape</span>
                      ) : (
                        <span className="text-slate-400">Turn</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
