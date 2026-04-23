import { SeverityBadge } from "@/components/severity-badge";
import type { Finding } from "@/lib/schemas";

const SEVERITY_CLASS = {
  critical: "callout callout--critical",
  warning: "callout callout--warn",
  info: "callout callout--info",
} as const;

function summarizeRows(rows: readonly number[]): string | null {
  if (rows.length === 0) return null;
  if (rows.length === 1) return `row ${rows[0]}`;
  if (rows.length <= 3) return `rows ${rows.join(", ")}`;
  return `${rows.length} rows`;
}

export function Callout({ finding }: { finding: Finding }) {
  const rowLabel = summarizeRows(finding.rows);

  return (
    <article className={SEVERITY_CLASS[finding.severity]}>
      <div className="callout__sev">
        <SeverityBadge severity={finding.severity} />
      </div>

      <div>
        <div className="callout__msg">{finding.message}</div>
        {finding.suggested_fix && (
          <div className="callout__fix">{finding.suggested_fix}</div>
        )}
      </div>

      <div className="callout__meta">
        <div>{finding.detector}</div>
        <div>{finding.sheet}</div>
        {finding.column && (
          <div style={{ color: "var(--ink-3)" }}>{finding.column}</div>
        )}
        {rowLabel && <div>{rowLabel}</div>}
      </div>
    </article>
  );
}
