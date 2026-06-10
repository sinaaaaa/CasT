import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { gameApiUnauthorized, verifyGameApiKey } from "@/lib/game-api";
import { parseCommandAction, rebuildCommandHistory } from "@/lib/game-service";

export async function POST(request: NextRequest) {
  if (!verifyGameApiKey(request)) return gameApiUnauthorized();

  const body = await request.json();
  const { attemptId, command, action, timestamp, sequence } = body as {
    attemptId: string;
    command: string;
    action: string;
    timestamp?: string;
    sequence?: number;
  };

  if (!attemptId || !command || !action) {
    return Response.json({ error: "attemptId, command, and action are required" }, { status: 400 });
  }

  const count = await prisma.commandEvent.count({ where: { attemptId } });

  const event = await prisma.commandEvent.create({
    data: {
      attemptId,
      command,
      action: parseCommandAction(action),
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      sequence: sequence ?? count,
    },
  });

  await rebuildCommandHistory(attemptId);

  return Response.json({ success: true, eventId: event.id });
}
