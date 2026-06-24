import { normalizeExternalStudentId } from "@/lib/game-service";
import { prisma } from "@/lib/prisma";

export function studentIdFromNumber(n: number): string {
  return `STU-${n}`;
}

export function parseStudentIdNumber(externalId: string): number | null {
  const normalized = normalizeExternalStudentId(externalId);
  const match = normalized.match(/^STU-(\d+)$/);
  if (!match) return null;
  const n = Number.parseInt(match[1], 10);
  return Number.isFinite(n) ? n : null;
}

const MAX_ID_RANGE_SPAN = 500;

/** First unused STU-#### in [from, to] (inclusive). */
export async function findAvailableStudentIdInRange(
  from: number,
  to: number
): Promise<string | null> {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo < 1 || hi < lo) return null;
  if (hi - lo > MAX_ID_RANGE_SPAN) return null;

  const candidates: string[] = [];
  for (let n = lo; n <= hi; n++) {
    candidates.push(studentIdFromNumber(n));
  }

  const existing = await prisma.studentProfile.findMany({
    where: { externalId: { in: candidates } },
    select: { externalId: true },
  });
  const taken = new Set(existing.map((row) => row.externalId));

  for (const id of candidates) {
    if (!taken.has(id)) return id;
  }
  return null;
}
