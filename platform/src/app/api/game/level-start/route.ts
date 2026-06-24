import { AttemptStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { gameApiUnauthorized, verifyGameApiKey } from "@/lib/game-api";
import { levelGameplayConfigSchema } from "@/lib/level-config";
import { studentHasLevelAccess } from "@/lib/level-assignments";
import { normalizeExternalStudentId, resolveStudent } from "@/lib/game-service";
import {
  parseSlotNumber,
  resolveLevelForStudentRun,
} from "@/lib/game/resolve-student-run-level";

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function POST(request: NextRequest) {
  if (!verifyGameApiKey(request)) return gameApiUnauthorized();

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const studentId = optionalString(body.studentId);
    const levelId = optionalString(body.levelId);
    const classId = optionalString(body.classId);
    const initialCommand = optionalString(body.initialCommand);
    const playSlot = parseSlotNumber(body);

    if (!studentId || !levelId) {
      return Response.json({ error: "studentId and levelId are required" }, { status: 400 });
    }

    const normalizedStudentId = normalizeExternalStudentId(studentId);
    const student = await resolveStudent(normalizedStudentId);
    if (!student) {
      return Response.json({ error: `Student not found: ${studentId}` }, { status: 404 });
    }

    const level = await resolveLevelForStudentRun(normalizedStudentId, levelId, body);
    if (!level) {
      return Response.json({ error: `Level not found: ${levelId}` }, { status: 404 });
    }

    if (!level.published) {
      return Response.json({ error: "Level is not published" }, { status: 403 });
    }

    const cfg = levelGameplayConfigSchema.safeParse(level.config);
    if (cfg.success && cfg.data.visible === false) {
      return Response.json({ error: "Level is hidden" }, { status: 403 });
    }

    const allowed = await studentHasLevelAccess(student.id, level.id);
    if (!allowed) {
      return Response.json({ error: "This level is not assigned to you." }, { status: 403 });
    }

    const classIdResolved = classId ?? student.classMemberships[0]?.classId ?? null;

    const previousAttempts = await prisma.levelAttempt.count({
      where: { studentId: student.id, levelId: level.id },
    });

    await prisma.levelAttempt.updateMany({
      where: { studentId: student.id, levelId: level.id, endedAt: null },
      data: { endedAt: new Date(), status: AttemptStatus.INCOMPLETE },
    });

    const attempt = await prisma.levelAttempt.create({
      data: {
        studentId: student.id,
        classId: classIdResolved,
        levelId: level.id,
        attemptNumber: previousAttempts + 1,
        initialCommand: initialCommand ?? null,
        startedAt: new Date(),
        ...(playSlot != null ? { mistakes: { playSlot } } : {}),
      },
    });

    return Response.json({
      attemptId: attempt.id,
      attemptNumber: attempt.attemptNumber,
      levelKey: level.levelKey,
      levelId: level.id,
      playSlot,
      startedAt: attempt.startedAt,
    });
  } catch (error) {
    console.error("[level-start]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
