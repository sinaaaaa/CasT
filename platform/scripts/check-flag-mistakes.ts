import { PrismaClient } from "@prisma/client";
import { levelGameplayConfigSchema } from "../src/lib/level-config";
import { computeAttemptLiveAssessment } from "../src/lib/assessment/compute-attempt-live-assessment";
import { parseStudentFlagFromMistakes } from "../src/lib/assessment/evidenceExtractors";
import type { AttemptEvidenceInput } from "../src/lib/assessment/assessmentTypes";

const prisma = new PrismaClient();

async function main() {
  const attempts = await prisma.levelAttempt.findMany({
    where: { level: { levelType: "FLAG_PLACEMENT" }, endedAt: { not: null } },
    take: 10,
    orderBy: { startedAt: "desc" },
    include: { level: true },
  });

  console.log(`Found ${attempts.length} flag attempts\n`);

  for (const a of attempts) {
    const configOk = levelGameplayConfigSchema.safeParse(a.level.config);
    const flag = parseStudentFlagFromMistakes(a.mistakes);
    const evidence: AttemptEvidenceInput = {
      attemptId: a.id,
      attemptNumber: a.attemptNumber,
      passed: a.passed,
      status: a.status,
      finalCommand: a.finalCommand,
      initialCommand: a.initialCommand,
      commandHistory: a.commandHistory,
      hintsUsed: a.hintsUsed,
      mistakes: a.mistakes,
      totalTimeSeconds: a.totalTimeSeconds,
      robotTouched: a.robotTouched,
      robotTouchCount: a.robotTouchCount,
      resetCount: a.resetCount,
      firstRobotTouchAt: a.firstRobotTouchAt,
      startedAt: a.startedAt,
      commandEvents: [],
    };
    const live = configOk.success
      ? computeAttemptLiveAssessment({
          levelConfig: a.level.config,
          levelType: a.level.levelType,
          attempt: evidence,
        })
      : null;

    const m = a.mistakes;
    const mistakeType = Array.isArray(m) ? "array" : typeof m;

    console.log(`${a.level.levelKey} (${a.id.slice(0, 8)})`);
    console.log(`  config parse: ${configOk.success ? "OK" : "FAIL"}`);
    console.log(`  mistakes type: ${mistakeType}`);
    console.log(`  flag parsed: ${JSON.stringify(flag)}`);
    console.log(
      `  prediction available: ${live?.predictionResult?.available ?? "n/a"} misc models: ${live?.predictionResult?.misconceptionMatches?.length ?? 0} cmds: ${live?.predictionResult?.givenCommands?.length ?? 0}`
    );
    if (!configOk.success) {
      console.log(`  config errors:`, configOk.error.issues.slice(0, 3));
    }
    console.log("");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
