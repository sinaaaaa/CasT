import { requireTeacher } from "@/lib/api-auth";
import { requireClassAccess, requireLevelReadAccess } from "@/lib/class-access";
import { prisma } from "@/lib/prisma";
import { excelResponse } from "@/lib/export-excel-common";
import { buildAssessmentWorkbook } from "@/lib/export-assessment-excel";
import { buildAssessmentExportRows } from "@/lib/build-assessment-export-rows";
import { safeExportFilename } from "@/lib/export-excel-common";

export async function GET(
  request: Request,
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
    select: { id: true, name: true, ownerTeacherId: true },
  });
  if (!level) {
    return Response.json({ error: "Item not found" }, { status: 404 });
  }

  const denied = requireLevelReadAccess(scope!, level);
  if (denied) return denied;

  const rows = await buildAssessmentExportRows({
    levelId: level.id,
    classId,
    allStudents: true,
    scopeClassIds: classId ? undefined : scope!.classIds,
  });
  const buffer = buildAssessmentWorkbook(rows);
  return excelResponse(buffer, safeExportFilename(level.name, "assessment"));
}
