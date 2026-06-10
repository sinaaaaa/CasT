import { getServerSession } from "next-auth";
import Link from "next/link";
import { ArrowRight, Gamepad2 } from "lucide-react";
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

      <div className="mt-10 overflow-hidden rounded-2xl bg-gradient-to-br from-[#4F46E5]/10 via-white to-[#14B8A6]/10 p-6 shadow-sm ring-1 ring-indigo-100 sm:flex sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="rounded-2xl bg-[#4F46E5] p-3 text-white shadow-lg shadow-indigo-200">
            <Gamepad2 className="h-5 w-5" />
          </span>
          <div>
            <p className="font-bold text-slate-900">Assignment management</p>
            <p className="mt-1 text-sm text-slate-600">
              Choose which levels each student can unlock in the game.
            </p>
          </div>
        </div>
        <Button asChild className="mt-4 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] sm:mt-0">
          <Link href="/teacher/students">Manage assignments</Link>
        </Button>
      </div>
    </TeacherShell>
  );
}
