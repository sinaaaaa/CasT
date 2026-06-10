import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { gameApiUnauthorized, verifyGameApiKey } from "@/lib/game-api";
import { levelGameplayConfigSchema } from "@/lib/level-config";
import { studentHasLevelAccess } from "@/lib/level-assignments";
import { normalizeExternalStudentId, resolveLevel, resolveStudent } from "@/lib/game-service";

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function POST(request: NextRequest) {
  if (!verifyGameApiKey(request)) return gameApiUnauthorized();

  try {
    const body = await request.json();
    const studentId = optionalString(body.studentId);
    const levelId = optionalString(body.levelId);
    const classId = optionalString(body.classId);
    const initialCommand = optionalString(body.initialCommand);

    if (!studentId || !levelId) {
      return Response.json({ error: "studentId and levelId are required" }, { status: 400 });
    }

    const student = await resolveStudent(normalizeExternalStudentId(studentId));
    if (!student) {
      return Response.json({ error: `Student not found: ${studentId}` }, { status: 404 });
    }

    const level = await resolveLevel(levelId);
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

    const attempt = await prisma.levelAttempt.create({
      data: {
        studentId: student.id,
        classId: classIdResolved,
        levelId: level.id,
        attemptNumber: previousAttempts + 1,
        initialCommand: initialCommand ?? null,
        startedAt: new Date(),
      },
    });

    return Response.json({
      attemptId: attempt.id,
      attemptNumber: attempt.attemptNumber,
      levelKey: level.levelKey,
      startedAt: attempt.startedAt,
    });
  } catch (error) {
    console.error("[level-start]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
