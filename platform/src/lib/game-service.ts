import {
  AttemptStatus,
  ButtonEventType,
  CommandAction,
  Prisma,
  RobotTouchType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Unity may send "1001" or "STU-1001" — database stores STU-1001. */
export function normalizeExternalStudentId(rawId: string): string {
  const id = rawId.trim();
  if (!id) return id;
  return id.toUpperCase().startsWith("STU-") ? id.toUpperCase() : `STU-${id}`;
}

export async function resolveStudent(studentIdOrExternal: string) {
  const normalized = normalizeExternalStudentId(studentIdOrExternal);
  return prisma.studentProfile.findFirst({
    where: {
      OR: [
        { id: studentIdOrExternal },
        { externalId: studentIdOrExternal },
        { externalId: normalized },
      ],
    },
    include: { classMemberships: { include: { class: true } } },
  });
}

export async function resolveLevel(levelIdOrKey: string) {
  return prisma.level.findFirst({
    where: {
      OR: [{ id: levelIdOrKey }, { levelKey: levelIdOrKey }],
    },
  });
}

export function parseAttemptStatus(value: string): AttemptStatus {
  const v = value.toUpperCase();
  if (v === "CORRECT" || v === "PASSED") return AttemptStatus.CORRECT;
  if (v === "INCORRECT" || v === "FAILED") return AttemptStatus.INCORRECT;
  return AttemptStatus.INCOMPLETE;
}

export function parseCommandAction(value: string): CommandAction {
  const map: Record<string, CommandAction> = {
    added: CommandAction.ADDED,
    removed: CommandAction.REMOVED,
    modified: CommandAction.MODIFIED,
    reordered: CommandAction.REORDERED,
    cleared: CommandAction.CLEARED,
    submitted: CommandAction.SUBMITTED,
  };
  return map[value.toLowerCase()] ?? CommandAction.MODIFIED;
}

export function parseButtonEventType(value: string): ButtonEventType {
  const map: Record<string, ButtonEventType> = {
    clicked: ButtonEventType.CLICKED,
    disabled: ButtonEventType.DISABLED,
    closed: ButtonEventType.CLOSED,
    enabled: ButtonEventType.ENABLED,
  };
  return map[value.toLowerCase()] ?? ButtonEventType.CLICKED;
}

export function parseRobotTouchType(value: string): RobotTouchType {
  const v = value.toLowerCase();
  if (v === "touch_end" || v === "touchend") return RobotTouchType.TOUCH_END;
  return RobotTouchType.TOUCH_START;
}

export async function rebuildCommandHistory(attemptId: string) {
  const events = await prisma.commandEvent.findMany({
    where: { attemptId },
    orderBy: [{ timestamp: "asc" }, { sequence: "asc" }],
  });
  const history = events.map((e) => ({
    timestamp: e.timestamp.toISOString(),
    command: e.command,
    action: e.action.toLowerCase(),
  }));
  await prisma.levelAttempt.update({
    where: { id: attemptId },
    data: { commandHistory: history as Prisma.InputJsonValue },
  });
  return history;
}

export async function syncRobotTouchStats(attemptId: string) {
  const events = await prisma.robotTouchEvent.findMany({
    where: { attemptId },
    orderBy: { timestamp: "asc" },
  });
  const touchCount = events.filter((e) => e.eventType === RobotTouchType.TOUCH_START).length;
  const duration = events.reduce((sum, e) => sum + (e.durationSeconds ?? 0), 0);
  const firstStart = events.find((e) => e.eventType === RobotTouchType.TOUCH_START);
  await prisma.levelAttempt.update({
    where: { id: attemptId },
    data: {
      robotTouched: touchCount > 0,
      robotTouchCount: touchCount,
      robotTouchDurationSeconds: duration,
      ...(firstStart ? { firstRobotTouchAt: firstStart.timestamp } : {}),
    },
  });
}

export async function incrementResetCount(attemptId: string) {
  await prisma.levelAttempt.update({
    where: { id: attemptId },
    data: { resetCount: { increment: 1 } },
  });
}

/** Append yellow-strip block close labels to attempt.closedButtons (deduped). */
export async function appendClosedStripButton(attemptId: string, buttonName: string) {
  const attempt = await prisma.levelAttempt.findUnique({
    where: { id: attemptId },
    select: { closedButtons: true },
  });
  if (!attempt) return;
  const existing = Array.isArray(attempt.closedButtons)
    ? (attempt.closedButtons as string[]).filter((x) => typeof x === "string")
    : [];
  if (existing.includes(buttonName)) return;
  await prisma.levelAttempt.update({
    where: { id: attemptId },
    data: { closedButtons: [...existing, buttonName] as Prisma.InputJsonValue },
  });
}
