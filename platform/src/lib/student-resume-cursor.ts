import { prisma } from "@/lib/prisma";
import { AttemptStatus } from "@prisma/client";
import { levelGameplayConfigSchema } from "@/lib/level-config";

type PlayableLevelRef = {
  id: string;
  levelKey: string;
  config?: unknown;
};

export type StudentResumeCursor = {
  resumeLevelKey: string;
  resumeSlot: number;
};

/** Read maxAttempts from level config; default 3. */
export function maxAttemptsFromLevelConfig(config: unknown): number {
  const parsed = levelGameplayConfigSchema.safeParse(config);
  const n = parsed.success ? parsed.data.maxAttempts : 3;
  return Number.isFinite(n) && n >= 1 ? Math.min(99, Math.floor(n)) : 3;
}

/**
 * Persist "play next" bookmark. Only moves forward so a late stale report cannot rewind.
 * Uses raw SQL so Prisma Client does not require these columns on every StudentProfile query.
 */
export async function saveStudentResumeCursor(
  studentProfileId: string,
  resume: StudentResumeCursor
): Promise<StudentResumeCursor | null> {
  const key = resume.resumeLevelKey?.trim();
  const slot = resume.resumeSlot;
  if (!key || !Number.isFinite(slot) || slot < 1) return null;

  try {
    const current = await getStoredStudentResumeCursor(studentProfileId);
    if (current?.resumeSlot != null && current.resumeSlot > slot) {
      return current;
    }

    await prisma.$executeRaw`
      UPDATE "StudentProfile"
      SET "resumeLevelKey" = ${key},
          "resumeSlot" = ${Math.floor(slot)}
      WHERE id = ${studentProfileId}
    `;

    return { resumeLevelKey: key, resumeSlot: Math.floor(slot) };
  } catch (e) {
    // Columns missing → run Neon SQL / npm run db:student-resume
    console.warn("[resume] saveStudentResumeCursor failed:", e);
    return null;
  }
}

/**
 * After a terminal item end (pass or exhausted attempts), bookmark the next playlist slot.
 */
export async function advanceStudentResumeAfterItem(
  studentProfileId: string,
  orderedLevels: PlayableLevelRef[],
  finishedLevelId: string
): Promise<StudentResumeCursor | null> {
  if (orderedLevels.length === 0) return null;
  const finishedIndex = orderedLevels.findIndex((l) => l.id === finishedLevelId);
  if (finishedIndex < 0) return null;

  const nextIndex = Math.min(finishedIndex + 1, orderedLevels.length - 1);
  const next = orderedLevels[nextIndex];
  if (!next) return null;

  return saveStudentResumeCursor(studentProfileId, {
    resumeLevelKey: next.levelKey,
    resumeSlot: nextIndex + 1,
  });
}

/** True when this ended attempt should advance the playlist cursor. */
export function isTerminalItemAttempt(params: {
  passed: boolean;
  attemptNumber: number;
  maxAttempts: number;
  itemFinished?: boolean | null;
}): boolean {
  if (params.itemFinished === true) return true;
  if (params.passed) return true;
  const max = Math.max(1, params.maxAttempts || 3);
  return params.attemptNumber >= max;
}

/**
 * Derive finished flags from attempts when no explicit cursor exists yet.
 */
export async function loadEndedAttemptCountsByLevel(
  studentProfileId: string
): Promise<Map<string, number>> {
  const rows = await prisma.levelAttempt.groupBy({
    by: ["levelId"],
    where: {
      studentId: studentProfileId,
      endedAt: { not: null },
      status: { in: [AttemptStatus.CORRECT, AttemptStatus.INCORRECT] },
    },
    _count: { _all: true },
  });
  return new Map(rows.map((row) => [row.levelId, row._count._all]));
}

export async function getStoredStudentResumeCursor(
  studentProfileId: string
): Promise<StudentResumeCursor | null> {
  try {
    const rows = await prisma.$queryRaw<
      Array<{ resumeLevelKey: string | null; resumeSlot: number | null }>
    >`
      SELECT "resumeLevelKey", "resumeSlot"
      FROM "StudentProfile"
      WHERE id = ${studentProfileId}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row?.resumeLevelKey || row.resumeSlot == null || row.resumeSlot < 1) return null;
    return {
      resumeLevelKey: row.resumeLevelKey,
      resumeSlot: row.resumeSlot,
    };
  } catch (e) {
    console.warn("[resume] getStoredStudentResumeCursor failed:", e);
    return null;
  }
}

/** Optional: ensure columns exist (safe no-op if already present). */
export async function ensureStudentResumeColumns(): Promise<boolean> {
  try {
    await prisma.$executeRaw`
      ALTER TABLE "StudentProfile"
        ADD COLUMN IF NOT EXISTS "resumeLevelKey" TEXT,
        ADD COLUMN IF NOT EXISTS "resumeSlot" INTEGER
    `;
    return true;
  } catch (e) {
    console.warn("[resume] ensureStudentResumeColumns failed:", e);
    return false;
  }
}
