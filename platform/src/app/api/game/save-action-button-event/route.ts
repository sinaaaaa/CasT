import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { gameApiUnauthorized, verifyGameApiKey } from "@/lib/game-api";
import { appendClosedStripButton, parseButtonEventType } from "@/lib/game-service";
import { ButtonEventType } from "@prisma/client";

export async function POST(request: NextRequest) {
  if (!verifyGameApiKey(request)) return gameApiUnauthorized();

  const body = await request.json();
  const { attemptId, buttonName, eventType, timestamp } = body as {
    attemptId: string;
    buttonName: string;
    eventType: string;
    timestamp?: string;
  };

  if (!attemptId || !buttonName || !eventType) {
    return Response.json(
      { error: "attemptId, buttonName, and eventType are required" },
      { status: 400 }
    );
  }

  const parsedType = parseButtonEventType(eventType);
  const event = await prisma.actionButtonEvent.create({
    data: {
      attemptId,
      buttonName,
      eventType: parsedType,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    },
  });

  if (parsedType === ButtonEventType.CLOSED) {
    await appendClosedStripButton(attemptId, buttonName);
  }

  return Response.json({ success: true, eventId: event.id });
}
