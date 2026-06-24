import { NextRequest } from "next/server";
import { assertLevelReadAccess } from "@/lib/class-access";
import { requireTeacher } from "@/lib/api-auth";
import { resolveAssignedByTeacherId } from "@/lib/level-student-assignments";
import { prisma } from "@/lib/prisma";
import { INTRO_LEVEL_KEY } from "@/lib/level-config";

type RouteParams = { params: Promise<{ id: string }> };

async function uniqueLevelKey(base: string): Promise<string> {
  const root = base.replace(/_copy(_\d+)?$/, "");
  let candidate = `${root}_copy`;
  let n = 2;
  while (await prisma.level.findUnique({ where: { levelKey: candidate } })) {
    candidate = `${root}_copy_${n}`;
    n += 1;
  }
  return candidate;
}

/** Copy a platform or shared item into this teacher's catalog so they can edit and assign it. */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { error, session, scope } = await requireTeacher();
  if (error) return error;

  const { id } = await params;
  const source = await prisma.level.findUnique({ where: { id } });
  if (!source || source.isArchived) {
    return Response.json({ error: "Item not found" }, { status: 404 });
  }
  if (!assertLevelReadAccess(scope!, source)) {
    return Response.json({ error: "You do not have access to this item" }, { status: 403 });
  }

  if (!scope!.isAdmin && source.ownerTeacherId === scope!.teacherProfileId) {
    return Response.json(
      { error: "This is already your item — open Edit instead.", level: { id: source.id } },
      { status: 200 }
    );
  }

  if (source.ownerTeacherId === null && source.levelKey === INTRO_LEVEL_KEY) {
    return Response.json(
      {
        error: "Use the Introduction page to edit the shared intro.",
        redirect: "/teacher/introduction",
      },
      { status: 400 }
    );
  }

  const ownerTeacherId =
    scope!.isAdmin
      ? null
      : await resolveAssignedByTeacherId(session!.user.id, session!.user.teacherProfileId);

  if (!scope!.isAdmin && !ownerTeacherId) {
    return Response.json({ error: "Teacher profile required to customize items." }, { status: 400 });
  }

  const levelKey = await uniqueLevelKey(source.levelKey);
  const level = await prisma.level.create({
    data: {
      levelKey,
      name: source.name.startsWith("Copy of ") ? source.name : `Copy of ${source.name}`,
      description: source.description,
      orderIndex: source.orderIndex,
      difficulty: source.difficulty,
      levelType: source.levelType,
      published: false,
      config: source.config as object,
      ownerTeacherId,
    },
  });

  return Response.json(
    {
      level: {
        id: level.id,
        levelKey: level.levelKey,
        name: level.name,
      },
      message: "Item copied to your library. You can edit and assign this copy to your students.",
    },
    { status: 201 }
  );
}
