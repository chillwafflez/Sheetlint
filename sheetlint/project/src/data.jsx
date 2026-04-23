// Mock data for Sheetlint prototype.

const SAMPLE_FILES = [
  { name: "broken_insurance_submissions.xlsx", size: "2.4 MB", rows: "18,204", sheets: 6 },
  { name: "mortgage_pipeline_q1.xlsx", size: "880 KB", rows: "3,192", sheets: 3 },
  { name: "dealer_inventory_march.xlsx", size: "1.1 MB", rows: "7,411", sheets: 4 },
];

const WORKSHEETS = [
  { id: "submissions", name: "Submissions", rows: 4200, cols: 18, hidden: false, flags: ["merged cells", "formula errors"] },
  { id: "claims_q1", name: "Claims_Q1", rows: 1820, cols: 12, hidden: false, flags: ["wide data"] },
  { id: "claims_q2", name: "Claims_Q2", rows: 1712, cols: 12, hidden: false, flags: [] },
  { id: "agents", name: "Agents", rows: 184, cols: 9, hidden: false, flags: ["dedupe candidate"] },
  { id: "_lookup_raw", name: "_lookup_raw", rows: 64, cols: 4, hidden: true, flags: ["hidden"] },
  { id: "notes", name: "NOTES - do not touch", rows: 22, cols: 2, hidden: false, flags: ["non-tabular"] },
];

const PREVIEW_ROWS = [
  ["policy_id", "agent_email", "submitted_on", "state", "premium_amount", "claim_count"],
  ["POL-01001", "m.reid@brightaxis.co", "2024-01-14", "NY", "1,842.50", "0"],
  ["POL-01002", "j.chen@brightaxis.co", "2024-01-14", "NY", "2,104.00", "1"],
  ["POL-01003", "s.okafor@brightaxis.co", "2024-01-15", "NJ", "998.75", "0"],
  ["POL-01004", "r.patel@brightaxis.co", "2024-01-15", "NY", "N/A", "2"],
  ["POL-01005", "a.gomez@brightaxis.co", "2024-01-16", "CT", "1,455.20", "0"],
];

const DETECTOR_GROUPS = [
  {
    id: "structural",
    title: "Structural",
    body: "Finds shape problems that break ingestion: merged cells, multi-row headers, stray cells outside the data region, formula errors, hidden sheets.",
    checks: ["merged_cells", "multi_header", "formula_err", "hidden_sheets", "empty_cols", "orphan_cells"],
    risk: "high",
  },
  {
    id: "statistical",
    title: "Statistical",
    body: "Profiles each column to catch mixed types, null density, regex coverage (dates, emails, IDs), and values that fall far outside the distribution.",
    checks: ["type_purity", "null_density", "regex_coverage", "outliers", "cardinality"],
    risk: "high",
  },
  {
    id: "duplicates",
    title: "Duplicates",
    body: "Exact and fuzzy duplicate detection across rows and within ID columns. Catches near-miss typos like 'POL-01001' vs 'POL-0100l'.",
    checks: ["exact_rows", "fuzzy_ids", "case_variants"],
    risk: "medium",
  },
  {
    id: "timeseries",
    title: "Time-series",
    body: "Rolling z-score spikes and STUMPY matrix-profile discords over any (date, numeric) column pair. Surfaces anomalies and regime changes.",
    checks: ["z_score", "matrix_profile", "gaps", "seasonality"],
    risk: "medium",
  },
  {
    id: "ai",
    title: "Claude semantic",
    body: "Per-column prompt-cached review: does the header match the content? Do values fit the implied domain? Flags context-dependent issues regex can't see.",
    checks: ["header_content_match", "domain_fit", "unit_sanity"],
    risk: "low",
    ai: true,
  },
  {
    id: "crossref",
    title: "Cross-reference",
    body: "Checks referential integrity across sheets — foreign keys, orphans, mismatches between related tables (e.g. policy_id in Claims not in Submissions).",
    checks: ["fk_integrity", "orphans"],
    risk: "medium",
  },
];

// A hand-picked set of mock issues mirroring the user's screenshots but expanded
const ISSUES = [
  {
    sev: "critical",
    det: "Structural",
    sheet: "Submissions",
    col: "—",
    rows: "C20:C22",
    msg: "Merged cells at C20:C22 fall inside the data region.",
    fix: "Programmatic ingestion will see empty cells after the top-left of the merge. Unmerge and repeat the value in each cell, or restructure the table.",
  },
  {
    sev: "critical",
    det: "Statistical",
    sheet: "Submissions",
    col: "premium_amount",
    rows: "13",
    msg: "Column is 91% float but has 13 value(s) of a different type (first rows: 50, 51, 52, 53, 54).",
    fix: "Standardize the column to float — the off-type entries are likely human-entry mistakes (e.g. 'N/A' in a money column).",
  },
  {
    sev: "warn",
    det: "AI",
    sheet: "Submissions",
    col: "agent_email",
    rows: "1",
    msg: "Value at index 12 is not a valid email address: 'mark.reid@'.",
    fix: "Review the flagged value and correct or remove the row.",
  },
  {
    sev: "warn",
    det: "Duplicates",
    sheet: "Submissions",
    col: "—",
    rows: "2",
    msg: "2 duplicate row(s) detected (exact match across all columns).",
    fix: "Deduplicate or investigate whether the duplicates represent repeated real-world events.",
  },
  {
    sev: "warn",
    det: "Duplicates",
    sheet: "Submissions",
    col: "policy_id",
    rows: "7",
    msg: "Contains 6 near-duplicate variants of 'POL-01001' — including 'POL-0100l' (lowercase L instead of 1).",
    fix: "Normalize all variants to 'POL-01001' (or your preferred canonical form).",
  },
  {
    sev: "warn",
    det: "Duplicates",
    sheet: "Submissions",
    col: "policy_id",
    rows: "6",
    msg: "Contains 6 near-duplicate variants of 'POL-01006' — likely a padding / casing mismatch.",
    fix: "Normalize all variants to 'POL-01006'.",
  },
  {
    sev: "warn",
    det: "Statistical",
    sheet: "Submissions",
    col: "state",
    rows: "34",
    msg: "Low regex coverage: 34 value(s) don't match the expected US state 2-letter pattern.",
    fix: "Examples: 'New York', 'N.Y.', 'ny ' — standardize to uppercase two-letter codes.",
  },
  {
    sev: "warn",
    det: "Structural",
    sheet: "Claims_Q1",
    col: "—",
    rows: "A1:F3",
    msg: "Multi-row header detected (rows 1–3 appear to contain header fragments).",
    fix: "Flatten to a single header row, or skip the top 2 rows on ingest.",
  },
  {
    sev: "warn",
    det: "Statistical",
    sheet: "Claims_Q1",
    col: "claim_amount",
    rows: "18",
    msg: "18 outliers beyond 4σ — values above $240k in a column whose median is $3.1k.",
    fix: "Confirm whether these are legitimate large claims, unit errors (cents vs dollars), or stray test data.",
  },
  {
    sev: "warn",
    det: "TimeSeries",
    sheet: "Submissions",
    col: "claim_count",
    rows: "3",
    msg: "3 matrix-profile discords detected in claim_count over submitted_on.",
    fix: "Review flagged windows around Jan 20, Feb 11, and Feb 25 for data entry errors or operational incidents.",
  },
  {
    sev: "warn",
    det: "TimeSeries",
    sheet: "Submissions",
    col: "monthly_revenue",
    rows: "14",
    msg: "14 z-score spikes detected (|z| > 3) and 1 matrix-profile discord.",
    fix: "A single point at $214k sits ~5σ above the rolling mean — verify.",
  },
  {
    sev: "warn",
    det: "AI",
    sheet: "Submissions",
    col: "notes",
    rows: "4",
    msg: "Header 'notes' doesn't match content — 4 rows contain what look like phone numbers.",
    fix: "Split into a separate 'phone' column or move values to the right field.",
  },
  {
    sev: "info",
    det: "Structural",
    sheet: "_lookup_raw",
    col: "—",
    rows: "—",
    msg: "Hidden worksheet '_lookup_raw' was excluded from scanning.",
    fix: "If this sheet should be inspected, unhide it or enable 'Include hidden sheets'.",
  },
];

// Poor man's time-series data for charts
function makeSeries(n, base, noise, seed) {
  const out = [];
  let rng = seed;
  for (let i = 0; i < n; i++) {
    rng = (rng * 9301 + 49297) % 233280;
    const r = rng / 233280;
    const val = base + Math.sin(i / 6) * base * 0.3 + (r - 0.5) * noise;
    out.push(Math.max(0, val));
  }
  return out;
}

const TS_SERIES_1 = {
  title: "Submissions.claim_count",
  subtitle: "Ensemble: 3 matrix-profile discord(s).",
  unit: "count",
  data: makeSeries(140, 2.5, 3, 17),
  anomalies: [18, 34, 48], // indices
  anomalyKind: "discord",
  start: "2024-01-14",
};
const TS_SERIES_2 = {
  title: "Submissions.monthly_revenue",
  subtitle: "Ensemble: 14 z-score spikes, 1 matrix-profile discord.",
  unit: "$",
  data: (() => {
    const base = makeSeries(140, 55000, 18000, 91);
    base[42] = 214000; // big spike
    base[88] = 3200;
    return base;
  })(),
  anomalies: [42],
  zspikes: [17, 23, 42, 55, 66, 72, 88, 99, 112, 118, 121, 128, 132, 137],
  anomalyKind: "spike",
  start: "2024-01-14",
};
const TS_SERIES_3 = {
  title: "Claims_Q1.claim_amount",
  subtitle: "Ensemble: 2 regime changes, no discords.",
  unit: "$",
  data: (() => {
    const a = makeSeries(70, 3100, 900, 3);
    const b = makeSeries(70, 4600, 1100, 57);
    return [...a, ...b];
  })(),
  anomalies: [],
  zspikes: [69, 70],
  anomalyKind: "regime",
  start: "2024-01-14",
};

window.MOCK = {
  SAMPLE_FILES, WORKSHEETS, PREVIEW_ROWS, DETECTOR_GROUPS, ISSUES,
  TS_SERIES_1, TS_SERIES_2, TS_SERIES_3,
};
