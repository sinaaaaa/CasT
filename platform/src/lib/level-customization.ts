import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TeacherScope } from "@/lib/class-access";
import { levelScopeWhere } from "@/lib/class-access";

export type LevelCustomizationIndex = {
  /** Platform default level ids replaced by a teacher customization. */
  supersededDefaultIds: Set<string>;
  /** Default level id → chosen teacher replacement (published copies only). */
  publishedReplacementBySource: Map<string, string>;
};

export async function buildTeacherCustomizationIndex(
  teacherProfileIds: string[],
  options: { publishedOnly: boolean }
): Promise<LevelCustomizationIndex> {
  if (teacherProfileIds.length === 0) {
    return { supersededDefaultIds: new Set(), publishedReplacementBySource: new Map() };
  }

  const rows = await prisma.level.findMany({
    where: {
      ownerTeacherId: { in: teacherProfileIds },
      customizedFromLevelId: { not: null },
      isArchived: false,
      ...(options.publishedOnly ? { published: true } : {}),
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, customizedFromLevelId: true },
  });

  const supersededDefaultIds = new Set<string>();
  const publishedReplacementBySource = new Map<string, string>();
  for (const row of rows) {
    const from = row.customizedFromLevelId!;
    supersededDefaultIds.add(from);
    if (!publishedReplacementBySource.has(from)) {
      publishedReplacementBySource.set(from, row.id);
    }
  }

  return { supersededDefaultIds, publishedReplacementBySource };
}

type LevelRow = {
  id: string;
  ownerTeacherId: string | null;
  customizedFromLevelId?: string | null;
};

/** Hide duplicate Item N: default + teacher copy should not both appear. */
export function applyLevelCustomizationFilter<T extends LevelRow>(
  levels: T[],
  index: LevelCustomizationIndex,
  mode: "teacher" | "student"
): T[] {
  if (mode === "teacher") {
    return levels.filter(
      (l) => !(l.ownerTeacherId === null && index.supersededDefaultIds.has(l.id))
    );
  }

  return levels.filter((l) => {
    if (l.ownerTeacherId === null && index.supersededDefaultIds.has(l.id)) return false;
    if (l.customizedFromLevelId) {
      const chosen = index.publishedReplacementBySource.get(l.customizedFromLevelId);
      if (chosen && chosen !== l.id) return false;
    }
    return true;
  });
}

/** Resolve assigned default level ids to a teacher's published customization when present. */
export function resolveAssignmentLevelIds(
  levelIds: string[],
  index: LevelCustomizationIndex
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of levelIds) {
    let resolved = index.publishedReplacementBySource.get(id) ?? id;
    if (
      index.supersededDefaultIds.has(id) &&
      !index.publishedReplacementBySource.has(id)
    ) {
      continue;
    }
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    out.push(resolved);
  }
  return out;
}

/** Levels visible in teacher UI / assignment pickers (hides defaults the teacher customized). */
export async function fetchTeacherVisibleLevels(
  scope: TeacherScope,
  extraWhere: Prisma.LevelWhereInput = {},
  orderBy:
    | Prisma.LevelOrderByWithRelationInput
    | Prisma.LevelOrderByWithRelationInput[] = { orderIndex: "asc" }
) {
  const rows = await prisma.level.findMany({
    where: { isArchived: false, ...levelScopeWhere(scope), ...extraWhere },
    orderBy,
  });

  if (scope.isAdmin || !scope.teacherProfileId) return rows;

  const index = await buildTeacherCustomizationIndex([scope.teacherProfileId], {
    publishedOnly: false,
  });
  return applyLevelCustomizationFilter(rows, index, "teacher");
}
