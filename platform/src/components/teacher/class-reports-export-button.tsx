"use client";

import { ExcelExportButton } from "@/components/teacher/excel-export-button";

export function ClassReportsExportButton({
  classIds,
  label = "Download all classes (Excel)",
}: {
  classIds?: string[];
  label?: string;
}) {
  return (
    <ExcelExportButton
      url="/api/teacher/export/class-reports"
      method="POST"
      body={{
        allClasses: !classIds || classIds.length === 0,
        classIds: classIds ?? [],
      }}
      filename="sparc-class-reports.xlsx"
      label={label}
    />
  );
}
