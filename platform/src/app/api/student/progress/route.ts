import { requireStudent } from "@/lib/api-auth";
import { getStudentProgress } from "@/lib/analytics";

export async function GET() {
  const { error, session } = await requireStudent();
  if (error) return error;

  const studentProfileId = session!.user.studentProfileId;
  if (!studentProfileId) {
    return Response.json({ error: "Student profile not found" }, { status: 404 });
  }

  const progress = await getStudentProgress(studentProfileId);
  return Response.json(progress);
}
