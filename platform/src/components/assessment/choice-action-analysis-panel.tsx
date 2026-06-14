"use client";

import { MousePointerClick, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AssessmentPanelHeader } from "@/components/assessment/assessment-panel-header";
import { DiagnosticScoreInfo } from "@/components/assessment/diagnostic-score-info";
import { PanelRecommendation } from "@/components/assessment/panel-recommendation";
import { CommandIconSequence } from "@/components/assessment/command-icon-sequence";
import type { ChoiceActionAnalysisResult } from "@/lib/assessment/choiceActionAnalysis";

export function ChoiceActionAnalysisPanel({
  result,
}: {
  result: ChoiceActionAnalysisResult;
}) {
  const hasTable =
    result.studentChoices.length > 0 || result.correctChoices.length > 0;

  return (
    <Card className="overflow-hidden border-slate-200/70 shadow-sm">
      <AssessmentPanelHeader
        icon={MousePointerClick}
        title="Choosing the correct action"
        subtitle="Each guided blank compared with the correct command."
        badges={
          <Badge
            variant={result.isCorrect ? "success" : "danger"}
            className="gap-1 text-sm"
          >
            {result.isCorrect ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <XCircle className="h-3.5 w-3.5" />
            )}
            {result.isCorrect ? "Correct" : "Incorrect"} · {result.score}%
            <DiagnosticScoreInfo variant="choice" />
          </Badge>
        }
      />

      <CardContent className="space-y-5 pt-6">
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Program shown to the student
          </p>
          <div className="mt-3">
            <CommandIconSequence commands={result.programCommands} size={36} />
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            {result.teacherExplanation}
          </p>
        </div>

        {hasTable && (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Blank</th>
                  <th className="px-4 py-2">Student chose</th>
                  <th className="px-4 py-2">Correct action</th>
                  <th className="px-4 py-2">Match</th>
                </tr>
              </thead>
              <tbody>
                {result.correctChoices.map((correct, i) => {
                  const student = result.studentChoices[i] ?? "—";
                  const ok =
                    student !== "—" &&
                    student.trim().toLowerCase() === correct.trim().toLowerCase();
                  return (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-medium">{i + 1}</td>
                      <td className="px-4 py-2 capitalize">{student}</td>
                      <td className="px-4 py-2 capitalize">{correct}</td>
                      <td className="px-4 py-2">
                        <Badge variant={ok ? "success" : "danger"}>{ok ? "Yes" : "No"}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <PanelRecommendation>{result.recommendation}</PanelRecommendation>
      </CardContent>
    </Card>
  );
}
