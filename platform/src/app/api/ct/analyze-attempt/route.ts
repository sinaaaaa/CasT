import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { verifyGameApiKey } from "@/lib/game-api";
import { analyzeAttemptConstructs } from "@/lib/ct/scoring";

export async function POST(request: NextRequest) {
  const teacher = await requireTeacher();
  const isGame = verifyGameApiKey(request);
  if (teacher.error && !isGame) return teacher.error;

  const body = await request.json();
  const attemptId = typeof body.attemptId === "string" ? body.attemptId : "";
  if (!attemptId) {
    return Response.json({ error: "attemptId is required" }, { status: 400 });
  }

  try {
    const result = await analyzeAttemptConstructs(attemptId);
    return Response.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Analysis failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
