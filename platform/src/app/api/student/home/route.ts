import { NextRequest } from "next/server";
import { requireStudentSession } from "@/lib/student-api-auth";
import { getStudentHomeData } from "@/lib/student-home-data";

export async function GET(request: NextRequest) {
  const { error, session } = await requireStudentSession(request);
  if (error) return error;

  const data = await getStudentHomeData(
    session!.studentProfileId,
    session!.studentCode
  );

  return Response.json({
    student: {
      id: session!.studentProfileId,
      studentCode: session!.studentCode,
      displayName: session!.displayName,
    },
    ...data,
  });
}
