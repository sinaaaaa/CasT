import { getServerSession } from "next-auth";
import Link from "next/link";
import { ArrowRight, BookOpen, ClipboardCheck, Gamepad2 } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { resolveTeacherScope, classScopeWhere } from "@/lib/class-access";
import { getTeacherDashboardStats } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { formatDuration } from "@/lib/utils";
import { TeacherShell } from "@/components/teacher/teacher-shell";
import { PageHeader } from "@/components/assessment/page-header";
import { Button } from "@/components/ui/button";
import { MetricTile } from "@/components/assessment/metric-tile";
import { EduInsightCard } from "@/components/edu/edu-insight-card";
import {
  ClassSnapshotHero,
  TeacherLearningDashboard,
} from "@/components/teacher/learning-dashboard";
import { ExcelExportButton } from "@/components/teacher/excel-export-button";

export default async function TeacherDashboardPage() {
  const session = await getServerSession(authOptions);
  const scope = await resolveTeacherScope(session!.user);
  const stats = await getTeacherDashboardStats({ scopeClassIds: scope.classIds });

  const firstClass = await prisma.class.findFirst({
    where: classScopeWhere(scope),
    orderBy: { name: "asc" },
    select: { name: true },
  });

  return (
    <TeacherShell
      title="Learning Intelligence Center"
      userName={session?.user.name}
      classContext={{
        name: firstClass?.name ?? "Your classes",
        studentCount: stats.studentCount,
        activeToday: stats.classSnapshot.activeStudentsToday,
        href: "/teacher/classes",
      }}
    >
      <PageHeader
        eyebrow="Today&apos;s snapshot"
        title="Learning Intelligence Center"
        description="See what students learned, where they struggled, and what to teach next — not just raw numbers."
        actions={
          <div className="flex flex-wrap gap-2">
            <ExcelExportButton url="/api/teacher/export/analytics" label="Export insights" />
            <Button asChild variant="outline" className="rounded-xl border-indigo-200">
              <Link href="/teacher/reports">
                All attempts
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        }
      />

      <ClassSnapshotHero snapshot={stats.classSnapshot} />

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <EduInsightCard
          index={0}
          label="Students active"
          value={stats.classSnapshot.activeStudentsToday}
          explanation="Played at least one level today"
          iconName="users"
          tone="teal"
        />
        <EduInsightCard
          index={1}
          label="Average CT growth"
          value={`${stats.avgScore}%`}
          explanation="Mean score across completed attempts"
          iconName="trending-up"
          tone="success"
          trend={stats.avgScore >= 70 ? "up" : "neutral"}
        />
        <EduInsightCard
          index={2}
          label="Most common struggle"
          value={stats.classSnapshot.mostLevelFail ?? "None yet"}
          explanation="Item with the most incomplete runs"
          iconName="target"
          tone="warning"
        />
        <EduInsightCard
          index={3}
          label="Needs support"
          value={stats.classSnapshot.needsSupport}
          explanation="Students with 2+ recent misses"
          iconName="brain"
          tone={stats.classSnapshot.needsSupport > 0 ? "danger" : "default"}
          href="/teacher/students?needsHelp=1"
        />
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <MetricTile label="Total students" value={stats.studentCount} iconName="users" index={0} />
        <MetricTile
          label="Levels completed"
          value={stats.completedLevels}
          iconName="trophy"
          tone="success"
          index={1}
          sub="Passed attempts across your class"
        />
        <MetricTile
          label="Avg play time"
          value={formatDuration(stats.avgTimeSeconds)}
          iconName="clock"
          tone="info"
          index={2}
        />
      </section>

      <TeacherLearningDashboard
        charts={{
          statusCounts: stats.statusCounts,
          timeByLevel: stats.timeByLevel,
          levelDifficulty: stats.levelDifficulty,
        }}
      />

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        <Link
          href="/teacher/levels/new"
          className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4F46E5] text-white">
            <BookOpen className="h-5 w-5" />
          </span>
          <p className="mt-4 font-bold text-slate-900">Create an item</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Pick what students will do, then design the board step by step.
          </p>
          <p className="mt-3 inline-flex items-center text-sm font-semibold text-[#4F46E5]">
            New item
            <ArrowRight className="ml-1 h-4 w-4 transition group-hover:translate-x-0.5" />
          </p>
        </Link>
        <Link
          href="/teacher/classes"
          className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white">
            <ClipboardCheck className="h-5 w-5" />
          </span>
          <p className="mt-4 font-bold text-slate-900">Assign to a class</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Choose which items each class can unlock in the game.
          </p>
          <p className="mt-3 inline-flex items-center text-sm font-semibold text-teal-700">
            Classes
            <ArrowRight className="ml-1 h-4 w-4 transition group-hover:translate-x-0.5" />
          </p>
        </Link>
        <Link
          href="/teacher/reports"
          className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white">
            <Gamepad2 className="h-5 w-5" />
          </span>
          <p className="mt-4 font-bold text-slate-900">Review plays</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Open a recent run to see the robot’s path and what to coach next.
          </p>
          <p className="mt-3 inline-flex items-center text-sm font-semibold text-amber-800">
            All attempts
            <ArrowRight className="ml-1 h-4 w-4 transition group-hover:translate-x-0.5" />
          </p>
        </Link>
      </section>
    </TeacherShell>
  );
}
