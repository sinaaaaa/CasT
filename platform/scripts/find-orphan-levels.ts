import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const levels = await prisma.level.findMany({ select: { id: true, levelKey: true, name: true } });
  const levelIds = new Set(levels.map((l) => l.id));

  const attemptLevelIds = await prisma.levelAttempt.groupBy({
    by: ["levelId"],
    _count: true,
  });

  const orphans = attemptLevelIds.filter((a) => !levelIds.has(a.levelId));
  console.log("Current levels:", levels.map((l) => l.levelKey).join(", "));
  console.log("Orphan attempt levelIds:", orphans);

  if (orphans.length > 0) {
    for (const o of orphans) {
      const sample = await prisma.levelAttempt.findFirst({
        where: { levelId: o.levelId },
        select: { id: true, startedAt: true, finalCommand: true },
      });
      console.log("Sample attempt for deleted level", o.levelId, sample);
    }
  }

  const stealth = await prisma.stealthAssessmentResult.findMany({
    select: { levelId: true, taskType: true, createdAt: true },
    take: 50,
    orderBy: { createdAt: "desc" },
  });
  const stealthOrphans = stealth.filter((s) => !levelIds.has(s.levelId));
  console.log("Stealth rows referencing missing levels:", stealthOrphans.length);
}

main().finally(() => prisma.$disconnect());
