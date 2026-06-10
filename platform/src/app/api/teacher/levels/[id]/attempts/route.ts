import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { requireClassAccess, resolveStudentIdsForScope, requireLevelReadAccess } from "@/lib/class-access";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, scope } = await requireTeacher();
  if (error) return error;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("classId") ?? undefined;

  if (classId) {
    const denied = requireClassAccess(scope!, classId);
    if (denied) return denied;
  }

  const level = await prisma.level.findFirst({
    where: { OR: [{ id }, { levelKey: id }] },
  });
  if (!level) return Response.json({ error: "Level not found" }, { status: 404 });

  const levelDenied = requireLevelReadAccess(scope!, level);
  if (levelDenied) return levelDenied;

  const scopedStudentIds = await resolveStudentIdsForScope(scope!, {
    classId,
  });

  const attempts = await prisma.levelAttempt.findMany({
    where: {
      levelId: level.id,
      ...(scopedStudentIds === null
        ? {}
        : scopedStudentIds.length
          ? { studentId: { in: scopedStudentIds } }
          : { studentId: { in: [] as string[] } }),
    },
    include: {
      student: true,
      assessmentResult: true,
    },
    orderBy: { startedAt: "desc" },
  });

  return Response.json({
    level: { id: level.id, name: level.name, levelKey: level.levelKey },
    attempts: attempts.map((a) => ({
      id: a.id,
      studentId: a.studentId,
      studentName: a.student.displayName,
      attemptNumber: a.attemptNumber,
      status: a.status,
      passed: a.passed,
      score: a.score,
      startedAt: a.startedAt,
      totalTimeSeconds: a.totalTimeSeconds,
      robotTouched: a.robotTouched,
      robotTouchCount: a.robotTouchCount,
    })),
  });
}
