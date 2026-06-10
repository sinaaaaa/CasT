import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { getAllClassesProgress, getClassProgress } from "@/lib/analytics";
import { buildAllClassesReportWorkbook } from "@/lib/export-class-report-excel";

export async function POST(request: NextRequest) {
  const { error, scope } = await requireTeacher();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const classIds = Array.isArray(body.classIds) ? (body.classIds as string[]) : [];
  const allClasses = Boolean(body.allClasses);

  let reports;
  if (allClasses || classIds.length === 0) {
    reports = await getAllClassesProgress(scope!.classIds);
  } else {
    const allowed =
      scope!.classIds === null
        ? classIds
        : classIds.filter((id) => scope!.classIds!.includes(id));
    const fetched = await Promise.all(allowed.map((id) => getClassProgress(id)));
    reports = fetched.filter((r) => r != null);
  }

  if (reports.length === 0) {
    return Response.json({ error: "No class reports to export" }, { status: 400 });
  }

  const buffer = buildAllClassesReportWorkbook(reports);
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="sparc-class-reports.xlsx"`,
    },
  });
}
