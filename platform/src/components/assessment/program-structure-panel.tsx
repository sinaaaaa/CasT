"use client";

import {
  ArrowDown,
  ArrowUp,
  Blocks,
  Briefcase,
  CheckCircle2,
  CircleHelp,
  CornerDownLeft,
  CornerDownRight,
  Puzzle,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AssessmentPanelHeader } from "@/components/assessment/assessment-panel-header";
import { MetricTile } from "@/components/assessment/metric-tile";
import type {
  ProgramStructureAnalysis,
  StructureBlock,
  StructureDiffOp,
} from "@/lib/assessment/programStructureAnalysis";
import { cn } from "@/lib/utils";

const MOTION_ICONS: Record<string, React.ReactNode> = {
  forward: <ArrowUp className="h-3.5 w-3.5 text-sky-600" />,
  backward: <ArrowDown className="h-3.5 w-3.5 text-indigo-600" />,
  "turn left": <CornerDownLeft className="h-3.5 w-3.5 text-amber-600" />,
  "turn right": <CornerDownRight className="h-3.5 w-3.5 text-orange-600" />,
};

export function BlockChip({ block, op }: { block: StructureBlock; op?: StructureDiffOp["op"] }) {
  const macro = block.kind === "bag" || block.kind === "chunk";
  const icon =
    block.kind === "bag" ? (
      <Briefcase className="h-3.5 w-3.5" style={{ color: block.color }} />
    ) : block.kind === "chunk" ? (
      <Puzzle className="h-3.5 w-3.5" style={{ color: block.color }} />
    ) : block.kind === "repeat-start" || block.kind === "repeat-end" ? (
      <RotateCcw className="h-3.5 w-3.5 text-purple-600" />
    ) : (
      MOTION_ICONS[block.token] ?? <CircleHelp className="h-3.5 w-3.5 text-slate-400" />
    );
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium",
        macro ? "border-2 bg-white text-slate-800" : "border-slate-200 bg-slate-50 text-slate-700",
        block.missing && "border-dashed border-red-300 text-red-700",
        op === "add" && "ring-2 ring-emerald-300",
        op === "remove" && "opacity-60 line-through ring-2 ring-rose-200"
      )}
      style={macro && !block.missing && block.color ? { borderColor: block.color } : undefined}
    >
      {op === "add" && <span className="font-bold text-emerald-600">+</span>}
      {op === "remove" && <span className="font-bold text-rose-600">−</span>}
      {icon}
      {block.label}
      {macro && block.steps > 0 && (
        <span className="text-[10px] font-normal text-slate-400">{block.steps} steps</span>
      )}
    </span>
  );
}

function BlockRow({ title, blocks, empty }: { title: string; blocks: StructureBlock[]; empty: string }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {blocks.length === 0 ? (
        <p className="text-xs text-slate-400">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {blocks.map((b, i) => (
            <BlockChip key={`${b.token}-${i}`} block={b} />
          ))}
        </div>
      )}
    </div>
  );
}

const STRATEGY_TONE: Record<string, string> = {
  unchanged: "bg-slate-50 text-slate-700 border-slate-200",
  reordered_only: "bg-sky-50 text-sky-800 border-sky-200",
  small_fix: "bg-emerald-50 text-emerald-800 border-emerald-200",
  moderate_edit: "bg-amber-50 text-amber-900 border-amber-200",
  rewrote: "bg-rose-50 text-rose-800 border-rose-200",
};

export function ProgramStructurePanel({ result }: { result: ProgramStructureAnalysis }) {
  if (!result.available) return null;

  const title = result.hasStarter
    ? result.usesMacros
      ? "Starter program & Command Bags"
      : "Starter program edits"
    : "Command Bags & Chunks";
  const subtitle = result.hasStarter
    ? "What the student kept, removed, and added compared with the starter you gave them."
    : "Which Bags and Chunks the student used to build the program.";
  const hasChanges = result.ops.some((o) => o.op !== "keep");

  return (
    <Card className="overflow-hidden border-slate-200/70 shadow-sm">
      <AssessmentPanelHeader
        icon={Blocks}
        title={title}
        subtitle={subtitle}
        badges={
          <Badge
            variant="outline"
            className={cn(
              "font-semibold",
              result.editStrategy
                ? STRATEGY_TONE[result.editStrategy]
                : "bg-violet-50 text-violet-800 border-violet-200"
            )}
          >
            {result.headline}
          </Badge>
        }
      />
      <CardContent className="space-y-6 pt-6">
        <div
          className={cn(
            "grid gap-3",
            result.hasStarter && result.usesMacros ? "sm:grid-cols-4" : "sm:grid-cols-3"
          )}
        >
          {result.hasStarter && (
            <>
              <MetricTile label="Kept" value={`${result.keptCount}/${result.starter.length}`} sub="starter blocks" />
              <MetricTile
                label="Changes"
                value={`+${result.addedCount} / −${result.removedCount}`}
                sub="added / removed"
                tone={result.starterUnchanged ? "warning" : "default"}
              />
            </>
          )}
          {result.usesMacros && (
            <MetricTile
              label="Bags / Chunks used"
              value={
                result.source === "unity"
                  ? [
                      result.bagsAvailable ? `${result.bagsUsed}/${result.bagsAvailable} bags` : null,
                      result.chunksAvailable ? `${result.chunksUsed}/${result.chunksAvailable} chunks` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"
                  : "Not recorded"
              }
              sub={
                result.macroSharePct != null
                  ? `${result.macroSharePct}% of robot moves came from Bags / Chunks`
                  : undefined
              }
              tone={result.source === "unity" && result.macroBlocksInFinal === 0 ? "warning" : "info"}
            />
          )}
          <MetricTile
            label="Final program"
            value={`${result.final.length} block${result.final.length === 1 ? "" : "s"}`}
            sub={`${result.expandedStepCount} robot move${result.expandedStepCount === 1 ? "" : "s"}${result.usedRepeat ? " · uses Repeat" : ""}`}
          />
        </div>

        {result.insights.length > 0 && (
          <section className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
            <h3 className="text-sm font-semibold text-slate-900">What this shows</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
              {result.insights.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-4 rounded-xl border border-slate-200/60 bg-white p-4">
          {result.hasStarter && (
            <BlockRow title="Starter program (given)" blocks={result.starter} empty="No starter blocks." />
          )}
          <BlockRow
            title={result.hasStarter ? "Student's final program" : "Student's program"}
            blocks={result.final}
            empty="No program recorded for this run."
          />
          {result.hasStarter && hasChanges && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Changes, in reading order
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.ops.map((o, i) => (
                  <BlockChip key={`${o.op}-${o.block.token}-${i}`} block={o.block} op={o.op} />
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                <span className="font-semibold text-emerald-600">+</span> added ·{" "}
                <span className="font-semibold text-rose-600">−</span> removed · plain = kept from the starter
              </p>
            </div>
          )}
        </section>

        {result.usesMacros && result.macroRows.length > 0 && result.source === "unity" && (
          <section className="rounded-xl border border-slate-200/60 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Bag &amp; Chunk usage</h3>
            <table className="mt-3 w-full text-left text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="pb-2 font-semibold">Block</th>
                  <th className="pb-2 font-semibold">Steps</th>
                  {result.hasStarter && <th className="pb-2 font-semibold">In starter</th>}
                  <th className="pb-2 font-semibold">In final program</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.macroRows.map((row) => (
                  <tr key={row.token} className={cn(row.inFinal === 0 && "text-slate-400")}>
                    <td className="py-1.5">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        {row.kind === "bag" ? (
                          <Briefcase className="h-3.5 w-3.5" style={{ color: row.color }} />
                        ) : (
                          <Puzzle className="h-3.5 w-3.5" style={{ color: row.color }} />
                        )}
                        {row.name}
                      </span>
                    </td>
                    <td className="py-1.5">{row.steps}</td>
                    {result.hasStarter && <td className="py-1.5">{row.inStarter || "—"}</td>}
                    <td className="py-1.5 font-semibold">{row.inFinal ? `×${row.inFinal}` : "Not used"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {result.requirements.length > 0 && (
          <section className="rounded-xl border border-slate-200/60 bg-white p-4 text-sm">
            <h3 className="font-semibold text-slate-900">Structure requirements</h3>
            <ul className="mt-2 space-y-1.5">
              {result.requirements.map((req) => (
                <li key={req.label} className="flex items-center gap-2 text-slate-700">
                  {req.met === true ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : req.met === false ? (
                    <XCircle className="h-4 w-4 text-rose-600" />
                  ) : (
                    <CircleHelp className="h-4 w-4 text-slate-400" />
                  )}
                  {req.label}
                  <span className="text-xs text-slate-400">
                    {req.met === true ? "met" : req.met === false ? "not met" : "not recorded"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
