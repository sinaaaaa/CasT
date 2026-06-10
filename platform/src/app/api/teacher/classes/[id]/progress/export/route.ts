import { requireTeacher } from "@/lib/api-auth";
import { requireClassAccess } from "@/lib/class-access";
import { getClassProgress } from "@/lib/analytics";
import { excelResponse } from "@/lib/export-excel-common";
import {
  buildClassReportWorkbookFromReport,
  classReportFilename,
} from "@/lib/export-student-progress-excel";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, scope } = await requireTeacher();
  if (error) return error;

  const { id } = await params;
  const denied = requireClassAccess(scope!, id);
  if (denied) return denied;

  const report = await getClassProgress(id);
  if (!report) {
    return Response.json({ error: "Class not found" }, { status: 404 });
  }

  const buffer = buildClassReportWorkbookFromReport(report);
  return excelResponse(buffer, classReportFilename(report.class.name));
}
