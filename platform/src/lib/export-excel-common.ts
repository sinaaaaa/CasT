import * as XLSX from "xlsx";

export function safeSheetName(name: string, used: Set<string>): string {
  const base = name.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 28) || "Sheet";
  let candidate = base;
  let n = 2;
  while (used.has(candidate)) {
    candidate = `${base.slice(0, 24)} ${n}`;
    n += 1;
  }
  used.add(candidate);
  return candidate;
}

export function safeExportFilename(label: string, suffix = "report"): string {
  const safe = label.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "export";
  return `sparc-${safe}-${suffix}.xlsx`;
}

export function writeWorkbook(
  sheets: { name: string; rows: (string | number | boolean | null | undefined)[][] }[]
): Buffer {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  for (const sheet of sheets) {
    const normalized = sheet.rows.map((row) =>
      row.map((cell) => (cell === null || cell === undefined ? "" : cell))
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(normalized),
      safeSheetName(sheet.name, used)
    );
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function excelResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/** Prefer Unity/login external id (e.g. STU-1001); fall back to profile id. */
export function exportStudentId(
  externalId: string | null | undefined,
  profileId: string
): string {
  const trimmed = externalId?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : profileId;
}
