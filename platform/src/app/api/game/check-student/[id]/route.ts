import { NextRequest } from "next/server";
import { gameApiUnauthorized, verifyGameApiKey } from "@/lib/game-api";
import { resolveStudent } from "@/lib/game-service";

/** Unity compatibility: verify student exists by external id */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyGameApiKey(request)) return gameApiUnauthorized();

  const { id } = await params;
  const student = await resolveStudent(id);
  if (!student) {
    return Response.json({ exists: false, error: "Student not found" }, { status: 404 });
  }

  return Response.json({
    exists: true,
    studentId: student.id,
    externalId: student.externalId,
    displayName: student.displayName,
  });
}
