"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  ChevronDown,
  Filter,
  Gamepad2,
  Map,
  Timer,
  TriangleAlert,
  Trophy,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/charts/chart-card";
import {
  LevelDifficultyChart,
  StatusPieChart,
  TimeByLevelChart,
} from "@/components/charts/dashboard-charts";
import type { LearningStoryRoutePreview } from "@/lib/analytics";
import {
  STORY_TASK_LABELS,
  type StoryOutcomeKey,
  type StoryTaskKey,
} from "@/lib/learning-story-filters";
import { GRID_COLS, GRID_ROWS } from "@/lib/level-editor-constants";
import { cn } from "@/lib/utils";

export type LearningStory = {
  id: string;
  student: string;
  level: string;
  passed: boolean;
  status: string;
  startedAt: string | Date;
  totalTimeSeconds: number | null;
  headline: string;
  difficulty: string | null;
  understood: string[];
  nextStep: string | null;
  behaviors: string[];
  routePreview: LearningStoryRoutePreview | null;
  taskKey: StoryTaskKey;
  taskLabel: string;
  outcomeKey: StoryOutcomeKey;
};

const OUTCOME_OPTIONS: { key: StoryOutcomeKey | "all"; label: string }[] = [
  { key: "all", label: "All results" },
  { key: "correct", label: "Correct" },
  { key: "incorrect", label: "Incorrect" },
  { key: "incomplete", label: "In progress" },
];

function studentsPlayedHeadline(count: number): string {
  if (count === 0) return "No students have played yet today";
  if (count === 1) return "1 student played today";
  return `${count} students played today`;
}

export type DashboardChartsData = {
  statusCounts: { correct: number; incorrect: number; incomplete: number };
  timeByLevel: { level: string; avgSeconds: number }[];
  levelDifficulty: { level: string; passRate: number; avgScore: number; difficulty: number }[];
};

export function TeacherLearningDashboard({
  charts,
}: {
  charts: DashboardChartsData;
}) {
  const pieData = [
    { name: "Correct", value: charts.statusCounts.correct },
    { name: "Incorrect", value: charts.statusCounts.incorrect },
    { name: "Incomplete", value: charts.statusCounts.incomplete },
  ];

  return (
    <ExploreChartsSection
      pieData={pieData}
      timeByLevel={charts.timeByLevel}
      levelDifficulty={charts.levelDifficulty}
    />
  );
}

export type ClassSnapshot = {
  activeStudentsToday: number;
  attemptsToday: number;
  mostLevelFail: string | null;
  needsSupport: number;
};

const NEEDS_CHECK_IN_HREF = "/teacher/students?needsHelp=1";

export function ClassSnapshotHero({ snapshot }: { snapshot: ClassSnapshot }) {
  const headline = studentsPlayedHeadline(snapshot.activeStudentsToday);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#4F46E5]/15 via-white to-[#14B8A6]/10 p-6 shadow-lg ring-1 ring-indigo-100 sm:p-8"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgb(15 23 42) 1px, transparent 0)",
          backgroundSize: "20px 20px",
        }}
      />
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-300/30 blur-2xl" />
      <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-sky-400/25 blur-2xl" />

      <div className="relative grid gap-6 lg:grid-cols-[1.35fr,0.65fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-amber-900 shadow-sm ring-1 ring-amber-200/80">
            <Gamepad2 className="h-4 w-4" />
            <p className="text-xs font-bold uppercase tracking-wide">Today in the game</p>
          </div>
          <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {snapshot.activeStudentsToday > 0 ? (
              <>
                <span className="bg-gradient-to-r from-indigo-600 to-sky-600 bg-clip-text text-transparent">
                  {snapshot.activeStudentsToday}
                </span>{" "}
                {snapshot.activeStudentsToday === 1 ? "student played" : "students played"} today
              </>
            ) : (
              headline
            )}
          </h2>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-700">
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/70 px-2.5 py-1 font-medium ring-1 ring-black/5">
              <Timer className="h-3.5 w-3.5 text-sky-600" />
              {snapshot.attemptsToday} item run{snapshot.attemptsToday === 1 ? "" : "s"} today
            </span>
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <HeroInsight
              icon={Map}
              label="Toughest item today"
              value={snapshot.mostLevelFail ?? "No item struggles yet — nice!"}
              tone="warning"
            />
            <HeroInsight
              icon={Users}
              label="Players who need help"
              value={`${snapshot.needsSupport} player${snapshot.needsSupport === 1 ? "" : "s"}`}
              tone={snapshot.needsSupport > 0 ? "danger" : "default"}
              href={NEEDS_CHECK_IN_HREF}
            />
          </div>
        </div>

        <div className="relative rounded-2xl bg-white/85 p-5 shadow-sm ring-2 ring-white/80 backdrop-blur">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Quick look</p>
          <p className="mt-2 text-sm font-medium text-slate-800">
            Open a recent play to see the robot’s run and what to coach next.
          </p>
          <Button asChild className="mt-4 w-full bg-gradient-to-r from-indigo-600 to-sky-600 shadow-md hover:from-indigo-700 hover:to-sky-700">
            <Link href="/teacher/reports">
              See all plays
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </motion.section>
  );
}

function HeroInsight({
  icon: Icon,
  label,
  value,
  tone,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "default" | "success" | "warning" | "danger";
  href?: string;
}) {
  const toneStyles: Record<typeof tone, string> = {
    default: "bg-slate-900/5 text-slate-700",
    success: "bg-teal-500/10 text-teal-800",
    warning: "bg-amber-500/12 text-amber-900",
    danger: "bg-rose-500/12 text-rose-900",
  };
  const inner = (
    <div
      className={cn(
        "rounded-2xl bg-white/55 p-4 ring-1 ring-black/5",
        href && "transition hover:bg-white/90 hover:ring-indigo-500/25"
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 rounded-xl p-2", toneStyles[tone])}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            {label}
          </p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">{value}</p>
          {href && (
            <p className="mt-1 text-xs font-semibold text-indigo-700">View players →</p>
          )}
        </div>
      </div>
    </div>
  );
  if (href) {
    return <Link href={href}>{inner}</Link>;
  }
  return inner;
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-bold ring-2 transition",
        active
          ? "bg-gradient-to-r from-indigo-600 to-sky-600 text-white ring-indigo-500/30 shadow-md"
          : "bg-white text-slate-700 ring-slate-200/80 hover:bg-amber-50 hover:ring-amber-200"
      )}
    >
      {children}
    </button>
  );
}

function StoryFiltersBar({
  taskOptions,
  taskFilter,
  outcomeFilter,
  onTaskFilter,
  onOutcomeFilter,
  filteredCount,
  totalCount,
  hasActiveFilters,
  onClear,
}: {
  taskOptions: StoryTaskKey[];
  taskFilter: StoryTaskKey | "all";
  outcomeFilter: StoryOutcomeKey | "all";
  onTaskFilter: (key: StoryTaskKey | "all") => void;
  onOutcomeFilter: (key: StoryOutcomeKey | "all") => void;
  filteredCount: number;
  totalCount: number;
  hasActiveFilters: boolean;
  onClear: () => void;
}) {
  return (
    <section className="mt-10">
      <Card className="overflow-hidden rounded-2xl border-amber-100 bg-gradient-to-br from-amber-50/40 via-white to-sky-50/30 shadow-sm ring-1 ring-amber-200/60">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded-xl bg-amber-400/25 p-2.5 text-amber-900 ring-1 ring-amber-300/50">
                <Filter className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-bold text-slate-900">Find a play</p>
                <p className="text-xs text-slate-600">
                  Choose a game task, then correct or incorrect.
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Showing {filteredCount} of {totalCount}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={onClear}
                  className="ml-2 font-semibold text-indigo-700 hover:underline"
                >
                  Clear filters
                </button>
              )}
            </p>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-amber-800/80">
                Game task
              </p>
              <div className="flex flex-wrap gap-2">
                <FilterChip active={taskFilter === "all"} onClick={() => onTaskFilter("all")}>
                  All games
                </FilterChip>
                {taskOptions.map((key) => (
                  <FilterChip
                    key={key}
                    active={taskFilter === key}
                    onClick={() => onTaskFilter(taskFilter === key ? "all" : key)}
                  >
                    {STORY_TASK_LABELS[key]}
                  </FilterChip>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-sky-800/80">
                Result
              </p>
              <div className="flex flex-wrap gap-2">
                {OUTCOME_OPTIONS.map((opt) => (
                  <FilterChip
                    key={opt.key}
                    active={outcomeFilter === opt.key}
                    onClick={() => onOutcomeFilter(opt.key)}
                  >
                    {opt.label}
                  </FilterChip>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function RouteThumbnail({ preview }: { preview: LearningStoryRoutePreview }) {
  const pathSet = new Set(preview.studentPath.map((p) => `${p.x},${p.y}`));
  const collisionSet = new Set(preview.collisionPoints.map((p) => `${p.x},${p.y}`));
  const startKey = `${preview.routeStartPosition.x},${preview.routeStartPosition.y}`;
  const goalKey = `${preview.routeGoalPosition.x},${preview.routeGoalPosition.y}`;
  const cellPx = 5;

  const tone: Record<string, string> = {
    empty: "bg-slate-100/80",
    path: "bg-sky-400/70",
    start: "bg-lime-400",
    goal: "bg-violet-500",
    collision: "bg-red-500/90",
  };

  return (
    <div
      className="shrink-0 rounded-lg border border-slate-200/70 bg-white/60 p-1 shadow-sm"
      aria-hidden
      title="Route preview"
    >
      <div
        className="grid gap-px"
        style={{ gridTemplateColumns: `repeat(${GRID_COLS}, ${cellPx}px)` }}
      >
        {Array.from({ length: GRID_ROWS }, (_, rowFromTop) => {
          const y = GRID_ROWS - 1 - rowFromTop;
          return Array.from({ length: GRID_COLS }, (_, x) => {
            const k = `${x},${y}`;
            let kind = "empty";
            if (k === startKey) kind = "start";
            else if (k === goalKey) kind = "goal";
            else if (collisionSet.has(k)) kind = "collision";
            else if (pathSet.has(k)) kind = "path";
            return (
              <div
                key={k}
                className={cn("rounded-[1px]", tone[kind])}
                style={{ width: cellPx, height: cellPx }}
              />
            );
          });
        })}
      </div>
    </div>
  );
}

function ExploreChartsSection({
  pieData,
  timeByLevel,
  levelDifficulty,
}: {
  pieData: { name: string; value: number }[];
  timeByLevel: { level: string; avgSeconds: number }[];
  levelDifficulty: { level: string; passRate: number; avgScore: number }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="mt-10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300/80 bg-slate-50/50 px-5 py-4 text-left transition hover:bg-slate-50"
      >
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-slate-900/5 p-2 text-slate-600">
            <BarChart3 className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">Item stats</p>
            <p className="text-xs text-slate-600">
              Wins, play time, and item difficulty — optional
            </p>
          </div>
        </div>
        <ChevronDown
          className={cn("h-5 w-5 shrink-0 text-slate-500 transition", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <ChartCard title="Item results" description="Beat item, didn't beat, and still playing">
            <StatusPieChart data={pieData} />
          </ChartCard>
          <ChartCard title="Time per item" description="Average seconds spent">
            <TimeByLevelChart data={timeByLevel} />
          </ChartCard>
          <ChartCard title="Difficulty analysis" description="Pass rate vs average score">
            <LevelDifficultyChart data={levelDifficulty} />
          </ChartCard>
        </div>
      )}
    </section>
  );
}

export function LearningStoryFeed({
  stories,
  hasActiveFilters,
}: {
  stories: LearningStory[];
  hasActiveFilters?: boolean;
}) {
  return (
    <section className="mt-10 space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">
            Learning stories
          </p>
          <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-900">
            Recent student thinking
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Each card explains what happened in the robot world and what to teach next.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/teacher/reports">
            View all
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {stories.length === 0 ? (
          <Card className="rounded-2xl shadow-sm ring-1 ring-black/5 lg:col-span-2">
            <CardContent className="p-8 text-center">
              <p className="text-sm font-semibold text-slate-900">
                {hasActiveFilters ? "No plays match these filters" : "No plays yet today"}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {hasActiveFilters
                  ? "Try another game task or result, or clear the filters above."
                  : "When students play items in Unity, their runs will show up here."}
              </p>
            </CardContent>
          </Card>
        ) : (
          stories.slice(0, 10).map((s) => <LearningStoryCard key={s.id} story={s} />)
        )}
      </div>
    </section>
  );
}

function playResultBadge(story: LearningStory): { label: string; className: string } {
  if (story.passed) {
    return {
      label: "Item beat!",
      className: "bg-lime-400/25 text-lime-900 ring-lime-500/40",
    };
  }
  if (story.status === "INCOMPLETE") {
    return {
      label: "Still playing",
      className: "bg-sky-400/20 text-sky-900 ring-sky-400/40",
    };
  }
  return {
    label: "Try again",
    className: "bg-amber-400/25 text-amber-950 ring-amber-500/40",
  };
}

function LearningStoryCard({ story }: { story: LearningStory }) {
  const tone = story.passed ? "success" : story.status === "INCOMPLETE" ? "default" : "warning";
  const toneStyles = {
    default: "from-sky-50/80 to-white ring-sky-200/60",
    success: "from-lime-50/90 to-white ring-lime-300/50",
    warning: "from-amber-50/90 to-white ring-amber-300/50",
  } as const;
  const badge = playResultBadge(story);

  return (
    <motion.div whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 260, damping: 22 }}>
      <Card
        className={cn(
          "rounded-2xl bg-gradient-to-br shadow-md ring-2",
          toneStyles[tone]
        )}
      >
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 gap-3">
              {story.routePreview && (
                <RouteThumbnail preview={story.routePreview} />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  <span className="text-teal-800">{story.taskLabel}</span>
                  <span className="text-slate-400"> · </span>
                  {story.level}
                </p>
                <p className="mt-2 line-clamp-2 text-base font-semibold text-slate-900">
                  {story.headline}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  <span className="font-medium text-slate-900">{story.student}</span>
                  {story.difficulty ? ` · ${story.difficulty}` : ""}
                </p>
              </div>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-bold ring-1 ring-black/5",
                tone === "success"
                  ? "bg-teal-500/10 text-teal-800"
                  : tone === "warning"
                    ? "bg-amber-500/12 text-amber-900"
                    : "bg-slate-900/5 text-slate-700"
              )}
            >
              {story.passed ? "On goal" : story.status === "INCOMPLETE" ? "In progress" : "Close"}
            </span>
          </div>

          {(story.understood.length > 0 || story.nextStep) && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {story.understood.length > 0 && (
                <div className="rounded-xl bg-white/70 p-4 ring-1 ring-black/5">
                  <p className="text-xs font-bold uppercase tracking-widest text-lime-800">
                    What they got
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {story.understood.slice(0, 2).map((t, i) => (
                      <li key={i} className="line-clamp-2">
                        • {t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {story.nextStep && (
                <div className="rounded-xl bg-white/70 p-4 ring-1 ring-black/5">
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-800">
                    Coach tip
                  </p>
                  <p className="mt-2 line-clamp-3 text-sm text-slate-700">{story.nextStep}</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {new Date(story.startedAt).toLocaleString()}
            </p>
            <Button asChild size="sm" variant="secondary" className="font-semibold">
              <Link href={`/teacher/attempts/${story.id}`}>
                Watch this play
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

