import { AttemptStatus, PrismaClient } from "@prisma/client";
import { resolveAttemptEndScore } from "@/lib/game/resolve-attempt-score";

const prisma = new PrismaClient();

async function main() {
  const studentId = process.argv[2];

  const attempts = await prisma.levelAttempt.findMany({
    where: {
      endedAt: { not: null },
      ...(studentId
        ? { student: { OR: [{ externalId: studentId }, { id: studentId }] } }
        : {}),
    },
    include: { level: true },
    orderBy: { startedAt: "desc" },
  });

  let updated = 0;
  for (const attempt of attempts) {
    const { score, passed } = resolveAttemptEndScore({
      levelType: attempt.level.levelType,
      levelConfig: attempt.level.config,
      passed: attempt.passed,
      score: attempt.score,
      mistakes: attempt.mistakes,
      finalCommand: attempt.finalCommand,
      initialCommand: attempt.initialCommand,
      attemptNumber: attempt.attemptNumber,
    });

    const status = passed ? AttemptStatus.CORRECT : AttemptStatus.INCORRECT;
    if (
      attempt.passed === passed &&
      attempt.status === status &&
      attempt.score === score
    ) {
      continue;
    }

    await prisma.levelAttempt.update({
      where: { id: attempt.id },
      data: { passed, status, score: score ?? attempt.score },
    });
    updated++;
    console.log(
      `Updated ${attempt.level.levelKey} (${attempt.level.levelType}) try ${attempt.attemptNumber}: passed=${passed} score=${score}`
    );
  }

  console.log(`Done. ${updated} attempt(s) updated${studentId ? ` for ${studentId}` : " (all students)"}.`);
  await prisma.$disconnect();
}

void main();
