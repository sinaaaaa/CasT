"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  History,
  Layers,
  Mail,
  Search,
  Target,
  Trophy,
  User,
  XCircle,
} from "lucide-react";
import { AttemptStatus } from "@prisma/client";
import { PageHeader } from "@/components/assessment/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { LevelAssignmentEditorLoader } from "@/components/teacher/level-assignment-editor-loader";
import { ExcelExportButton } from "@/components/teacher/excel-export-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatDuration } from "@/lib/utils";

export type StudentProfileLevelRow = {
  levelId: string;
  name: string;
  status: AttemptStatus;
  passed: boolean;
  attempts: number;
  score: number | null;
  totalTimeSeconds: number | null;
  finalCommand: string | null;
  lastAttemptAt: string | null;
};

export type StudentProfileAttemptRow = {
  id: string;
  levelId: string;
  levelName: string;
  attemptNumber: number;
  status: AttemptStatus;
  passed: boolean;
  score: number | null;
  startedAt: string;
  totalTimeSeconds: number | null;
};

export type StudentProfileViewProps = {
  student: {
    id: string;
    displayName: string;
    email: string;
    externalId: string | null;
    classes: string[];
  };
  summary: {
    completionPercent: number;
    passed: number;
    failed: number;
    incomplete: number;
    totalLevels: number;
  };
  levels: StudentProfileLevelRow[];
  attempts: StudentProfileAttemptRow[];
};

type ProgressFilter = "all" | "passed" | "failed" | "not_started";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function StudentProfileView({
  student,
  summary,
  levels,
  attempts,
}: StudentProfileViewProps) {
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>("all");
  const [progressQuery, setProgressQuery] = useState("");
  const [historyQuery, setHistoryQuery] = useState("");

  const filteredLevels = useMemo(() => {
    const q = progressQuery.trim().toLowerCase();
    return levels.filter((l) => {
      if (progressFilter === "passed" && !l.passed) return false;
      if (progressFilter === "failed" && (l.passed || l.attempts === 0)) return false;
      if (progressFilter === "not_started" && l.attempts > 0) return false;
      if (q && !l.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [levels, progressFilter, progressQuery]);

  const filteredAttempts = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    if (!q) return attempts;
    return attempts.filter(
      (a) =>
        a.levelName.toLowerCase().includes(q) ||
        String(a.attemptNumber).includes(q)
    );
  }, [attempts, historyQuery]);

  const assignedCount = levels.filter((l) => l.attempts > 0 || l.passed).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title={student.displayName}
        description={`${student.email}${student.externalId ? ` · ID ${student.externalId}` : ""}`}
        breadcrumbs={[
          { label: "Students", href: "/teacher/students" },
          { label: student.displayName },
        ]}
        actions={
          <ExcelExportButton
            url={`/api/teacher/students/${student.id}/export`}
            label="Export report"
          />
        }
      />

      <Card className="overflow-hidden border-slate-200/80 shadow-sm">
        <div className="h-1.5 bg-gradient-to-r from-[#4F46E5] via-indigo-500 to-violet-500" />
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4F46E5] to-violet-600 text-xl font-bold text-white shadow-md shadow-indigo-200/60">
                {initials(student.displayName)}
              </div>
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-bold text-slate-900">{student.displayName}</h3>
                  <Badge variant="secondary" className="gap-1 font-normal">
                    <User className="h-3 w-3" />
                    Student
                  </Badge>
                </div>
                <p className="flex items-center gap-1.5 text-sm text-slate-600">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  {student.email}
                </p>
                {student.classes.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {student.classes.map((name) => (
                      <Badge key={name} variant="outline" className="bg-white font-normal">
                        {name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Not enrolled in a class</p>
                )}
              </div>
            </div>

            <div className="w-full max-w-xs space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4 lg:w-72">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">Overall completion</span>
                <span className="font-bold text-[#4F46E5]">{summary.completionPercent}%</span>
              </div>
              <Progress value={summary.completionPercent} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {summary.passed} of {summary.totalLevels} items passed
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Completion"
          value={`${summary.completionPercent}%`}
          subtitle={`${summary.passed} / ${summary.totalLevels} items`}
          icon={Target}
        />
        <StatCard
          title="Passed"
          value={summary.passed}
          subtitle="Items completed correctly"
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          title="Needs work"
          value={summary.failed}
          subtitle="Items with incorrect final attempt"
          icon={XCircle}
          tone="danger"
        />
        <StatCard
          title="Not started"
          value={summary.incomplete}
          subtitle="Items with no completed attempt"
          icon={Clock}
          tone="warning"
        />
      </div>

      <Tabs defaultValue="assignments" className="space-y-6">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
          <TabsTrigger value="assignments" className="gap-1.5">
            <BookOpen className="h-4 w-4" />
            Assignments
          </TabsTrigger>
          <TabsTrigger value="progress" className="gap-1.5">
            <Layers className="h-4 w-4" />
            Item progress
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
              {levels.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-4 w-4" />
            Attempt history
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
              {attempts.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="mt-0">
          <LevelAssignmentEditorLoader
            target="student"
            targetId={student.id}
            targetName={student.displayName}
          />
        </TabsContent>

        <TabsContent value="progress" className="mt-0 space-y-4">
          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-lg">Item progress</CardTitle>
                  <CardDescription>
                    Best result per item · {assignedCount} item{assignedCount === 1 ? "" : "s"} with activity
                  </CardDescription>
                </div>
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search items…"
                    value={progressQuery}
                    onChange={(e) => setProgressQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {(
                  [
                    ["all", "All"],
                    ["passed", "Passed"],
                    ["failed", "Incorrect"],
                    ["not_started", "Not started"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setProgressFilter(key)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      progressFilter === key
                        ? "border-[#4F46E5] bg-[#4F46E5]/10 text-[#4F46E5]"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {filteredLevels.length === 0 ? (
                <EmptyState
                  icon={Layers}
                  title="No items match"
                  description="Try a different filter or search term."
                />
              ) : (
                filteredLevels.map((level) => (
                  <div
                    key={level.levelId}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white p-4 transition-colors hover:border-slate-300 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/teacher/levels/${level.levelId}`}
                          className="font-semibold text-slate-900 hover:text-[#4F46E5]"
                        >
                          {level.name}
                        </Link>
                        <StatusBadge status={level.status} passed={level.passed} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {level.attempts === 0
                          ? "No attempts yet"
                          : `${level.attempts} attempt${level.attempts === 1 ? "" : "s"}`}
                        {level.lastAttemptAt &&
                          ` · Last activity ${formatRelativeTime(level.lastAttemptAt)}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <MetricPill label="Score" value={level.score != null ? `${level.score}%` : "—"} />
                      <MetricPill label="Time" value={formatDuration(level.totalTimeSeconds)} />
                      {level.finalCommand && (
                        <span className="hidden max-w-[12rem] truncate font-mono text-xs text-slate-500 lg:inline">
                          {level.finalCommand}
                        </span>
                      )}
                      <Button variant="ghost" size="sm" asChild className="shrink-0">
                        <Link href={`/teacher/levels/${level.levelId}`}>
                          Open item
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-0 space-y-4">
          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-lg">Attempt history</CardTitle>
                  <CardDescription>
                    Recent runs · open any attempt for full assessment evidence
                  </CardDescription>
                </div>
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by item or #…"
                    value={historyQuery}
                    onChange={(e) => setHistoryQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredAttempts.length === 0 ? (
                <EmptyState
                  icon={History}
                  title={attempts.length === 0 ? "No attempts yet" : "No attempts match"}
                  description={
                    attempts.length === 0
                      ? "This student has not completed any item runs."
                      : "Try a different search term."
                  }
                />
              ) : (
                <div className="divide-y rounded-xl border border-slate-200/80">
                  {filteredAttempts.map((attempt) => (
                    <div
                      key={attempt.id}
                      className="flex flex-col gap-3 bg-white p-4 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/teacher/levels/${attempt.levelId}`}
                            className="font-semibold text-slate-900 hover:text-[#4F46E5]"
                          >
                            {attempt.levelName}
                          </Link>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            Run #{attempt.attemptNumber}
                          </Badge>
                          <StatusBadge status={attempt.status} passed={attempt.passed} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(attempt.startedAt).toLocaleString()} ·{" "}
                          {formatRelativeTime(attempt.startedAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-3 text-sm">
                          <span className="inline-flex items-center gap-1 text-slate-600">
                            <Trophy className="h-3.5 w-3.5 text-amber-500" />
                            {attempt.score != null ? `${attempt.score}%` : "—"}
                          </span>
                          <span className="inline-flex items-center gap-1 text-slate-600">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDuration(attempt.totalTimeSeconds)}
                          </span>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/teacher/attempts/${attempt.id}`}>
                            View evidence
                            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center sm:text-left">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Layers;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
        <Icon className="h-6 w-6" />
      </div>
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
