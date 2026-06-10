import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { gameApiUnauthorized, verifyGameApiKey } from "@/lib/game-api";
import { Prisma } from "@prisma/client";

export async function POST(request: NextRequest) {
  if (!verifyGameApiKey(request)) return gameApiUnauthorized();

  const body = await request.json();
  const { attemptId, score, feedback, mistakes, finalCommand, commandHistory } = body as {
    attemptId: string;
    score?: number;
    feedback?: string;
    mistakes?: unknown;
    finalCommand?: string;
    commandHistory?: unknown;
  };

  if (!attemptId) {
    return Response.json({ error: "attemptId is required" }, { status: 400 });
  }

  const updated = await prisma.levelAttempt.update({
    where: { id: attemptId },
    data: {
      score: score ?? undefined,
      feedback: feedback ?? undefined,
      finalCommand: finalCommand ?? undefined,
      mistakes: mistakes as Prisma.InputJsonValue | undefined,
      commandHistory: commandHistory as Prisma.InputJsonValue | undefined,
    },
  });

  return Response.json({ success: true, attempt: updated });
}
