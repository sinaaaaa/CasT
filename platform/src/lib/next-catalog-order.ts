import { prisma } from "@/lib/prisma";

/** Next catalog order: one after the current last item (23 becomes 24). */
export async function nextCatalogOrderIndex(): Promise<number> {
  const agg = await prisma.level.aggregate({ _max: { orderIndex: true } });
  return (agg._max.orderIndex ?? -1) + 1;
}
