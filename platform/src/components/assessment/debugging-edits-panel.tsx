"use client";

import {
  ArrowLeftRight,
  Ban,
  Gauge,
  Plus,
  Repeat,
  Replace,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AssessmentPanelHeader } from "@/components/assessment/assessment-panel-header";
import { MetricTile } from "@/components/assessment/metric-tile";
import type { DebuggingEditAnalysis } from "@/lib/assessment/debuggingEditAnalysis";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<string, LucideIcon> = {
  add: Plus,
  remove: Trash2,
  replace: Replace,
  reorder: ArrowLeftRight,
  editRepeat: Repeat,
};

const KIND_TONE: Record<string, string> = {
  add: "bg-emerald-50 text-emerald-700 border-emerald-200",
  remove: "bg-rose-50 text-rose-700 border-rose-200",
  replace: "bg-amber-50 text-amber-800 border-amber-200",
  reorder: "bg-sky-50 text-sky-700 border-sky-200",
  editRepeat: "bg-violet-50 text-violet-700 border-violet-200",
};

const EFFICIENCY_BADGE: Record<NonNullable<DebuggingEditAnalysis["efficiency"]>, { text: string; tone: string }> = {
  minimal: { text: "Fewest edits", tone: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  near_minimal: { text: "Efficient", tone: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  extra: { text: "Extra edits", tone: "bg-amber-50 text-amber-900 border-amber-200" },
  out_of_edits: { text: "Out of edits", tone: "bg-rose-50 text-rose-800 border-rose-200" },
  no_edits: { text: "No edits", tone: "bg-slate-50 text-slate-700 border-slate-200" },
};

function BudgetBar({ used, budget }: { used: number; budget: number }) {
  const pct = Math.min(100, Math.round((used / Math.max(1, budget)) * 100));
  return (
    <div className="flex items-center gap-1" aria-label={`${used} of ${budget}`}>
      {Array.from({ length: budget }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-2 flex-1 rounded-full",
            i < used ? (pct >= 100 ? "bg-rose-400" : "bg-indigo-500") : "bg-slate-200"
          )}
        />
      ))}
    </div>
  );
}

export function DebuggingEditsPanel({ result }: { result: DebuggingEditAnalysis }) {
  if (!result.available) return null;
  const badge = result.efficiency ? EFFICIENCY_BADGE[result.efficiency] : null;
  const runs = [...new Set(result.edits.map((e) => e.run))].sort((a, b) => a - b);

  return (
    <Card className="overflow-hidden border-slate-200/70 shadow-sm">
      <AssessmentPanelHeader
        icon={Gauge}
        title="Edits & budget"
        subtitle="How the student repaired the starter under this item's debugging rules. One budget covers arrows, Repeat, Bags and Chunks."
        badges={
          badge ? (
            <Badge variant="outline" className={cn("font-semibold", badge.tone)}>
              {badge.text}
            </Badge>
          ) : undefined
        }
      />
      <CardContent className="space-y-6 pt-6">
        <p className="text-sm font-medium text-slate-800">{result.headline}</p>

        <div className="grid gap-3 sm:grid-cols-4">
          <MetricTile
            label="Edits used"
            value={result.editBudget != null ? `${result.editsUsed}/${result.editBudget}` : result.editsUsed}
            sub={result.editBudget != null ? `${result.editsLeft} left` : "No edit limit"}
            tone={result.budgetExhausted ? "warning" : "default"}
          />
          <MetricTile
            label="Runs used"
            value={result.runBudget != null ? `${result.runsUsed}/${result.runBudget}` : result.runsUsed}
            sub={result.runBudget != null ? `${result.runsLeft} left` : "Only attempts limit runs"}
            tone={result.runBudgetExhausted ? "warning" : "default"}
          />
          <MetricTile
            label="Smallest fix"
            value={result.minimalEdits != null ? `${result.minimalEdits} edit${result.minimalEdits === 1 ? "" : "s"}` : "—"}
            sub={result.minimalEdits != null ? "fewest edits that would fix the starter" : "not worked out for this item"}
            tone="info"
          />
          <MetricTile
            label="Refused by rules"
            value={result.blockedTotal}
            sub={result.blocked[0] ? result.blocked[0].label : "None"}
            tone={result.blockedTotal > 0 ? "warning" : "default"}
          />
        </div>

        {result.editBudget != null && result.editBudget <= 20 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Edit budget · {result.editsUsed} of {result.editBudget} used
            </p>
            <BudgetBar used={result.editsUsed} budget={result.editBudget} />
          </div>
        )}

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

        {result.edits.length > 0 && (
          <section className="rounded-xl border border-slate-200/60 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Edit log</h3>
            <div className="mt-3 space-y-3">
              {runs.map((run) => (
                <div key={run}>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Before run {run}
                  </p>
                  <ol className="space-y-1">
                    {result.edits
                      .filter((e) => e.run === run)
                      .map((e, i) => {
                        const Icon = KIND_ICON[e.kind] ?? Plus;
                        return (
                          <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
                            <span className="w-4 shrink-0 text-right text-[11px] font-semibold text-slate-400">
                              {i + 1}
                            </span>
                            <span
                              className={cn(
                                "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border",
                                KIND_TONE[e.kind] ?? "bg-slate-50 text-slate-600 border-slate-200"
                              )}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <span>{e.label}</span>
                          </li>
                        );
                      })}
                  </ol>
                </div>
              ))}
            </div>
          </section>
        )}

        {result.blocked.length > 0 && (
          <section className="rounded-xl border border-amber-200/70 bg-amber-50/40 p-4">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <Ban className="h-4 w-4 text-amber-600" />
              Actions the rules refused
            </h3>
            <ul className="mt-2 flex flex-wrap gap-2 text-xs">
              {result.blocked.map((b) => (
                <li key={b.reason} className="rounded-full border border-amber-200 bg-white px-2.5 py-1 font-medium text-amber-900">
                  {b.label} ×{b.count}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Rules for this item</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {result.rules.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}
