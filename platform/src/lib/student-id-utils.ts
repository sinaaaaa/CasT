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

export function displayNameFromPrefix(prefix: string, n: number): string {
  return `${prefix.trim()} ${n}`;
}

const MAX_ID_RANGE_SPAN = 2000;
const ID_QUERY_CHUNK = 500;

export type StudentSlotSuggestion = {
  externalId: string;
  number: number;
  displayName: string;
};

function normalizeRange(from: number, to: number): { lo: number; hi: number } | null {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  if (lo < 1 || hi < lo) return null;
  if (hi - lo > MAX_ID_RANGE_SPAN) return null;
  return { lo, hi };
}

async function loadTakenIds(candidates: string[]): Promise<Set<string>> {
  const taken = new Set<string>();
  for (let i = 0; i < candidates.length; i += ID_QUERY_CHUNK) {
    const chunk = candidates.slice(i, i + ID_QUERY_CHUNK);
    const rows = await prisma.studentProfile.findMany({
      where: { externalId: { in: chunk } },
      select: { externalId: true },
    });
    for (const row of rows) {
      if (row.externalId) taken.add(row.externalId);
    }
  }
  return taken;
}

async function loadTakenDisplayNames(names: string[]): Promise<Set<string>> {
  const taken = new Set<string>();
  if (names.length === 0) return taken;

  for (let i = 0; i < names.length; i += ID_QUERY_CHUNK) {
    const chunk = names.slice(i, i + ID_QUERY_CHUNK);
    const rows = await prisma.studentProfile.findMany({
      where: {
        OR: chunk.map((name) => ({
          displayName: { equals: name, mode: "insensitive" as const },
        })),
      },
      select: { displayName: true },
    });
    for (const row of rows) {
      taken.add(row.displayName.toLowerCase());
    }
  }
  return taken;
}

/** First unused STU-#### in range; display name = "{prefix} {n}" when prefix is set. */
export async function findAvailableStudentSlotInRange(
  from: number,
  to: number,
  namePrefix?: string
): Promise<StudentSlotSuggestion | null> {
  const range = normalizeRange(from, to);
  if (!range) return null;

  const prefix = namePrefix?.trim() ?? "";
  const numbers: number[] = [];
  for (let n = range.lo; n <= range.hi; n++) {
    numbers.push(n);
  }

  const idCandidates = numbers.map((n) => studentIdFromNumber(n));
  const takenIds = await loadTakenIds(idCandidates);

  const nameCandidates = prefix
    ? numbers.map((n) => displayNameFromPrefix(prefix, n))
    : [];
  const takenNames = await loadTakenDisplayNames(nameCandidates);

  for (const n of numbers) {
    const externalId = studentIdFromNumber(n);
    if (takenIds.has(externalId)) continue;

    const displayName = prefix ? displayNameFromPrefix(prefix, n) : externalId;
    if (prefix && takenNames.has(displayName.toLowerCase())) continue;

    return { externalId, number: n, displayName };
  }

  return null;
}

/** @deprecated Use findAvailableStudentSlotInRange */
export async function findAvailableStudentIdInRange(
  from: number,
  to: number
): Promise<string | null> {
  const slot = await findAvailableStudentSlotInRange(from, to);
  return slot?.externalId ?? null;
}
