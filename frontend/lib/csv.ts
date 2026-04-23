import type { Finding } from "@/lib/schemas";

const CSV_HEADER = [
  "severity",
  "detector",
  "sheet",
  "column",
  "rows_affected",
  "message",
  "suggested_fix",
] as const;

function escapeCell(cell: string): string {
  if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

function stripExt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

export function downloadFindingsCsv(findings: Finding[], filename: string) {
  const rows = findings.map((f) => [
    f.severity,
    f.detector,
    f.sheet,
    f.column ?? "",
    String(f.row_count),
    f.message,
    f.suggested_fix ?? "",
  ]);
  const csv = [CSV_HEADER, ...rows]
    .map((row) => row.map(escapeCell).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${stripExt(filename)}_issues.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
