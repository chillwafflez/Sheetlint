"use client";

import Link from "next/link";

import { ArrowBackIcon, DownloadIcon } from "@/components/icons";
import type { AnalysisResult } from "@/lib/schemas";

export function ReportHeader({
  result,
  scanSeconds,
  onDownload,
}: {
  result: AnalysisResult;
  scanSeconds: number | null;
  onDownload: () => void;
}) {
  const sheetsInspected = new Set(result.findings.map((f) => f.sheet)).size;
  const rowsInspected = result.findings.reduce((sum, f) => sum + f.row_count, 0);
  const detectorCount = Object.keys(result.trust_score.breakdown).length;

  return (
    <div className="report-head">
      <div className="report-head__left">
        <div className="report-head__eyebrow">Inspection report</div>
        <h2>{result.filename}</h2>
        <div className="report-head__meta">
          <span>
            <strong>{Math.max(1, sheetsInspected)}</strong> sheet
            {sheetsInspected === 1 ? "" : "s"}
          </span>
          <span>
            <strong>{detectorCount || "—"}</strong> detectors
          </span>
          <span>
            <strong>{rowsInspected.toLocaleString()}</strong> rows flagged
          </span>
          {scanSeconds !== null && (
            <span>
              scanned in <strong>{scanSeconds.toFixed(1)}s</strong>
            </span>
          )}
        </div>
      </div>

      <div className="report-head__actions">
        <Link href="/" className="btn">
          <ArrowBackIcon /> New inspection
        </Link>
        <button
          type="button"
          className="btn btn--primary"
          onClick={onDownload}
          disabled={result.findings.length === 0}
        >
          <DownloadIcon /> Download CSV
        </button>
      </div>
    </div>
  );
}
