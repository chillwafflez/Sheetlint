"use client";

import { ChartIcon, GridIcon, ListIcon, SparkleIcon } from "@/components/icons";
import type { DetectorId } from "@/lib/schemas";

type DetectorDef = {
  id: DetectorId;
  title: string;
  body: string;
  checks: readonly string[];
  Icon: typeof GridIcon;
  badge?: "AI";
};

/**
 * These cards describe the real backend detectors — copy was adjusted from
 * the Claude Design mock to reflect what the implementation actually does.
 * Order here determines the Configure grid layout.
 */
export const DETECTOR_DEFS: readonly DetectorDef[] = [
  {
    id: "structural",
    title: "Structural",
    body: "Finds shape problems that break ingestion: merged cells, multi-row headers, formula errors, hidden sheets, empty columns.",
    checks: [
      "merged_cells",
      "pre_header_rows",
      "formula_err",
      "hidden_sheets",
      "empty_cols",
    ],
    Icon: GridIcon,
  },
  {
    id: "statistical",
    title: "Statistical",
    body: "Profiles each column for type purity (money/date/int mixed with text), regex coverage (emails, phones, ZIPs, dates, currency), and null density.",
    checks: ["type_purity", "regex_coverage", "null_density"],
    Icon: ChartIcon,
  },
  {
    id: "duplicates",
    title: "Duplicates",
    body: "Exact row duplicates plus fuzzy near-duplicates on ID-like columns (rapidfuzz, threshold 88) — catches 'POL-01001' vs 'POL-0100l'.",
    checks: ["exact_rows", "fuzzy_ids"],
    Icon: ListIcon,
  },
  {
    id: "timeseries",
    title: "Time-series",
    body: "Rolling z-score spikes ensembled with STUMPY matrix-profile discords on any (date, numeric) column pair. Needs ≥20 points; STUMPY ≥50.",
    checks: ["z_score", "matrix_profile"],
    Icon: ChartIcon,
  },
  {
    id: "ai",
    title: "AI semantic",
    body: "Per-column prompt-cached review with claude-opus-4-7: does the header match the content? Flags values that don't fit the implied domain.",
    checks: ["header_content_match", "domain_fit"],
    Icon: SparkleIcon,
    badge: "AI",
  },
] as const;

type DetectorPickerProps = {
  selected: ReadonlySet<DetectorId>;
  onToggle: (id: DetectorId) => void;
};

export function DetectorPicker({ selected, onToggle }: DetectorPickerProps) {
  return (
    <div className="detectors">
      {DETECTOR_DEFS.map((def) => (
        <DetectorCard
          key={def.id}
          def={def}
          on={selected.has(def.id)}
          onToggle={() => onToggle(def.id)}
        />
      ))}
    </div>
  );
}

function DetectorCard({
  def,
  on,
  onToggle,
}: {
  def: DetectorDef;
  on: boolean;
  onToggle: () => void;
}) {
  const iconColor = on ? "var(--accent)" : "var(--ink-3)";
  return (
    <button
      type="button"
      className={`detector ${on ? "on" : ""}`}
      onClick={onToggle}
      aria-pressed={on}
    >
      <div className="detector__head">
        <span className="detector__title-row">
          <def.Icon style={{ color: iconColor }} />
          <span className="detector__title">{def.title}</span>
          {def.badge && (
            <span
              className="chip chip--info"
              style={{ fontSize: 9, padding: "1px 6px" }}
            >
              {def.badge}
            </span>
          )}
        </span>
        <span className="toggle" aria-hidden />
      </div>
      <div className="detector__body">{def.body}</div>
      <div className="detector__checks">
        {def.checks.map((check) => (
          <span key={check} className="mini-chip">
            {check}
          </span>
        ))}
      </div>
    </button>
  );
}
