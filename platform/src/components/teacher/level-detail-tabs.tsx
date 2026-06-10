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
};

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
