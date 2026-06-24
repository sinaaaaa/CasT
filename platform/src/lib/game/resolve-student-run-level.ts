import { getPlayableLevelsForStudent } from "@/lib/level-assignments";
import { prisma } from "@/lib/prisma";
import { resolveLevel } from "@/lib/game-service";

function parseSlotNumber(body: Record<string, unknown>): number | null {
  const raw = body.slotNumber ?? body.playSlot;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  const slot = Math.trunc(raw);
  return slot >= 1 ? slot : null;
}

/**
 * Resolve the level row for a game RUN.
 * When Unity sends playSlot, trust the student's ordered assignment list over levelKey alone
 * (prevents Item 2 runs being stored as Item 3 when keys drift after customize/resume).
 */
export async function resolveLevelForStudentRun(
  studentIdOrExternal: string,
  levelIdOrKey: string,
  body?: Record<string, unknown>
) {
  const fromKey = await resolveLevel(levelIdOrKey);
  const slotNumber = body ? parseSlotNumber(body) : null;
  if (!slotNumber) return fromKey;

  const playable = await getPlayableLevelsForStudent(studentIdOrExternal);
  const atSlot = playable[slotNumber - 1];
  if (!atSlot) return fromKey;

  const slotLevel = await prisma.level.findUnique({ where: { id: atSlot.id } });
  if (!slotLevel) return fromKey;

  if (fromKey && fromKey.id !== slotLevel.id) {
    console.warn(
      `[level-start] Slot ${slotNumber} level ${slotLevel.levelKey} overrides client key ${fromKey.levelKey}`
    );
  }

  return slotLevel;
}

export { parseSlotNumber };
