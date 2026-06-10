import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { requireClassAccess } from "@/lib/class-access";
import { buildAssessmentExportRows } from "@/lib/build-assessment-export-rows";
import { excelResponse, safeExportFilename } from "@/lib/export-excel-common";
import { buildAssessmentWorkbook } from "@/lib/export-assessment-excel";

export async function POST(request: NextRequest) {
  const { error, scope } = await requireTeacher();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const studentIds = Array.isArray(body.studentIds) ? (body.studentIds as string[]) : [];
  const allStudents = Boolean(body.allStudents);
  const levelId = typeof body.levelId === "string" ? body.levelId : undefined;
  const classId = typeof body.classId === "string" ? body.classId : undefined;

  if (classId) {
    const denied = requireClassAccess(scope!, classId);
    if (denied) return denied;
  }

  const rows = await buildAssessmentExportRows({
    studentIds,
    allStudents: allStudents || studentIds.length === 0,
    levelId,
    classId,
    scopeClassIds: scope!.classIds,
  });

  const buffer = buildAssessmentWorkbook(rows);
  const suffix = levelId ? "item-assessment" : classId ? "class-assessment" : "assessment";
  return excelResponse(buffer, safeExportFilename("sparc", suffix));
}
