"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileEdit,
  Route,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/assessment/page-header";
import { MetricTile } from "@/components/assessment/metric-tile";
import { LevelAttemptsTable, type LevelAttemptRow } from "@/components/assessment/level-attempts-table";
import { LevelPassRateChart } from "@/components/assessment/level-pass-rate-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatItemDisplayName } from "@/lib/item-display";
import { cn } from "@/lib/utils";
import { ExcelExportButton } from "@/components/teacher/excel-export-button";

export type LevelDetailPayload = {
  id: string;
  levelKey: string;
  name: string;
  description: string | null;
  orderIndex: number;
  difficulty: number;
  levelTypeLabel: string;
  published: boolean;
  metrics: {
    attemptCount: number;
    passRate: number;
    passLabel: string;
    avgScore: number | null;
    uniqueStudents: number;
    avgTimeLabel: string;
  };
  chartData: { name: string; value: number }[];
  attempts: LevelAttemptRow[];
  /** Present only for Geometry Path items. */
  geometryMetrics?: {
    avgCompletionPct: number | null;
    avgAccuracyPct: number | null;
    attemptsWithTelemetry: number;
    pctUsingRepeat: number | null;
    pctUsingChunks: number | null;
    pctUsingBags: number | null;
  } | null;
  /** Starter edits (geometry / edit starter) and Command Bag / Chunk usage across runs. */
  programStructureMetrics?: {
    hasStarter: boolean;
    usesMacros: boolean;
    runsAnalyzed: number;
    starterRuns: number;
    pctStarterUnchanged: number | null;
    avgEdits: number | null;
    passRateUnchanged: number | null;
    passRateEdited: number | null;
    strategies: { label: string; count: number }[];
    macroRuns: number;
    pctUsingAnyMacro: number | null;
    avgMacroSharePct: number | null;
    macros: { name: string; kind: "bag" | "chunk"; color?: string; pctRuns: number; uses: number }[];
    unusedMacros: string[];
  } | null;
};

function pctLabel(v: number | null | undefined): string {
  return v != null ? `${v}%` : "—";
}

function ProgramStructureMetricsCard({
  m,
}: {
  m: NonNullable<LevelDetailPayload["programStructureMetrics"]>;
}) {
  const title = m.hasStarter
    ? m.usesMacros
      ? "Starter program & Command Bags"
      : "Starter program edits"
    : "Command Bags & Chunks";
  return (
    <Card className="shadow-sm border-indigo-100">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>
          How students changed the program across {m.runsAnalyzed} finished run
          {m.runsAnalyzed === 1 ? "" : "s"}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {m.hasStarter && (
            <>
              <MetricTile
                label="Ran starter unchanged"
                value={pctLabel(m.pctStarterUnchanged)}
                sub={`of ${m.starterRuns} run${m.starterRuns === 1 ? "" : "s"}`}
                tone={(m.pctStarterUnchanged ?? 0) >= 40 ? "warning" : "default"}
              />
              <MetricTile
                label="Avg edits per run"
                value={m.avgEdits != null ? m.avgEdits : "—"}
                sub="blocks added + removed"
              />
              <MetricTile
                label="Pass rate"
                value={pctLabel(m.passRateEdited)}
                sub={`when edited · ${pctLabel(m.passRateUnchanged)} when unchanged`}
              />
            </>
          )}
          {m.usesMacros && (
            <MetricTile
              label="Used Bags / Chunks"
              value={pctLabel(m.pctUsingAnyMacro)}
              sub={
                m.macroRuns
                  ? `${pctLabel(m.avgMacroSharePct)} of robot moves on average`
                  : "Needs the updated game build"
              }
              tone="info"
            />
          )}
        </div>

        {m.hasStarter && m.strategies.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Editing strategies</p>
            <div className="flex flex-wrap gap-2">
              {m.strategies.map((s) => (
                <Badge key={s.label} variant="outline" className="font-medium">
                  {s.label} · {s.count}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {m.usesMacros && m.macros.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Most-used Bags / Chunks
            </p>
            <div className="space-y-1.5">
              {m.macros.map((mac) => (
                <div key={`${mac.kind}-${mac.name}`} className="flex items-center gap-3 text-sm">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: mac.color ?? "#94a3b8" }}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
                    {mac.name}{" "}
                    <span className="text-xs font-normal text-slate-400">
                      {mac.kind === "bag" ? "bag" : "chunk"}
                    </span>
                  </span>
                  <span className="text-xs text-slate-500">
                    {mac.pctRuns}% of runs · {mac.uses} use{mac.uses === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {m.unusedMacros.length > 0 && (
          <p className="text-xs text-slate-500">
            Never used: {m.unusedMacros.join(", ")}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

const TAB_KEYS = ["overview", "attempts", "assessment", "design"] as const;
type TabKey = (typeof TAB_KEYS)[number];

export function LevelDetailTabs({ level }: { level: LevelDetailPayload }) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab: TabKey = TAB_KEYS.includes(tabParam as TabKey) ? (tabParam as TabKey) : "overview";
  const [tab, setTab] = useState<TabKey>(initialTab);

  useEffect(() => {
    if (tabParam && TAB_KEYS.includes(tabParam as TabKey)) {
      setTab(tabParam as TabKey);
    }
  }, [tabParam]);

  const setTabAndUrl = useCallback(
    (value: TabKey) => {
      setTab(value);
      const url = new URL(window.location.href);
      url.searchParams.set("tab", value);
      window.history.replaceState({}, "", url.toString());
    },
    []
  );

  const passTone =
    level.metrics.passRate >= 70 ? "success" : level.metrics.passRate >= 40 ? "warning" : "danger";

  return (
    <div className="space-y-6">
      <PageHeader
        title={formatItemDisplayName(level.name)}
        description={`${level.levelTypeLabel} · Item ${level.orderIndex}`}
        breadcrumbs={[
          { label: "Items", href: "/teacher/levels" },
          { label: formatItemDisplayName(level.name) },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <ExcelExportButton
              url={`/api/teacher/levels/${level.id}/export`}
              label="Item report (Excel)"
            />
            <ExcelExportButton
              url={`/api/teacher/levels/${level.id}/export/assessment`}
              label="Assessment detail (Excel)"
            />
            <Button asChild variant="outline" size="sm">
              <Link href={`/teacher/levels/${level.id}/edit`}>
                <FileEdit className="mr-2 h-4 w-4" />
                Edit item
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={level.published ? "default" : "secondary"}>
          {level.published ? "Published" : "Draft"}
        </Badge>
        <Badge variant="outline">Order {level.orderIndex}</Badge>
        {level.description && (
          <span className="text-sm text-muted-foreground">{level.description}</span>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTabAndUrl(v as TabKey)} className="space-y-6">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="attempts" className="gap-2">
            <Users className="h-4 w-4" />
            Student attempts
            <Badge variant="secondary" className="ml-0.5">
              {level.attempts.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="assessment" className="gap-2">
            <Route className="h-4 w-4" />
            Assessment
          </TabsTrigger>
          <TabsTrigger value="design" className="gap-2">
            <FileEdit className="h-4 w-4" />
            Design
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 animate-in fade-in duration-300">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile label="Attempts" value={level.metrics.attemptCount} icon={BarChart3} />
            <MetricTile
              label="Pass rate"
              value={`${level.metrics.passRate}%`}
              sub={level.metrics.passLabel}
              icon={CheckCircle2}
              tone={passTone}
            />
            <MetricTile
              label="Avg score"
              value={level.metrics.avgScore != null ? `${level.metrics.avgScore}%` : "—"}
              icon={Route}
            />
            <MetricTile
              label="Students"
              value={level.metrics.uniqueStudents}
              sub={level.metrics.avgTimeLabel}
              icon={Users}
            />
          </div>

          {level.geometryMetrics && (
            <Card className="shadow-sm border-violet-100">
              <CardHeader>
                <CardTitle className="text-base">Geometry Path metrics</CardTitle>
                <CardDescription>
                  From attempts with edge telemetry ({level.geometryMetrics.attemptsWithTelemetry} runs)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <MetricTile
                    label="Avg path completion"
                    value={
                      level.geometryMetrics.avgCompletionPct != null
                        ? `${level.geometryMetrics.avgCompletionPct}%`
                        : "—"
                    }
                  />
                  <MetricTile
                    label="Avg path accuracy"
                    value={
                      level.geometryMetrics.avgAccuracyPct != null
                        ? `${level.geometryMetrics.avgAccuracyPct}%`
                        : "—"
                    }
                  />
                  <MetricTile
                    label="Used Repeat"
                    value={
                      level.geometryMetrics.pctUsingRepeat != null
                        ? `${level.geometryMetrics.pctUsingRepeat}%`
                        : "—"
                    }
                  />
                  <MetricTile
                    label="Used Chunks"
                    value={
                      level.geometryMetrics.pctUsingChunks != null
                        ? `${level.geometryMetrics.pctUsingChunks}%`
                        : "—"
                    }
                  />
                  <MetricTile
                    label="Used Bags"
                    value={
                      level.geometryMetrics.pctUsingBags != null
                        ? `${level.geometryMetrics.pctUsingBags}%`
                        : "—"
                    }
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {level.programStructureMetrics && (
            <ProgramStructureMetricsCard m={level.programStructureMetrics} />
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">How students performed</CardTitle>
                <CardDescription>Correct, incorrect, and incomplete</CardDescription>
              </CardHeader>
              <CardContent>
                <LevelPassRateChart data={level.chartData} />
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Quick actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start" onClick={() => setTabAndUrl("attempts")}>
                  <Users className="mr-2 h-4 w-4" />
                  Review student attempts
                </Button>
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={() => setTabAndUrl("assessment")}
                >
                  <Route className="mr-2 h-4 w-4" />
                  How assessment works
                </Button>
                <Button asChild className="w-full justify-start" variant="outline">
                  <Link href={`/teacher/levels/${level.id}/edit`}>
                    <FileEdit className="mr-2 h-4 w-4" />
                    Edit item design
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="attempts" className="animate-in fade-in duration-300">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-5 w-5" />
                Student attempts
              </CardTitle>
              <CardDescription>
                Open an attempt for route diagnosis, program comparison, and teacher feedback.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LevelAttemptsTable attempts={level.attempts} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assessment" className="animate-in fade-in duration-300">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Route className="h-5 w-5 text-sky-700" />
                Automatic task assessment
              </CardTitle>
              <CardDescription>
                No manual construct weights — feedback is generated from what the robot actually did.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                After each run, the system simulates the student&apos;s program and explains mistakes
                using task-specific rules (for example: debugging repair quality, path-building route
                comparison, prediction accuracy).
              </p>
              <ul className="list-inside list-disc space-y-2">
                <li>Robot outcome (reached goal, passed goal, stopped early, hit obstacle)</li>
                <li>First incorrect command step and program comparison</li>
                <li>Teacher recommendations based on the mistake type</li>
              </ul>
              <Button asChild variant="outline">
                <Link href="/teacher/attempts">View student attempts →</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="design" className="animate-in fade-in duration-300">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Item designer</CardTitle>
              <CardDescription>
                Grid layout, robot start, hints, and guided program live in the designer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { title: "Visual grid", desc: "Place objects and set the goal cell" },
                  { title: "Robot & hints", desc: "Start position, corner tips, images/audio" },
                  { title: "Program rules", desc: "Guided actions or button choices" },
                  { title: "Assessment", desc: "Automatic from level type and simulation" },
                ].map((item) => (
                  <div
                    key={item.title}
                    className={cn(
                      "rounded-lg border bg-muted/20 p-4 transition-colors hover:bg-muted/40"
                    )}
                  >
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href={`/teacher/levels/${level.id}/edit`}>
                  <FileEdit className="mr-2 h-4 w-4" />
                  Open full designer
                </Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
