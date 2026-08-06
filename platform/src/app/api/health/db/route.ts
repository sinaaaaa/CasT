import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'LevelStudentAssignment'
       ORDER BY column_name`
    );
    const names = cols.map((c) => c.column_name);
    const required = [
      "assignmentOrder",
      "isActive",
      "deactivatedAt",
      "assignedByTeacherId",
    ];
    const missing = required.filter((c) => !names.includes(c));

    // Probe the same write path Prisma uses for assignments (read-only check).
    let assignmentProbe: { ok: boolean; error?: string } = { ok: true };
    try {
      await prisma.levelStudentAssignment.findFirst({
        select: {
          id: true,
          assignmentOrder: true,
          isActive: true,
        },
      });
    } catch (e) {
      assignmentProbe = {
        ok: false,
        error: e instanceof Error ? e.message.slice(0, 400) : String(e).slice(0, 400),
      };
    }

    return Response.json({
      ok: true,
      database: "connected",
      levelStudentAssignmentColumns: names,
      missingAssignmentColumns: missing,
      assignmentProbe,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      {
        ok: false,
        database: "unavailable",
        message,
        hint: "Start PostgreSQL on localhost:5432, then run npm run db:push && npm run db:seed",
      },
      { status: 503 }
    );
  }
}
