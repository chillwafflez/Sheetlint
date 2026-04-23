import type { TrustScore } from "@/lib/schemas";

const CARDS = [
  {
    key: "critical",
    label: "Critical",
    dot: "sev-dot--critical",
    delta: "block ingestion",
  },
  {
    key: "warning",
    label: "Warnings",
    dot: "sev-dot--warn",
    delta: "review recommended",
  },
  {
    key: "info",
    label: "Info",
    dot: "sev-dot--info",
    delta: "heads-up only",
  },
] as const;

export function SeverityKpis({ trustScore }: { trustScore: TrustScore }) {
  return (
    <div className="kpis">
      {CARDS.map(({ key, label, dot, delta }) => (
        <div key={key} className="kpi">
          <div className="kpi__label">
            <span className={`sev-dot ${dot}`} />
            {label}
          </div>
          <div className="kpi__value">{trustScore.by_severity[key] ?? 0}</div>
          <div className="kpi__delta">{delta}</div>
        </div>
      ))}
    </div>
  );
}
