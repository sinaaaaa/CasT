import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { requireClassAccess } from "@/lib/class-access";
import { getClassCTPerformance } from "@/lib/ct/analytics";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  const { error, scope } = await requireTeacher();
  if (error) return error;

  const { classId } = await params;
  const denied = requireClassAccess(scope!, classId);
  if (denied) return denied;

  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls) return Response.json({ error: "Class not found" }, { status: 404 });

  const data = await getClassCTPerformance(classId);
  return Response.json(data);
}
