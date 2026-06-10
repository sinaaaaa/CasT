"use client";

import { BookOpen, Compass, Target, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricInfo } from "@/components/assessment/metric-info";
import type { StealthAssessmentPayload } from "@/components/assessment/stealth-assessment-panel";

type ExtraMetrics = {
  resetCount?: number;
  robotTouched?: boolean;
  robotTouchCount?: number;
  wrongTurns?: number;
  collisions?: number;
  visitLabels?: string[];
};

export function TeacherAssessmentReport({
  data,
  extra,
}: {
  data: StealthAssessmentPayload;
  extra?: ExtraMetrics;
}) {
  const s = data.summary;
  const recommendations = s.recommendations ?? [];
  const interpretations = s.interpretations ?? [];
  const behaviors = s.behaviors ?? [];
  const topRecommendation = recommendations[0];

  return (
    <div className="space-y-8">
      {/* 3. What the student did */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-emerald-600" />
            What the student did
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2">
            {behaviors.map((b, i) => (
              <li key={i} className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-sm">
                {b}
              </li>
            ))}
            {extra?.resetCount != null && extra.resetCount > 0 && !behaviors.some((b) => b.includes("Reset")) && (
              <li className="rounded-lg border px-3 py-2 text-sm">
                Pressed Reset {extra.resetCount} time(s).
              </li>
            )}
          </ul>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-1 rounded-full border bg-card px-3 py-1">
              Reset: {extra?.resetCount ?? 0}
              <MetricInfo metric="resetCount" />
            </span>
            <span className="flex items-center gap-1 rounded-full border bg-card px-3 py-1">
              Robot touch: {extra?.robotTouched ? "Yes" : "No"} ({extra?.robotTouchCount ?? 0})
              <MetricInfo metric="robotTouch" />
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 4. What this means */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-violet-600" />
            What this means
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {interpretations.map((line, i) => (
              <li key={i} className="rounded-lg border border-violet-100 bg-violet-50/40 px-3 py-2 text-sm">
                {line}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* 5. Recommended next step */}
      {topRecommendation && (
        <Card className="border-indigo-200 bg-indigo-50/30 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Compass className="h-4 w-4 text-indigo-700" />
              Recommended next step
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium text-indigo-950">{topRecommendation}</p>
            {recommendations.length > 1 && (
              <ul className="mt-3 space-y-1 text-sm text-indigo-900/80">
                {recommendations.slice(1).map((r, i) => (
                  <li key={i}>• {r}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
