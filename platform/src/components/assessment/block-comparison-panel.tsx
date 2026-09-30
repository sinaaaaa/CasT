"use client";

import { CheckCircle2, GitCompareArrows, Lightbulb, TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AssessmentPanelHeader } from "@/components/assessment/assessment-panel-header";
import { BlockChip } from "@/components/assessment/program-structure-panel";
import type { BlockProgramComparison, BlockStatus } from "@/lib/assessment/blockProgramComparison";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<BlockStatus, { ring: string; label: string | null; text: string }> = {
  ok: { ring: "ring-1 ring-emerald-200", label: null, text: "text-emerald-700" },
  first_mistake: { ring: "ring-2 ring-rose-400", label: "First mistake", text: "text-rose-700" },
  change: { ring: "ring-2 ring-amber-300", label: "Change", text: "text-amber-800" },
  extra: { ring: "ring-2 ring-rose-200 opacity-70", label: "Extra", text: "text-rose-700" },
  unchecked: { ring: "", label: null, text: "text-slate-500" },
};

const ROW_TONE: Record<string, string> = {
  same: "text-slate-600",
  changed: "bg-amber-50/60",
  extra: "bg-rose-50/60",
  missing: "bg-sky-50/60",
};

export function BlockComparisonPanel({ result }: { result: BlockProgramComparison }) {
  if (!result.available) return null;
  const best = result.fixes[0] ?? null;
  const badge = result.studentWorks
    ? { text: "Program works", tone: "bg-emerald-50 text-emerald-800 border-emerald-200" }
    : best
      ? {
          text: `${best.steps.length} change${best.steps.length === 1 ? "" : "s"} from working`,
          tone: best.steps.length <= 1 ? "bg-amber-50 text-amber-900 border-amber-200" : "bg-orange-50 text-orange-900 border-orange-200",
        }
      : { text: "No small fix", tone: "bg-rose-50 text-rose-800 border-rose-200" };

  return (
    <Card className="overflow-hidden border-slate-200/70 shadow-sm">
      <AssessmentPanelHeader
        icon={GitCompareArrows}
        title="Block-by-block check"
        subtitle="Replays the student's blocks (Bags, Chunks and Repeat stay whole) and finds the closest program that works."
        badges={
          <Badge variant="outline" className={cn("font-semibold", badge.tone)}>
            {badge.text}
          </Badge>
        }
      />
      <CardContent className="space-y-6 pt-6">
        <p className="text-sm text-slate-700">{result.summary}</p>

        {result.missingRequired.length > 0 && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            The item requires {result.missingRequired.join(" and ")}, which the student's program doesn't use.
          </p>
        )}

        <section className="rounded-xl border border-slate-200/60 bg-white p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Student's blocks</p>
          <div className="flex flex-wrap gap-2">
            {result.blocks.map((b) => {
              const s = STATUS_STYLE[b.status];
              return (
                <div key={b.index} className="flex flex-col items-start gap-0.5">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-semibold text-slate-400">{b.index}</span>
                    <span className={cn("rounded-lg", s.ring)}>
                      <BlockChip block={b.block} />
                    </span>
                  </div>
                  {(s.label || b.note) && (
                    <span className={cn("max-w-[11rem] pl-3 text-[10px] leading-tight", s.text)}>
                      {[s.label, b.note].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {result.firstMistakeBlock && result.firstMistakeText && (
            <p className="mt-3 text-xs text-rose-700">
              <span className="font-semibold">First mistake — block {result.firstMistakeBlock}:</span>{" "}
              {result.firstMistakeText}
            </p>
          )}
        </section>

        {result.closest && (
          <section className="space-y-4 rounded-xl border border-slate-200/60 bg-white p-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Closest working program
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.closest.map((b, i) => (
                  <BlockChip key={`${b.token}-${i}`} block={b} />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Side-by-side
              </p>
              <table className="w-full text-left text-xs">
                <thead className="text-slate-500">
                  <tr>
                    <th className="pb-2 font-semibold">#</th>
                    <th className="pb-2 font-semibold">Student</th>
                    <th className="pb-2 font-semibold">Working program</th>
                    <th className="pb-2 font-semibold">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.comparison.map((r, i) => (
                    <tr key={i} className={ROW_TONE[r.op]}>
                      <td className="py-1.5 pr-2 text-slate-400">{r.studentIndex ?? "—"}</td>
                      <td className="py-1.5 pr-2">{r.student ? <BlockChip block={r.student} /> : <span className="text-slate-400">—</span>}</td>
                      <td className="py-1.5 pr-2">{r.expected ? <BlockChip block={r.expected} /> : <span className="text-slate-400">—</span>}</td>
                      <td className="py-1.5 font-medium">
                        {r.op === "same"
                          ? "Same"
                          : r.op === "changed"
                            ? "Different block"
                            : r.op === "extra"
                              ? "Not needed"
                              : "Missing"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {result.fixes.length > 0 && (
          <section className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <Lightbulb className="h-4 w-4 text-indigo-500" />
              Suggested fix{result.fixes.length === 1 ? "" : "es"}
            </h3>
            <ol className="mt-2 space-y-2 text-sm text-slate-700">
              {result.fixes.map((f, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-semibold text-indigo-600">{i === 0 ? "Best" : `Or`}</span>
                  <span>{f.steps.join(" ")}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {result.studentWorks && (
          <p className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Every block does its job.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
