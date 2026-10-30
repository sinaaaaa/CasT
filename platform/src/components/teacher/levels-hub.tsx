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
import { ITEM_FAMILIES, type ItemActivityId, type ItemFamilyId } from "@/lib/item-activity";
import { FAMILY_UI } from "@/lib/item-family-ui";
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
  activityId?: ItemActivityId;
  activityTitle?: string;
  familyId?: ItemFamilyId;
};

export type IntroLevelSummary = {
  id: string;
  name: string;
  published: boolean;
  attemptCount: number;
} | null;


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
  const [family, setFamily] = useState<ItemFamilyId | "all">("all");

  const familyCounts = useMemo(() => {
    const counts: Record<ItemFamilyId, number> = { program: 0, predict: 0, shape: 0, pattern: 0 };
    for (const row of playableLevels) {
      if (row.familyId) counts[row.familyId] += 1;
    }
    return counts;
  }, [playableLevels]);

  const filtered = useMemo(() => {
    return playableLevels.filter((l) => {
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        l.name.toLowerCase().includes(q) ||
        l.levelKey.toLowerCase().includes(q) ||
        (l.activityTitle?.toLowerCase().includes(q) ?? false);
      const matchesFilter =
        filter === "all" ||
        (filter === "published" && l.published) ||
        (filter === "draft" && !l.published);
      const matchesFamily = family === "all" || l.familyId === family;
      return matchesQuery && matchesFilter && matchesFamily;
    });
  }, [playableLevels, query, filter, family]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Content"
        title="Items"
        description="Design what students will do — program, predict, trace a shape, or work a pattern — then publish and review attempts."
        actions={
          <div className="flex flex-wrap gap-2">
            <ExcelExportButton url="/api/teacher/export/items" label="All items (Excel)" />
            <Button asChild className="rounded-xl">
              <Link href="/teacher/levels/new">
                <Plus className="mr-2 h-4 w-4" />
                New item
              </Link>
            </Button>
          </div>
        }
      />

      <div className="overflow-hidden rounded-3xl border border-stone-200 bg-gradient-to-br from-[#FFF8E8] via-white to-[#F5F2EB] p-5 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0F9B8E]">How teachers work here</p>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
            Create an item around what students will do, publish it, then review how they thought — not just whether they passed.
          </p>
        </div>
        <ol className="mt-4 flex flex-wrap gap-2 sm:mt-0 sm:justify-end">
          {["1 · Design", "2 · Publish", "3 · Review"].map((label) => (
            <li
              key={label}
              className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
            >
              {label}
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Playable items" value={stats.total} icon={BookOpen} />
        <StatCard title="Published" value={stats.published} icon={CheckCircle2} tone="success" />
        <StatCard title="Total attempts" value={stats.totalAttempts} icon={BarChart3} />
      </div>

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
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative max-w-md flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, code, or activity…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-11 rounded-xl pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {(["all", "published", "draft"] as const).map((f) => (
                  <Button
                    key={f}
                    size="sm"
                    variant={filter === f ? "default" : "outline"}
                    className="rounded-full"
                    onClick={() => setFilter(f)}
                  >
                    {f === "all" ? "All" : f === "published" ? "Live" : "Drafts"}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                data-on={family === "all"}
                onClick={() => setFamily("all")}
                className={cn(
                  "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition",
                  "data-[on=true]:border-navy data-[on=true]:bg-navy data-[on=true]:text-white"
                )}
              >
                All families
              </button>
              {ITEM_FAMILIES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  data-on={family === f.id}
                  onClick={() => setFamily(f.id)}
                  className={cn(
                    "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition",
                    FAMILY_UI[f.id].filterOn
                  )}
                >
                  {f.title}
                  <span className="ml-1.5 opacity-70">{familyCounts[f.id]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.length === 0 ? (
              <div className="col-span-full rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
                <p className="text-base font-semibold text-slate-700">No items match this view</p>
                <p className="mt-1 text-sm text-slate-500">Try another family, or create a new item.</p>
                <Button asChild className="mt-4 rounded-xl">
                  <Link href="/teacher/levels/new">
                    <Plus className="mr-2 h-4 w-4" />
                    New item
                  </Link>
                </Button>
              </div>
            ) : (
              filtered.map((l, i) => <EduLevelCard key={l.id} {...l} index={i} />)
            )}
          </div>
        </TabsContent>

        <TabsContent value="intro">
          <Card className="border-stone-200 bg-gradient-to-br from-[#FFF8E8] to-card">
            <CardHeader>
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy text-white shadow-md">
                  <Sparkles className="h-6 w-6" />
                </span>
                <div>
                  <CardTitle>Item 0 — Block introduction</CardTitle>
                  <CardDescription className="mt-1 max-w-xl">
                    Students learn Forward, Backward, and turns <strong>once</strong> before Item 1.
                    Tip images and audio belong here — not on every item.
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
                    <Button asChild>
                      <Link href="/teacher/introduction">Edit introduction</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href={`/teacher/levels/${introLevel.id}?tab=attempts`}>View attempts</Link>
                    </Button>
                  </div>
                </>
              ) : (
                <Button asChild>
                  <Link href="/teacher/introduction">Set up introduction</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guide">
          <div className="grid gap-4 md:grid-cols-2">
            {ITEM_FAMILIES.map((f) => (
              <Card key={f.id} className="border-slate-200/80">
                <CardHeader>
                  <CardTitle className="text-base">{f.title}</CardTitle>
                  <CardDescription>{f.studentJob}</CardDescription>
                </CardHeader>
                <CardContent className="text-sm leading-relaxed text-slate-600">
                  {f.hint}
                </CardContent>
              </Card>
            ))}
            <Card className="md:col-span-2">
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
                  Open any <span className="font-medium text-foreground">student attempt</span> for
                  automatic route and program diagnosis
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

      <details className="rounded-2xl border border-slate-200 bg-white">
        <summary className="cursor-pointer list-none px-5 py-3 text-sm font-semibold text-slate-600 marker:content-none [&::-webkit-details-marker]:hidden">
          Advanced · backup & restore items
        </summary>
        <div className="border-t border-slate-100 px-2 pb-2">
          <ItemsDatasetRestore />
        </div>
      </details>
    </div>
  );
}
