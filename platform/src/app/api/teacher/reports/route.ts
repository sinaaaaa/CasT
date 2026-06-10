import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { requireClassAccess } from "@/lib/class-access";
import { getTeacherDashboardStats } from "@/lib/analytics";

export async function GET(request: NextRequest) {
  const { error, scope } = await requireTeacher();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("classId") ?? undefined;
  const levelId = searchParams.get("levelId") ?? undefined;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (classId) {
    const denied = requireClassAccess(scope!, classId);
    if (denied) return denied;
  }

  const stats = await getTeacherDashboardStats({
    classId,
    levelId,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    scopeClassIds: scope!.classIds,
  });

  return Response.json(stats);
}
