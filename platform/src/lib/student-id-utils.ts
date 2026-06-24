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

export type RangeConflict = {
  number: number;
  externalId?: string;
  displayName?: string;
};

export type StudentRangePlan =
  | { ok: true; slots: StudentSlotSuggestion[]; count: number; from: number; to: number }
  | { ok: false; conflicts: RangeConflict[]; message: string };

export function normalizeStudentNumberRange(
  from: number,
  to: number
): { lo: number; hi: number } | null {
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

/** Whole range must be free — returns all slots or conflicts (no partial generation). */
export async function planStudentRange(
  from: number,
  to: number,
  namePrefix: string
): Promise<StudentRangePlan> {
  const range = normalizeStudentNumberRange(from, to);
  if (!range) {
    return {
      ok: false,
      conflicts: [],
      message: "Invalid range. Use two numbers (max 2000 students per batch).",
    };
  }

  const prefix = namePrefix.trim();
  if (!prefix) {
    return { ok: false, conflicts: [], message: "Name prefix is required." };
  }

  const numbers: number[] = [];
  for (let n = range.lo; n <= range.hi; n++) {
    numbers.push(n);
  }

  const idCandidates = numbers.map((n) => studentIdFromNumber(n));
  const nameCandidates = numbers.map((n) => displayNameFromPrefix(prefix, n));
  const takenIds = await loadTakenIds(idCandidates);
  const takenNames = await loadTakenDisplayNames(nameCandidates);

  const conflicts: RangeConflict[] = [];
  for (const n of numbers) {
    const externalId = studentIdFromNumber(n);
    const displayName = displayNameFromPrefix(prefix, n);
    const idTaken = takenIds.has(externalId);
    const nameTaken = takenNames.has(displayName.toLowerCase());
    if (idTaken || nameTaken) {
      conflicts.push({
        number: n,
        ...(idTaken ? { externalId } : {}),
        ...(nameTaken ? { displayName } : {}),
      });
    }
  }

  if (conflicts.length > 0) {
    const sample = conflicts
      .slice(0, 4)
      .map((c) => c.externalId ?? c.displayName ?? String(c.number))
      .join(", ");
    return {
      ok: false,
      conflicts,
      message: `This range is not fully available (${conflicts.length} conflict${
        conflicts.length === 1 ? "" : "s"
      }: ${sample}${conflicts.length > 4 ? "…" : ""}). Select another range.`,
    };
  }

  const slots = numbers.map((n) => ({
    number: n,
    externalId: studentIdFromNumber(n),
    displayName: displayNameFromPrefix(prefix, n),
  }));

  return {
    ok: true,
    slots,
    count: slots.length,
    from: range.lo,
    to: range.hi,
  };
}

/** @deprecated Use planStudentRange */
export async function findAvailableStudentSlotInRange(
  from: number,
  to: number,
  namePrefix?: string
): Promise<StudentSlotSuggestion | null> {
  if (!namePrefix?.trim()) return null;
  const plan = await planStudentRange(from, to, namePrefix);
  return plan.ok ? plan.slots[0] ?? null : null;
}
