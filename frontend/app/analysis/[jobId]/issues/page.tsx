"use client";

import { Download } from "lucide-react";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { SeverityBadge } from "@/components/severity-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useJob } from "@/hooks/use-job";
import type { Finding, Severity } from "@/lib/schemas";

const ALL = "__all__";
const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export default function IssuesPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { data: job } = useJob(jobId);
  const result = job?.result;

  const [severity, setSeverity] = useState<string>(ALL);
  const [detector, setDetector] = useState<string>(ALL);
  const [sheet, setSheet] = useState<string>(ALL);
  const [search, setSearch] = useState("");

  const detectors = useMemo(
    () =>
      result
        ? Array.from(new Set(result.findings.map((f) => f.detector))).sort()
        : [],
    [result],
  );
  const sheets = useMemo(
    () =>
      result
        ? Array.from(new Set(result.findings.map((f) => f.sheet))).sort()
        : [],
    [result],
  );

  const filtered = useMemo(() => {
    if (!result) return [];
    const q = search.trim().toLowerCase();
    return result.findings
      .filter((f) => (severity === ALL ? true : f.severity === severity))
      .filter((f) => (detector === ALL ? true : f.detector === detector))
      .filter((f) => (sheet === ALL ? true : f.sheet === sheet))
      .filter((f) =>
        q === ""
          ? true
          : f.message.toLowerCase().includes(q) ||
            f.detector.toLowerCase().includes(q) ||
            (f.column?.toLowerCase().includes(q) ?? false),
      )
      .sort(
        (a, b) =>
          SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
          a.detector.localeCompare(b.detector),
      );
  }, [result, severity, detector, sheet, search]);

  if (!result) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Input
          placeholder="Search messages, detectors, columns…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />

        <FilterSelect
          label="Severity"
          value={severity}
          onValueChange={setSeverity}
          options={[
            { value: "critical", label: "Critical" },
            { value: "warning", label: "Warning" },
            { value: "info", label: "Info" },
          ]}
        />

        <FilterSelect
          label="Detector"
          value={detector}
          onValueChange={setDetector}
          options={detectors.map((d) => ({ value: d, label: d }))}
        />

        <FilterSelect
          label="Sheet"
          value={sheet}
          onValueChange={setSheet}
          options={sheets.map((s) => ({ value: s, label: s }))}
        />

        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {result.findings.length}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadCsv(filtered, result.filename)}
          disabled={filtered.length === 0}
        >
          <Download className="size-4" />
          Download CSV
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">Severity</TableHead>
              <TableHead className="w-[120px]">Detector</TableHead>
              <TableHead className="w-[140px]">Sheet</TableHead>
              <TableHead className="w-[140px]">Column</TableHead>
              <TableHead className="w-[80px] text-right">Rows</TableHead>
              <TableHead>Message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((finding, i) => (
              <TableRow
                key={`${finding.detector}-${finding.sheet}-${finding.column ?? i}-${i}`}
              >
                <TableCell>
                  <SeverityBadge severity={finding.severity} withIcon={false} />
                </TableCell>
                <TableCell className="text-sm font-medium">
                  {finding.detector}
                </TableCell>
                <TableCell>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {finding.sheet}
                  </code>
                </TableCell>
                <TableCell>
                  {finding.column ? (
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {finding.column}
                    </code>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {finding.row_count || "—"}
                </TableCell>
                <TableCell className="space-y-1">
                  <div className="text-sm">{finding.message}</div>
                  {finding.suggested_fix ? (
                    <div className="text-xs italic text-emerald-700 dark:text-emerald-300">
                      Fix: {finding.suggested_fix}
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No findings match these filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Select
        value={value}
        onValueChange={(v) => v !== null && onValueChange(v)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function downloadCsv(findings: Finding[], filename: string) {
  const header = [
    "severity",
    "detector",
    "sheet",
    "column",
    "rows_affected",
    "message",
    "suggested_fix",
  ];
  const rows = findings.map((f) => [
    f.severity,
    f.detector,
    f.sheet,
    f.column ?? "",
    String(f.row_count),
    f.message,
    f.suggested_fix ?? "",
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${stripExt(filename)}_issues.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(cell: string): string {
  if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

function stripExt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}
