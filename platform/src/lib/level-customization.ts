import { Prisma } from "@prisma/client";
import type { Prisma as PrismaTypes } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TeacherScope } from "@/lib/class-access";
import { levelScopeWhere } from "@/lib/class-access";

export type LevelCustomizationIndex = {
  /** Platform default level ids replaced by a teacher customization. */
  supersededDefaultIds: Set<string>;
  /** Default level id → chosen teacher replacement (published copies only). */
  publishedReplacementBySource: Map<string, string>;
  /** All teacher customization copy level ids (used to hide non-chosen duplicates). */
  customizationCopyIds: Set<string>;
};

const EMPTY_INDEX: LevelCustomizationIndex = {
  supersededDefaultIds: new Set(),
  publishedReplacementBySource: new Map(),
  customizationCopyIds: new Set(),
};

let customizationColumnReady: boolean | null = null;

const COPY_KEY_SUFFIX = /_copy(_\d+)?$/;

function sourceKeyFromCopyLevelKey(levelKey: string): string | null {
  if (!COPY_KEY_SUFFIX.test(levelKey)) return null;
  return levelKey.replace(COPY_KEY_SUFFIX, "");
}

/** DB column is optional until migration SQL is applied on Neon — Prisma must not reference it. */
export async function isLevelCustomizationColumnReady(): Promise<boolean> {
  if (customizationColumnReady === true) return true;
  try {
    await prisma.$queryRaw`SELECT "customizedFromLevelId" FROM "Level" LIMIT 0`;
    customizationColumnReady = true;
    return true;
  } catch {
    return false;
  }
}

type CustomizationRow = { id: string; customizedFromLevelId: string };

async function loadCustomizationIndexFromColumn(
  teacherProfileIds: string[],
  publishedOnly: boolean
): Promise<LevelCustomizationIndex> {
  const rows = await prisma.$queryRaw<CustomizationRow[]>`
    SELECT id, "customizedFromLevelId"
    FROM "Level"
    WHERE "ownerTeacherId" IN (${Prisma.join(teacherProfileIds)})
      AND "customizedFromLevelId" IS NOT NULL
      AND "isArchived" = false
      ${publishedOnly ? Prisma.sql`AND published = true` : Prisma.empty}
    ORDER BY "updatedAt" DESC
  `;

  const supersededDefaultIds = new Set<string>();
  const publishedReplacementBySource = new Map<string, string>();
  const customizationCopyIds = new Set<string>();
  for (const row of rows) {
    const from = row.customizedFromLevelId;
    customizationCopyIds.add(row.id);
    supersededDefaultIds.add(from);
    if (!publishedReplacementBySource.has(from)) {
      publishedReplacementBySource.set(from, row.id);
    }
  }

  return { supersededDefaultIds, publishedReplacementBySource, customizationCopyIds };
}

/** Match level_1_copy → level_1 when customizedFromLevelId was never set. */
async function mergeLegacyCopyLevelKeys(
  teacherProfileIds: string[],
  publishedOnly: boolean,
  index: LevelCustomizationIndex
): Promise<LevelCustomizationIndex> {
  const copies = await prisma.level.findMany({
    where: {
      ownerTeacherId: { in: teacherProfileIds },
      isArchived: false,
      levelKey: { contains: "_copy" },
      ...(publishedOnly ? { published: true } : {}),
    },
    select: { id: true, levelKey: true },
    orderBy: { updatedAt: "desc" },
  });

  if (copies.length === 0) return index;

  const sourceKeys = [
    ...new Set(
      copies
        .map((c) => sourceKeyFromCopyLevelKey(c.levelKey))
        .filter((k): k is string => Boolean(k))
    ),
  ];
  if (sourceKeys.length === 0) return index;

  const sources = await prisma.level.findMany({
    where: {
      ownerTeacherId: null,
      isArchived: false,
      levelKey: { in: sourceKeys },
    },
    select: { id: true, levelKey: true },
  });
  const sourceIdByKey = new Map(sources.map((s) => [s.levelKey, s.id]));

  const supersededDefaultIds = new Set(index.supersededDefaultIds);
  const publishedReplacementBySource = new Map(index.publishedReplacementBySource);
  const customizationCopyIds = new Set(index.customizationCopyIds);

  for (const copy of copies) {
    const sourceKey = sourceKeyFromCopyLevelKey(copy.levelKey);
    if (!sourceKey) continue;
    const sourceId = sourceIdByKey.get(sourceKey);
    if (!sourceId) continue;

    customizationCopyIds.add(copy.id);
    supersededDefaultIds.add(sourceId);
    if (!publishedReplacementBySource.has(sourceId)) {
      publishedReplacementBySource.set(sourceId, copy.id);
    }
    void linkLevelCustomization(copy.id, sourceId);
  }

  return { supersededDefaultIds, publishedReplacementBySource, customizationCopyIds };
}

export async function buildTeacherCustomizationIndex(
  teacherProfileIds: string[],
  options: { publishedOnly: boolean }
): Promise<LevelCustomizationIndex> {
  if (teacherProfileIds.length === 0) return EMPTY_INDEX;

  try {
    let index = EMPTY_INDEX;
    if (await isLevelCustomizationColumnReady()) {
      index = await loadCustomizationIndexFromColumn(teacherProfileIds, options.publishedOnly);
    }
    return mergeLegacyCopyLevelKeys(teacherProfileIds, options.publishedOnly, index);
  } catch (error) {
    console.warn("[level-customization] Could not load customization index:", error);
    try {
      return mergeLegacyCopyLevelKeys(teacherProfileIds, options.publishedOnly, EMPTY_INDEX);
    } catch {
      return EMPTY_INDEX;
    }
  }
}

type LevelRow = {
  id: string;
  ownerTeacherId: string | null;
  levelKey?: string;
};

/** Hide duplicate Item N: default + teacher copy should not both appear. */
export function applyLevelCustomizationFilter<T extends LevelRow>(
  levels: T[],
  index: LevelCustomizationIndex,
  mode: "teacher" | "student"
): T[] {
  if (
    index.supersededDefaultIds.size === 0 &&
    index.customizationCopyIds.size === 0
  ) {
    return levels;
  }

  if (mode === "teacher") {
    return levels.filter(
      (l) => !(l.ownerTeacherId === null && index.supersededDefaultIds.has(l.id))
    );
  }

  const chosenCopyIds = new Set(index.publishedReplacementBySource.values());

  return levels.filter((l) => {
    if (l.ownerTeacherId === null && index.supersededDefaultIds.has(l.id)) return false;

    if (
      l.ownerTeacherId !== null &&
      index.customizationCopyIds.has(l.id) &&
      !chosenCopyIds.has(l.id)
    ) {
      return false;
    }

    // Safety net: hide platform default when a published teacher copy is in the list.
    if (l.ownerTeacherId === null && l.levelKey) {
      const replacedByCopy = levels.some(
        (other) =>
          other.id !== l.id &&
          other.ownerTeacherId !== null &&
          other.levelKey != null &&
          sourceKeyFromCopyLevelKey(other.levelKey) === l.levelKey &&
          chosenCopyIds.has(other.id)
      );
      if (replacedByCopy) return false;
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
    const resolved = index.publishedReplacementBySource.get(id) ?? id;
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
  extraWhere: PrismaTypes.LevelWhereInput = {},
  orderBy:
    | PrismaTypes.LevelOrderByWithRelationInput
    | PrismaTypes.LevelOrderByWithRelationInput[] = { orderIndex: "asc" }
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

export type ExistingCustomization = {
  id: string;
  levelKey: string;
  name: string;
};

/** Find a teacher's existing copy of a platform default (raw SQL when column exists). */
export async function findExistingCustomization(
  ownerTeacherId: string,
  sourceId: string,
  sourceLevelKey: string
): Promise<ExistingCustomization | null> {
  if (await isLevelCustomizationColumnReady()) {
    try {
      const linked = await prisma.$queryRaw<ExistingCustomization[]>`
        SELECT id, "levelKey", name
        FROM "Level"
        WHERE "ownerTeacherId" = ${ownerTeacherId}
          AND "customizedFromLevelId" = ${sourceId}
          AND "isArchived" = false
        LIMIT 1
      `;
      if (linked[0]) return linked[0];
    } catch {
      /* fall through to legacy key match */
    }
  }

  const legacy = await prisma.level.findFirst({
    where: {
      ownerTeacherId,
      isArchived: false,
      levelKey: { startsWith: `${sourceLevelKey}_copy` },
    },
    select: { id: true, levelKey: true, name: true },
  });
  if (!legacy) return null;

  await linkLevelCustomization(legacy.id, sourceId);
  return legacy;
}

/** Set customizedFromLevelId after copy create (no-op until migration applied). */
export async function linkLevelCustomization(copyId: string, sourceId: string): Promise<void> {
  if (!(await isLevelCustomizationColumnReady())) return;
  try {
    await prisma.$executeRaw`
      UPDATE "Level"
      SET "customizedFromLevelId" = ${sourceId}
      WHERE id = ${copyId}
    `;
  } catch (error) {
    console.warn("[level-customization] Could not link customization:", error);
  }
}
