/**
 * Safe backfill: create StealthAssessmentResult for completed attempts that lack one.
 * Does NOT modify LevelAttempt, CommandEvent, or AssessmentResult rows.
 *
 * Usage: npx tsx scripts/backfill-stealth-assessment.ts [--limit=100]
 */

import { PrismaClient } from "@prisma/client";
import { analyzeStealthAssessment } from "../src/lib/assessment/persist";

const prisma = new PrismaClient();

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1] ?? "500", 10) : 500;

  const attempts = await prisma.levelAttempt.findMany({
    where: {
      endedAt: { not: null },
      stealthAssessment: null,
    },
    orderBy: { endedAt: "desc" },
    take: limit,
    select: { id: true, levelId: true, studentId: true },
  });

  console.log(`Backfilling ${attempts.length} attempt(s)...`);

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const a of attempts) {
    try {
      const result = await analyzeStealthAssessment(a.id);
      if ("skipped" in result && result.skipped) {
        skip++;
        console.log(`  skip ${a.id}: ${result.reason}`);
      } else {
        ok++;
        console.log(`  ok ${a.id}`);
      }
    } catch (e) {
      fail++;
      console.error(`  fail ${a.id}:`, e instanceof Error ? e.message : e);
    }
  }

  console.log(`Done. ok=${ok} skip=${skip} fail=${fail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
