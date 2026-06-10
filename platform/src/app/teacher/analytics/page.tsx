import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveTeacherScope } from "@/lib/class-access";
import { getTeacherDashboardStats } from "@/lib/analytics";
import { TeacherShell } from "@/components/teacher/teacher-shell";
import { PageHeader } from "@/components/assessment/page-header";
import {
  LevelDifficultyChart,
  StatusPieChart,
  TimeByLevelChart,
} from "@/components/charts/dashboard-charts";
import { ChartCard } from "@/components/charts/chart-card";
import { ExcelExportButton } from "@/components/teacher/excel-export-button";

export default async function TeacherAnalyticsPage() {
  const session = await getServerSession(authOptions);
  const scope = await resolveTeacherScope(session!.user);
  const stats = await getTeacherDashboardStats({ scopeClassIds: scope.classIds });

  const pieData = [
    { name: "Correct", value: stats.statusCounts.correct },
    { name: "Incorrect", value: stats.statusCounts.incorrect },
    { name: "Incomplete", value: stats.statusCounts.incomplete },
  ];

  return (
    <TeacherShell title="Analytics" userName={session?.user.name}>
      <PageHeader
        title="Learning analytics"
        description="Deep dive into outcomes, timing, and item difficulty."
        actions={
          <div className="flex flex-wrap gap-2">
            <ExcelExportButton url="/api/teacher/export/analytics" label="Full analytics (Excel)" />
            <ExcelExportButton
              url="/api/teacher/export/items"
              label="All items (Excel)"
            />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Outcomes" description="Correct, incorrect, and incomplete attempts">
          <StatusPieChart data={pieData} />
        </ChartCard>
        <ChartCard title="Time per item" description="Average seconds spent">
          <TimeByLevelChart data={stats.timeByLevel} />
        </ChartCard>
        <ChartCard title="Difficulty analysis" description="Pass rate vs average score">
          <LevelDifficultyChart data={stats.levelDifficulty} />
        </ChartCard>
      </div>
    </TeacherShell>
  );
}
