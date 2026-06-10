import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { requireLevelEditAccess, requireLevelReadAccess } from "@/lib/class-access";
import { prisma } from "@/lib/prisma";
import {
  applyLevelTypeDefaults,
  levelGameplayConfigSchema,
  syncNumberLineGridPositions,
  updateLevelBodySchema,
} from "@/lib/level-config";
import { LevelType } from "@prisma/client";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { error, scope } = await requireTeacher();
  if (error) return error;

  const { id } = await params;
  const level = await prisma.level.findUnique({ where: { id } });
  if (!level) return Response.json({ error: "Level not found" }, { status: 404 });

  const denied = requireLevelReadAccess(scope!, level);
  if (denied) return denied;

  return Response.json({ level });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { error, scope } = await requireTeacher();
  if (error) return error;

  const { id } = await params;

  try {
    const existing = await prisma.level.findUnique({ where: { id } });
    if (!existing) return Response.json({ error: "Level not found" }, { status: 404 });

    const denied = requireLevelEditAccess(scope!, existing);
    if (denied) return denied;

    const body = await request.json();
    const parsed = updateLevelBodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    if (data.levelKey && data.levelKey !== existing.levelKey) {
      const clash = await prisma.level.findUnique({ where: { levelKey: data.levelKey } });
      if (clash) {
        return Response.json({ error: `levelKey "${data.levelKey}" already exists` }, { status: 409 });
      }
    }

    let config = data.config;
    const levelType = (data.levelType ?? existing.levelType) as LevelType;
    if (config) {
      config = syncNumberLineGridPositions(applyLevelTypeDefaults(levelType, config));
      levelGameplayConfigSchema.parse(config);
    }

    const level = await prisma.level.update({
      where: { id },
      data: {
        ...(data.levelKey !== undefined ? { levelKey: data.levelKey } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.orderIndex !== undefined ? { orderIndex: data.orderIndex } : {}),
        ...(data.difficulty !== undefined ? { difficulty: data.difficulty } : {}),
        ...(data.levelType !== undefined ? { levelType: data.levelType } : {}),
        ...(data.published !== undefined ? { published: data.published } : {}),
        ...(config !== undefined ? { config: config as object } : {}),
      },
    });

    return Response.json({ level });
  } catch (e) {
    console.error("[teacher/levels PATCH]", e);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { error, scope } = await requireTeacher();
  if (error) return error;

  const { id } = await params;
  const existing = await prisma.level.findUnique({
    where: { id },
    include: { _count: { select: { attempts: true } } },
  });
  if (!existing) return Response.json({ error: "Level not found" }, { status: 404 });

  const denied = requireLevelEditAccess(scope!, existing);
  if (denied) return denied;

  if (existing._count.attempts > 0) {
    const level = await prisma.level.update({
      where: { id },
      data: { isArchived: true, published: false },
    });
    return Response.json({
      ok: true,
      softDeleted: true,
      message: "Level archived and unpublished. Historical reports are preserved.",
      level,
    });
  }

  await prisma.level.delete({ where: { id } });
  return Response.json({ ok: true, softDeleted: false });
}
