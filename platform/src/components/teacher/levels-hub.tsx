"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { LevelType } from "@prisma/client";
import { PageHeader } from "@/components/assessment/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EduLevelCard } from "@/components/edu/edu-level-card";
import { ExcelExportButton } from "@/components/teacher/excel-export-button";
import { ItemsDatasetRestore } from "@/components/teacher/items-dataset-restore";
import { cn } from "@/lib/utils";

export type LevelHubRow = {
  id: string;
  levelKey: string;
  name: string;
  orderIndex: number;
  difficulty: number;
  levelType: LevelType;
  published: boolean;
  visible: boolean;
  attemptCount: number;
  ownerTeacherId?: string | null;
  canEdit?: boolean;
  isPlatformDefault?: boolean;
};

export type IntroLevelSummary = {
  id: string;
  name: string;
  published: boolean;
  attemptCount: number;
} | null;

const WORKFLOW = [
  { step: 1, title: "Design the item", desc: "Grid, robot start, hints, and blocks" },
  { step: 2, title: "Publish", desc: "Turn the item on for students" },
  { step: 3, title: "Review attempts", desc: "See scores, commands, and evidence" },
];

export function LevelsHub({
  playableLevels,
  introLevel,
  stats,
}: {
  playableLevels: LevelHubRow[];
  introLevel: IntroLevelSummary;
  stats: { total: number; published: number; totalAttempts: number };
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");

  const filtered = useMemo(() => {
    return playableLevels.filter((l) => {
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q || l.name.toLowerCase().includes(q) || l.levelKey.toLowerCase().includes(q);
      const matchesFilter =
        filter === "all" ||
        (filter === "published" && l.published) ||
        (filter === "draft" && !l.published);
      return matchesQuery && matchesFilter;
    });
  }, [playableLevels, query, filter]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Content"
        title="Levels"
        description="Design game levels, manage the block introduction, and review how students perform."
        actions={
          <div className="flex flex-wrap gap-2">
            <ExcelExportButton url="/api/teacher/export/items" label="All items (Excel)" />
            <Button asChild>
              <Link href="/teacher/levels/new">
                <Plus className="mr-2 h-4 w-4" />
                New item
              </Link>
            </Button>
          </div>
        }
      />

      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-card to-violet-50/50">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
          {WORKFLOW.map((w) => (
            <div key={w.step} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {w.step}
              </span>
              <div>
                <p className="font-semibold">{w.title}</p>
                <p className="text-sm text-muted-foreground">{w.desc}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Playable items" value={stats.total} icon={BookOpen} />
        <StatCard title="Published" value={stats.published} icon={CheckCircle2} tone="success" />
        <StatCard title="Total attempts" value={stats.totalAttempts} icon={BarChart3} />
      </div>

      <ItemsDatasetRestore />

      <Tabs defaultValue="levels" className="space-y-6">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="levels" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Playable items
            <Badge variant="secondary" className="ml-1">
              {playableLevels.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="intro" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Introduction
          </TabsTrigger>
          <TabsTrigger value="guide" className="gap-2">
            How it works
          </TabsTrigger>
        </TabsList>

        <TabsContent value="levels" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or key…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(["all", "published", "draft"] as const).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filter === f ? "default" : "outline"}
                  onClick={() => setFilter(f)}
                >
                  {f === "all" ? "All" : f === "published" ? "Published" : "Drafts"}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white py-14 text-center text-slate-500">
                No levels match your search.
              </div>
            ) : (
              filtered.map((l, i) => (
                <EduLevelCard key={l.id} {...l} index={i} />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="intro">
          <Card className="border-violet-200 bg-gradient-to-br from-violet-50/80 to-card">
            <CardHeader>
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md">
                  <Sparkles className="h-6 w-6" />
                </span>
                <div>
                  <CardTitle>Item 0 — Block introduction</CardTitle>
                  <CardDescription className="mt-1 max-w-xl">
                    Students learn Forward, Backward, and turns <strong>once</strong> before Item 1.
                    Tip images and audio belong here—not on every item.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-4">
              {introLevel ? (
                <>
                  <Badge variant={introLevel.published ? "default" : "secondary"}>
                    {introLevel.published ? "Published" : "Draft"}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {introLevel.attemptCount} student attempts
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild className="bg-violet-600 hover:bg-violet-700">
                      <Link href="/teacher/introduction">Edit introduction</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href={`/teacher/levels/${introLevel.id}?tab=attempts`}>View attempts</Link>
                    </Button>
                  </div>
                </>
              ) : (
                <Button asChild className="bg-violet-600 hover:bg-violet-700">
                  <Link href="/teacher/introduction">Set up introduction</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guide">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Item types</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">Drag actions</strong> — students build a command
                  sequence with blocks.
                </p>
                <p>
                  <strong className="text-foreground">Place flag</strong> — students drag the robot and
                  place a goal.
                </p>
                <p>
                  <strong className="text-foreground">Choose buttons</strong> — guided choices (e.g. turn
                  left or right).
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Where to go next</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <Link href="/teacher/classes" className="font-medium text-primary hover:underline">
                    Classes
                  </Link>{" "}
                  — assign which items each class plays
                </p>
                <p>
                  Open any{" "}
                  <span className="font-medium text-foreground">student attempt</span> for automatic
                  route and program diagnosis
                </p>
                <p>
                  <Link href="/teacher/dashboard" className="font-medium text-primary hover:underline">
                    Dashboard
                  </Link>{" "}
                  — recent attempts across all items
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
