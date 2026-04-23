import type { Finding } from "@/lib/schemas";

const MAX_ROWS_SHOWN = 12;

const TECHNIQUE_BY_PREFIX: ReadonlyArray<readonly [string, string]> = [
  [
    "statistical",
    "Each column is type-profiled; any column whose dominant type exceeds ~90% triggers a flag against the remaining off-type cells. 'N/A', blanks, and units-in-cell are the usual culprits.",
  ],
  [
    "structural",
    "openpyxl walks the worksheet's merged-range registry, detects hidden sheets, and resolves formula errors. Regions overlapping the dense data area are flagged.",
  ],
  [
    "duplicate",
    "Rows are hashed column-by-column for exact duplicate detection. ID-like columns additionally run through a fuzzy pass using edit distance ≤ 1 to catch confusable-character typos.",
  ],
  [
    "timeseries",
    "Rolling z-score over residuals is ensembled with a STUMPY matrix-profile discord search over the (date, numeric) pair — single-point spikes and shape anomalies both surface.",
  ],
  [
    "ai",
    "Claude reviews each column header alongside a deterministic sample of values, with prompt caching so re-scans of similar files are near-free.",
  ],
] as const;

function techniqueFor(detector: string): string {
  const key = detector.toLowerCase();
  for (const [prefix, text] of TECHNIQUE_BY_PREFIX) {
    if (key.startsWith(prefix)) return text;
  }
  return "Detector-specific heuristic — see the detector implementation for details.";
}

function formatRows(rows: readonly number[]): string {
  if (rows.length === 0) return "—";
  if (rows.length <= MAX_ROWS_SHOWN) return rows.join(", ");
  const shown = rows.slice(0, MAX_ROWS_SHOWN).join(", ");
  return `${shown} … (+${rows.length - MAX_ROWS_SHOWN} more)`;
}

export function IssueDetail({ finding }: { finding: Finding }) {
  return (
    <div className="issue-detail">
      <div className="detail-grid">
        <div>
          <h4>Where it is</h4>
          <div className="kv-grid">
            <span className="k">Detector</span>
            <span>{finding.detector}</span>
            <span className="k">Sheet</span>
            <span className="mono">{finding.sheet}</span>
            <span className="k">Column</span>
            <span className="mono">{finding.column ?? "—"}</span>
            <span className="k">Row count</span>
            <span className="mono">{finding.row_count}</span>
            <span className="k">Rows</span>
            <span className="mono" style={{ wordBreak: "break-word" }}>
              {formatRows(finding.rows)}
            </span>
          </div>
        </div>

        <div>
          <h4>Why this matters</h4>
          <p>{finding.suggested_fix ?? "Review the flagged cells and adjust."}</p>
          <h4>Detection technique</h4>
          <p className="technique">{techniqueFor(finding.detector)}</p>
        </div>
      </div>
    </div>
  );
}
