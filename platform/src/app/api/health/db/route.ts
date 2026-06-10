import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, database: "connected" });
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
