import { requireTeacher } from "@/lib/api-auth";
import { requireClassAccess, requireLevelReadAccess } from "@/lib/class-access";
import { getItemProgressReport } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { excelResponse } from "@/lib/export-excel-common";
import {
  buildItemReportWorkbook,
  itemReportFilename,
} from "@/lib/export-item-report-excel";

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

  const report = await getItemProgressReport(id, {
    classId,
    scopeClassIds: classId ? undefined : scope!.classIds,
  });
  if (!report) {
    return Response.json({ error: "Item not found" }, { status: 404 });
  }

  const level = await prisma.level.findFirst({
    where: { OR: [{ id }, { levelKey: id }] },
    select: { ownerTeacherId: true },
  });
  if (level) {
    const denied = requireLevelReadAccess(scope!, level);
    if (denied) return denied;
  }

  const buffer = buildItemReportWorkbook(report);
  return excelResponse(buffer, itemReportFilename(report.item.name));
}
