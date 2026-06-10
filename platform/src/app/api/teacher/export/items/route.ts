import { requireTeacher } from "@/lib/api-auth";
import { getAllItemsProgressSummary } from "@/lib/analytics";
import { excelResponse } from "@/lib/export-excel-common";
import { allItemsExportFilename, buildAllItemsWorkbook } from "@/lib/export-analytics-excel";

export async function GET() {
  const { error, scope } = await requireTeacher();
  if (error) return error;

  const items = await getAllItemsProgressSummary(scope!);
  const buffer = buildAllItemsWorkbook(items);
  return excelResponse(buffer, allItemsExportFilename());
}
