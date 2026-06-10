import { NextRequest } from "next/server";
import { requireStudentSession } from "@/lib/student-api-auth";

export async function GET(request: NextRequest) {
  const { error, session } = await requireStudentSession(request);
  if (error) return error;

  return Response.json({
    studentId: session!.studentProfileId,
    studentCode: session!.studentCode,
    displayName: session!.displayName,
    expiresAt: session!.expiresAt.toISOString(),
  });
}
