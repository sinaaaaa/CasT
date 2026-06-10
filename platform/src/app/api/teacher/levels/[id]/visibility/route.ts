import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { requireLevelEditAccess } from "@/lib/class-access";
import { prisma } from "@/lib/prisma";
import {
  applyLevelTypeDefaults,
  levelGameplayConfigSchema,
  syncNumberLineGridPositions,
  type LevelGameplayConfig,
} from "@/lib/level-config";
import { LevelType } from "@prisma/client";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { error, scope } = await requireTeacher();
  if (error) return error;

  const { id } = await params;
  const existing = await prisma.level.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Level not found" }, { status: 404 });

  const denied = requireLevelEditAccess(scope!, existing);
  if (denied) return denied;

  const body = (await request.json()) as { visible?: boolean };
  if (typeof body.visible !== "boolean") {
    return Response.json({ error: "visible must be a boolean" }, { status: 400 });
  }

  const parsed = levelGameplayConfigSchema.safeParse(existing.config);
  const raw = (parsed.success ? parsed.data : existing.config) as LevelGameplayConfig;
  const next = syncNumberLineGridPositions(
    applyLevelTypeDefaults(existing.levelType as LevelType, { ...raw, visible: body.visible })
  );
  levelGameplayConfigSchema.parse(next);

  const level = await prisma.level.update({
    where: { id },
    data: { config: next as object },
  });

  return Response.json({ level, visible: body.visible });
}
