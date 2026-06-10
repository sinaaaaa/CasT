import { NextRequest } from "next/server";

export function verifyGameApiKey(request: NextRequest): boolean {
  const key = process.env.GAME_API_KEY;
  if (!key) return false;
  const header = request.headers.get("x-game-api-key");
  return header === key;
}

export function gameApiUnauthorized() {
  return Response.json({ error: "Invalid or missing game API key" }, { status: 401 });
}
