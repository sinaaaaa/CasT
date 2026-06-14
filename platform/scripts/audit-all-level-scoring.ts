import { LevelType, PrismaClient } from "@prisma/client";
import { resolveAttemptEndScore } from "@/lib/game/resolve-attempt-score";

const prisma = new PrismaClient();

async function main() {
  const levels = await prisma.level.findMany({
    orderBy: { orderIndex: "asc" },
    select: { id: true, levelKey: true, name: true, levelType: true, published: true },
  });

  const byType = new Map<LevelType, typeof levels>();
  for (const l of levels) {
    const list = byType.get(l.levelType) ?? [];
    list.push(l);
    byType.set(l.levelType, list);
  }

  console.log("=== Levels by type ===");
  for (const type of Object.values(LevelType)) {
    const list = byType.get(type) ?? [];
    console.log(`\n${type} (${list.length}):`);
    for (const l of list) {
      console.log(`  - ${l.levelKey} ${l.published ? "" : "[unpublished]"} (${l.name})`);
    }
  }

  const endedAttempts = await prisma.levelAttempt.findMany({
    where: { endedAt: { not: null } },
    include: { level: { select: { levelKey: true, levelType: true, config: true } } },
    orderBy: { startedAt: "desc" },
  });

  let wouldFix = 0;
  const byTypeMismatches = new Map<LevelType, number>();

  for (const a of endedAttempts) {
    const { passed: resolvedPassed, score: resolvedScore } = resolveAttemptEndScore({
      levelType: a.level.levelType,
      levelConfig: a.level.config,
      passed: a.passed,
      score: a.score,
      mistakes: a.mistakes,
      finalCommand: a.finalCommand,
      initialCommand: a.initialCommand,
      attemptNumber: a.attemptNumber,
    });

    if (a.passed !== resolvedPassed) {
      wouldFix++;
      byTypeMismatches.set(
        a.level.levelType,
        (byTypeMismatches.get(a.level.levelType) ?? 0) + 1
      );
      console.log(
        `\nMismatch ${a.level.levelKey} try ${a.attemptNumber}: db passed=${a.passed} → resolved=${resolvedPassed} score=${resolvedScore} cmd=${a.finalCommand?.slice(0, 60)}`
      );
    }
  }

  console.log("\n=== Scoring audit summary ===");
  console.log(`Total ended attempts: ${endedAttempts.length}`);
  console.log(`Would change passed flag: ${wouldFix}`);
  for (const [type, count] of byTypeMismatches) {
    console.log(`  ${type}: ${count} mismatches`);
  }

  await prisma.$disconnect();
}

void main();
