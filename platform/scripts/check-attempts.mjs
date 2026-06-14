import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const attemptId = process.argv[2];
const recent = await prisma.levelAttempt.findMany({
  where: { student: { externalId: "STU-86" } },
  orderBy: { startedAt: "desc" },
  take: 8,
  include: { level: { select: { levelKey: true, name: true, levelType: true } } },
});

console.log(
  "RECENT STU-86",
  JSON.stringify(
    recent.map((r) => ({
      id: r.id,
      levelKey: r.level.levelKey,
      levelType: r.level.levelType,
      passed: r.passed,
      status: r.status,
      score: r.score,
      attemptNumber: r.attemptNumber,
      endedAt: r.endedAt,
      mistakes: r.mistakes,
    })),
    null,
    2
  )
);

if (attemptId) {
  const a = await prisma.levelAttempt.findUnique({
    where: { id: attemptId },
    include: { level: true },
  });
  console.log("DETAIL", JSON.stringify(a, null, 2));
}

await prisma.$disconnect();
