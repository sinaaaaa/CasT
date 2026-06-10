"use client";

import { MousePointerClick } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CommandIconSequence } from "@/components/assessment/command-icon-sequence";
import type { ChoiceActionAnalysisResult } from "@/lib/assessment/choiceActionAnalysis";

export function ChoiceActionAnalysisPanel({
  result,
}: {
  result: ChoiceActionAnalysisResult;
}) {
  const badge = result.isCorrect ? "success" : "danger";

  return (
    <Card className="overflow-hidden border-sky-300/60 shadow-md">
      <CardHeader className="border-b bg-gradient-to-r from-sky-50 to-cyan-50/50">
        <CardTitle className="flex items-center gap-2 text-xl">
          <MousePointerClick className="h-5 w-5 text-sky-700" />
          Choose the correct action
        </CardTitle>
        <CardDescription>
          Compares each guided blank to the correct command. Route efficiency is not scored.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border bg-white p-4 text-sm">
            <p className="font-medium text-muted-foreground">Program shown to student</p>
            <div className="mt-2">
              <CommandIconSequence commands={result.programCommands} size={36} />
            </div>
          </div>
          <div className="rounded-lg border bg-white p-4 text-sm space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Result:</span>
              <Badge variant={badge}>{result.isCorrect ? "Correct" : "Incorrect"}</Badge>
              <span className="text-muted-foreground">Score {result.score}%</span>
            </div>
            <p className="text-slate-700">{result.teacherExplanation}</p>
          </div>
        </div>

        {(result.studentChoices.length > 0 || result.correctChoices.length > 0) && (
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
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
                    <tr key={i} className="border-t">
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

        <p className="rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-950">
          <span className="font-medium">Next step: </span>
          {result.recommendation}
        </p>
      </CardContent>
    </Card>
  );
}
