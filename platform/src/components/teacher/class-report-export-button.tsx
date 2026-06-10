"use client";

import { ExcelExportButton } from "@/components/teacher/excel-export-button";

export function ClassReportExportButton({
  classId,
  className,
  variant = "outline",
  size = "sm",
}: {
  classId: string;
  className: string;
  variant?: "outline" | "default" | "secondary";
  size?: "sm" | "default";
}) {
  return (
    <ExcelExportButton
      url={`/api/teacher/classes/${classId}/progress/export`}
      filename={`sparc-${className.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "class"}-class-report.xlsx`}
      label="Download Excel"
      variant={variant}
      size={size}
    />
  );
}
