import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { getScopedAttemptCountsByLevel } from "@/lib/class-access";
import { fetchTeacherVisibleLevels } from "@/lib/level-customization";
import { resolveAssignedByTeacherId } from "@/lib/level-student-assignments";
import { prisma } from "@/lib/prisma";
import {
  applyLevelTypeDefaults,
  createLevelBodySchema,
  levelGameplayConfigSchema,
  syncNumberLineGridPositions,
} from "@/lib/level-config";

export async function GET() {
  const { error, scope } = await requireTeacher();
  if (error) return error;

  const [levels, attemptCounts] = await Promise.all([
    fetchTeacherVisibleLevels(scope!),
    getScopedAttemptCountsByLevel(scope!),
  ]);

  return Response.json({
    levels: levels.map((l) => ({
      id: l.id,
      levelKey: l.levelKey,
      name: l.name,
      description: l.description,
      orderIndex: l.orderIndex,
      difficulty: l.difficulty,
      levelType: l.levelType,
      published: l.published,
      ownerTeacherId: l.ownerTeacherId,
      attemptCount: attemptCounts.get(l.id) ?? 0,
      updatedAt: l.updatedAt,
    })),
  });
}

export async function POST(request: NextRequest) {
  const { error, session, scope } = await requireTeacher();
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = createLevelBodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const config = syncNumberLineGridPositions(applyLevelTypeDefaults(data.levelType, data.config));
    levelGameplayConfigSchema.parse(config);

    const existing = await prisma.level.findUnique({ where: { levelKey: data.levelKey } });
    if (existing) {
      return Response.json({ error: `levelKey "${data.levelKey}" already exists` }, { status: 409 });
    }

    const ownerTeacherId =
      scope!.isAdmin
        ? null
        : await resolveAssignedByTeacherId(session!.user.id, session!.user.teacherProfileId);

    const level = await prisma.level.create({
      data: {
        levelKey: data.levelKey,
        name: data.name,
        description: data.description,
        orderIndex: data.orderIndex,
        difficulty: data.difficulty,
        levelType: data.levelType,
        published: data.published,
        config: config as object,
        ownerTeacherId,
      },
    });

    return Response.json({ level }, { status: 201 });
  } catch (e) {
    console.error("[teacher/levels POST]", e);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
