import { PrismaClient } from "@prisma/client";
import { getStudentProgress } from "../src/lib/analytics";
import { parseStudentFlagFromMistakes } from "../src/lib/assessment/evidenceExtractors";

const prisma = new PrismaClient();

async function main() {
  const level2 = await prisma.level.findFirst({ where: { levelKey: "level_2" } });
  console.log("level_2:", level2?.id, level2?.levelType, level2?.published);

  const attempts2 = await prisma.levelAttempt.findMany({
    where: { level: { levelKey: "level_2" } },
    orderBy: { startedAt: "desc" },
    take: 10,
    include: { student: { select: { displayName: true } }, level: true },
  });
  console.log(`\nlevel_2 attempts: ${attempts2.length}`);
  for (const a of attempts2) {
    console.log({
      id: a.id.slice(0, 10),
      student: a.student.displayName,
      status: a.status,
      passed: a.passed,
      score: a.score,
      endedAt: a.endedAt?.toISOString() ?? null,
      mistakes: JSON.stringify(a.mistakes)?.slice(0, 120),
    });
  }

  const student = await prisma.studentProfile.findFirst({
    where: { displayName: { contains: "86" } },
    select: { id: true, displayName: true },
  });
  if (student) {
    const progress = await getStudentProgress(student.id);
    const l2 = progress.levels.find((l) => l.levelKey === "level_2");
    console.log("\nStudent 86 level_2 progress:", l2);
    console.log(
      "History level_2 rows:",
      progress.history.filter((h) => h.levelKey === "level_2").length
    );
  }

  const recentFlag = await prisma.levelAttempt.findMany({
    where: { level: { levelType: "FLAG_PLACEMENT" }, endedAt: { not: null } },
    orderBy: { startedAt: "desc" },
    take: 3,
    select: { id: true, mistakes: true, level: { select: { levelKey: true } } },
  });
  console.log("\nRecent flag mistakes payload:");
  for (const a of recentFlag) {
    console.log(a.level.levelKey, JSON.stringify(a.mistakes));
    console.log("  parsed flag:", parseStudentFlagFromMistakes(a.mistakes));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
