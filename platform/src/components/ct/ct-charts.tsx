"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ConstructChartRow = {
  name: string;
  slug?: string;
  score: number;
  color?: string;
};

export function CTRadarChart({ data }: { data: ConstructChartRow[] }) {
  if (data.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No CT performance data yet</p>;
  }
  const chartData = data.map((d) => ({ subject: d.name, score: d.score, fullMark: 100 }));
  return (
    <ResponsiveContainer width="100%" height={320}>
      <RadarChart data={chartData}>
        <PolarGrid />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} />
        <Radar name="Mastery" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.35} />
        <Tooltip formatter={(v) => [`${v}%`, "Score"]} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function CTBarChart({ data }: { data: ConstructChartRow[] }) {
  if (data.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No CT performance data yet</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ left: 8, right: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={70} />
        <YAxis domain={[0, 100]} />
        <Tooltip formatter={(v) => [`${v}%`, "Mastery"]} />
        <Bar dataKey="score" name="Mastery %" fill="#6366f1" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CTProgressChart({
  data,
}: {
  data: { label: string; avgScore: number }[];
}) {
  if (data.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Not enough history yet</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis domain={[0, 100]} />
        <Tooltip formatter={(v) => [`${v}%`, "Avg CT score"]} />
        <Bar dataKey="avgScore" fill="#06b6d4" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CTComparisonChart({
  students,
}: {
  students: { displayName: string; overallMastery: number }[];
}) {
  if (students.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No students</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={students} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" domain={[0, 100]} />
        <YAxis dataKey="displayName" type="category" width={100} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => [`${v}%`, "Overall CT"]} />
        <Bar dataKey="overallMastery" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
        <Legend />
      </BarChart>
    </ResponsiveContainer>
  );
}
