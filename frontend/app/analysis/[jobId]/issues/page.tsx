"use client";

import { useParams } from "next/navigation";
import { Fragment, useMemo, useState } from "react";

import { DownloadIcon, SearchIcon } from "@/components/icons";
import { IssueDetail } from "@/components/issue-detail";
import { SeverityBadge } from "@/components/severity-badge";
import { useJob } from "@/hooks/use-job";
import { downloadFindingsCsv } from "@/lib/csv";
import type { Finding, Severity } from "@/lib/schemas";

type SortKey = "severity" | "detector" | "sheet" | "column" | "row_count";
type SortDir = "asc" | "desc";
type SortState = { key: SortKey; dir: SortDir };

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const ALL = "__all__";

export default function IssuesPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { data: job } = useJob(jobId);
  const result = job?.result;

  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<string>(ALL);
  const [detector, setDetector] = useState<string>(ALL);
  const [sort, setSort] = useState<SortState>({ key: "severity", dir: "asc" });
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const detectors = useMemo(
    () =>
      result
        ? Array.from(new Set(result.findings.map((f) => f.detector))).sort()
        : [],
    [result],
  );

  const filtered = useMemo(() => {
    if (!result) return [];
    const q = query.trim().toLowerCase();
    const rows = result.findings.filter((f) => {
      if (severity !== ALL && f.severity !== severity) return false;
      if (detector !== ALL && f.detector !== detector) return false;
      if (q === "") return true;
      return (
        f.message.toLowerCase().includes(q) ||
        f.detector.toLowerCase().includes(q) ||
        f.sheet.toLowerCase().includes(q) ||
        (f.column?.toLowerCase().includes(q) ?? false)
      );
    });
    return [...rows].sort((a, b) => compareFindings(a, b, sort));
  }, [result, query, severity, detector, sort]);

  if (!result) return null;

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }

  return (
    <>
      <div className="filters">
        <div className="search">
          <SearchIcon style={{ color: "var(--ink-3)" }} />
          <input
            type="search"
            placeholder="Search messages, detectors, columns…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search findings"
          />
        </div>

        <label className="select-pill">
          <span style={{ color: "var(--ink-3)" }}>Severity</span>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            aria-label="Severity"
          >
            <option value={ALL}>all</option>
            <option value="critical">critical</option>
            <option value="warning">warning</option>
            <option value="info">info</option>
          </select>
        </label>

        <label className="select-pill">
          <span style={{ color: "var(--ink-3)" }}>Detector</span>
          <select
            value={detector}
            onChange={(e) => setDetector(e.target.value)}
            aria-label="Detector"
          >
            <option value={ALL}>all</option>
            {detectors.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <div className="filters__spacer" />

        <span className="filter-count">
          {filtered.length} of {result.findings.length}
        </span>

        <button
          type="button"
          className="btn btn--sm"
          onClick={() => downloadFindingsCsv(filtered, result.filename)}
          disabled={filtered.length === 0}
        >
          <DownloadIcon /> Download CSV
        </button>
      </div>

      <table className="issues-table">
        <thead>
          <tr>
            <SortableHeader label="Severity" k="severity" sort={sort} onSort={toggleSort} />
            <SortableHeader label="Detector" k="detector" sort={sort} onSort={toggleSort} />
            <SortableHeader label="Sheet" k="sheet" sort={sort} onSort={toggleSort} />
            <SortableHeader label="Column" k="column" sort={sort} onSort={toggleSort} />
            <SortableHeader label="Rows" k="row_count" sort={sort} onSort={toggleSort} />
            <th style={{ cursor: "default" }}>Message</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((finding, i) => {
            const open = openIndex === i;
            return (
              <Fragment key={rowKey(finding, i)}>
                <tr
                  className={open ? "open" : ""}
                  onClick={() => setOpenIndex(open ? null : i)}
                >
                  <td>
                    <SeverityBadge severity={finding.severity} />
                  </td>
                  <td className="col-det">{finding.detector}</td>
                  <td className="col-sheet">{finding.sheet}</td>
                  <td className="col-col">{finding.column ?? "—"}</td>
                  <td className="col-col" style={{ textAlign: "right" }}>
                    {finding.row_count || "—"}
                  </td>
                  <td className="col-msg">
                    {finding.message}
                    {finding.suggested_fix && (
                      <small>Fix: {finding.suggested_fix}</small>
                    )}
                  </td>
                </tr>
                {open && (
                  <tr>
                    <td colSpan={6} style={{ padding: 0 }}>
                      <IssueDetail finding={finding} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}

          {filtered.length === 0 && (
            <tr>
              <td colSpan={6}>
                <div className="empty-state">
                  <h3>No issues match those filters.</h3>
                  <div>Try clearing them.</div>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}

function SortableHeader({
  label,
  k,
  sort,
  onSort,
}: {
  label: string;
  k: SortKey;
  sort: SortState;
  onSort: (k: SortKey) => void;
}) {
  const active = sort.key === k;
  return (
    <th className={active ? "active" : ""} onClick={() => onSort(k)}>
      {label}
      {active && <span className="arrow">{sort.dir === "asc" ? "▲" : "▼"}</span>}
    </th>
  );
}

function compareFindings(a: Finding, b: Finding, sort: SortState): number {
  let cmp = 0;
  switch (sort.key) {
    case "severity":
      cmp = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      break;
    case "row_count":
      cmp = a.row_count - b.row_count;
      break;
    case "column":
      cmp = (a.column ?? "").localeCompare(b.column ?? "");
      break;
    default:
      cmp = a[sort.key].localeCompare(b[sort.key]);
  }
  return sort.dir === "asc" ? cmp : -cmp;
}

function rowKey(finding: Finding, index: number): string {
  return `${finding.detector}-${finding.sheet}-${finding.column ?? "col"}-${index}`;
}
