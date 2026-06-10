import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { gameApiUnauthorized, verifyGameApiKey } from "@/lib/game-api";
import { levelGameplayConfigSchema } from "@/lib/level-config";

type RouteParams = { params: Promise<{ levelKey: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  if (!verifyGameApiKey(request)) return gameApiUnauthorized();

  const { levelKey } = await params;
  const level = await prisma.level.findFirst({
    where: { levelKey, published: true },
  });

  if (!level) {
    return Response.json({ error: `Level not found: ${levelKey}` }, { status: 404 });
  }

  const configParsed = levelGameplayConfigSchema.safeParse(level.config);
  if (!configParsed.success) {
    return Response.json({ error: "Level config invalid on server" }, { status: 500 });
  }

  return Response.json({
    levelKey: level.levelKey,
    name: level.name,
    levelType: level.levelType,
    orderIndex: level.orderIndex,
    config: configParsed.data,
  });
}
