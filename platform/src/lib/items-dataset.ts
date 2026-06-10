import { LevelType, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  applyLevelTypeDefaults,
  levelGameplayConfigSchema,
  syncNumberLineGridPositions,
} from "@/lib/level-config";

const constructRefSchema = z.union([
  z.string(),
  z.object({
    constructSlug: z.string(),
    constructName: z.string().optional(),
    weightPercent: z.number().int().optional(),
    rubricDescription: z.string().nullable().optional(),
    expectedEvidence: z.string().nullable().optional(),
  }),
]);

const itemSchema = z.object({
  levelKey: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  orderIndex: z.number().int(),
  difficulty: z.number().int(),
  levelType: z.nativeEnum(LevelType),
  published: z.boolean(),
  isArchived: z.boolean().optional().default(false),
  config: z.unknown(),
  constructs: z.array(constructRefSchema).optional().default([]),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const itemsDatasetSchema = z.object({
  version: z.number().int(),
  exportedAt: z.string(),
  itemCount: z.number().int(),
  items: z.array(itemSchema),
});

export type ItemsDataset = z.infer<typeof itemsDatasetSchema>;

export async function exportItemsDataset(): Promise<ItemsDataset> {
  const levels = await prisma.level.findMany({
    orderBy: { orderIndex: "asc" },
    include: {
      constructMappings: {
        include: { construct: { select: { slug: true, name: true } } },
      },
    },
  });

  const items = levels.map((level) => ({
    levelKey: level.levelKey,
    name: level.name,
    description: level.description,
    orderIndex: level.orderIndex,
    difficulty: level.difficulty,
    levelType: level.levelType,
    published: level.published,
    isArchived: level.isArchived,
    config: level.config as Record<string, unknown>,
    constructs: level.constructMappings.map((m) => ({
      constructSlug: m.construct.slug,
      constructName: m.construct.name,
      weightPercent: m.weightPercent,
      rubricDescription: m.rubricDescription,
      expectedEvidence: m.expectedEvidence,
    })),
  }));

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    itemCount: items.length,
    items,
  };
}

function normalizeConstructRefs(
  refs: ItemsDataset["items"][number]["constructs"]
): { slug: string; weightPercent: number; rubricDescription: string | null; expectedEvidence: string | null }[] {
  return refs.map((ref) => {
    if (typeof ref === "string") {
      return { slug: ref, weightPercent: 0, rubricDescription: null, expectedEvidence: null };
    }
    return {
      slug: ref.constructSlug,
      weightPercent: ref.weightPercent ?? 0,
      rubricDescription: ref.rubricDescription ?? null,
      expectedEvidence: ref.expectedEvidence ?? null,
    };
  });
}

function normalizeConfig(levelType: LevelType, config: unknown) {
  const base =
    config && typeof config === "object" && !Array.isArray(config)
      ? (config as Prisma.JsonObject)
      : {};
  const merged = syncNumberLineGridPositions(
    applyLevelTypeDefaults(levelType, base as Parameters<typeof applyLevelTypeDefaults>[1])
  );
  levelGameplayConfigSchema.parse(merged);
  return merged as object;
}

export async function importItemsDataset(
  raw: unknown,
  options?: { removeMissing?: boolean }
): Promise<{ imported: number; removed: number; levelKeys: string[] }> {
  const parsed = itemsDatasetSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Invalid items backup file.");
  }

  const dataset = parsed.data;
  const levelKeys: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const item of dataset.items) {
      const config = normalizeConfig(item.levelType, item.config);
      const level = await tx.level.upsert({
        where: { levelKey: item.levelKey },
        create: {
          levelKey: item.levelKey,
          name: item.name,
          description: item.description ?? null,
          orderIndex: item.orderIndex,
          difficulty: item.difficulty,
          levelType: item.levelType,
          published: item.published,
          isArchived: item.isArchived ?? false,
          config,
        },
        update: {
          name: item.name,
          description: item.description ?? null,
          orderIndex: item.orderIndex,
          difficulty: item.difficulty,
          levelType: item.levelType,
          published: item.published,
          isArchived: item.isArchived ?? false,
          config,
        },
      });

      levelKeys.push(item.levelKey);

      if (item.constructs?.length) {
        const refs = normalizeConstructRefs(item.constructs);
        const slugs = refs.map((r) => r.slug);
        const constructs = await tx.cTConstruct.findMany({
          where: { slug: { in: slugs } },
          select: { id: true, slug: true },
        });
        const bySlug = Object.fromEntries(constructs.map((c) => [c.slug, c.id]));
        await tx.levelCTConstruct.deleteMany({ where: { levelId: level.id } });
        for (const ref of refs) {
          const constructId = bySlug[ref.slug];
          if (!constructId) continue;
          await tx.levelCTConstruct.create({
            data: {
              levelId: level.id,
              constructId,
              weightPercent: ref.weightPercent,
              rubricDescription: ref.rubricDescription,
              expectedEvidence: ref.expectedEvidence,
            },
          });
        }
      }
    }

    if (options?.removeMissing) {
      await tx.level.deleteMany({
        where: { levelKey: { notIn: levelKeys } },
      });
    }
  });

  return {
    imported: dataset.items.length,
    removed: options?.removeMissing
      ? Math.max(0, (await prisma.level.count()) - dataset.items.length)
      : 0,
    levelKeys,
  };
}
