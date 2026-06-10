import { NextRequest } from "next/server";
import { gameApiUnauthorized, verifyGameApiKey } from "@/lib/game-api";
import { incrementResetCount } from "@/lib/game-service";

export async function POST(request: NextRequest) {
  if (!verifyGameApiKey(request)) return gameApiUnauthorized();

  const body = await request.json();
  const attemptId = typeof body.attemptId === "string" ? body.attemptId : "";
  if (!attemptId) {
    return Response.json({ error: "attemptId is required" }, { status: 400 });
  }

  await incrementResetCount(attemptId);
  return Response.json({ success: true });
}
