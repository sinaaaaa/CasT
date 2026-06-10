import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { gameApiUnauthorized, verifyGameApiKey } from "@/lib/game-api";
import { parseRobotTouchType, syncRobotTouchStats } from "@/lib/game-service";

export async function POST(request: NextRequest) {
  if (!verifyGameApiKey(request)) return gameApiUnauthorized();

  const body = await request.json();
  const { attemptId, eventType, timestamp, durationSeconds } = body as {
    attemptId: string;
    eventType: string;
    timestamp?: string;
    durationSeconds?: number;
  };

  if (!attemptId || !eventType) {
    return Response.json({ error: "attemptId and eventType are required" }, { status: 400 });
  }

  const event = await prisma.robotTouchEvent.create({
    data: {
      attemptId,
      eventType: parseRobotTouchType(eventType),
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      durationSeconds: durationSeconds ?? null,
    },
  });

  await syncRobotTouchStats(attemptId);

  return Response.json({ success: true, eventId: event.id });
}
