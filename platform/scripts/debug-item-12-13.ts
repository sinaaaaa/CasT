import { PrismaClient } from "@prisma/client";
import { resolveAttemptEndScore } from "@/lib/game/resolve-attempt-score";
import { buildTaskAssessmentConfig } from "@/lib/assessment/assessmentConfig";
import { programStopsOnGoalStrict, simulateProgram } from "@/lib/assessment/routeAnalysis";
import { resolveAttemptProgram } from "@/lib/assessment/resolve-program";
import type { LevelGameplayConfig } from "@/lib/level-config";

const prisma = new PrismaClient();

async function main() {
  const attempts = await prisma.levelAttempt.findMany({
    where: {
      student: { externalId: "STU-86" },
      level: { levelKey: { in: ["item_12", "item_13"] } },
      endedAt: { not: null },
    },
    orderBy: { startedAt: "desc" },
    take: 6,
    include: { level: true },
  });

  for (const a of attempts) {
    const config = a.level.config as LevelGameplayConfig;
    const { passed, score } = resolveAttemptEndScore({
      levelType: a.level.levelType,
      levelConfig: config,
      passed: a.passed,
      score: a.score,
      mistakes: a.mistakes,
      finalCommand: a.finalCommand,
      initialCommand: a.initialCommand,
      attemptNumber: a.attemptNumber,
    });

    const cmds = resolveAttemptProgram({
      finalCommand: a.finalCommand,
      initialCommand: a.initialCommand,
      levelConfig: config,
      levelType: a.level.levelType,
    });
    const task = buildTaskAssessmentConfig("live", config, [], a.level.levelType);
    const sim = simulateProgram(task, cmds);

    console.log(
      JSON.stringify(
        {
          levelKey: a.level.levelKey,
          attemptNumber: a.attemptNumber,
          finalCommand: a.finalCommand,
          dbPassed: a.passed,
          resolvedPassed: passed,
          resolvedScore: score,
          visit: (a.mistakes as { objectVisit?: unknown })?.objectVisit,
          simFinal: sim.finalPosition,
          reachedGoals: sim.reachedGoals,
          correctGoalOrder: sim.correctGoalOrder,
          strict: programStopsOnGoalStrict(task, sim),
          layoutMode: config.layoutMode,
        },
        null,
        2
      )
    );
  }

  await prisma.$disconnect();
}

void main();
