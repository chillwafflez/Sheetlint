const FEATURES = [
  {
    num: "01 / STRUCTURAL",
    title: "Shape & layout",
    body: "Merged cells, multi-row headers, formula errors, hidden sheets, empty columns, orphan cells outside the data region.",
  },
  {
    num: "02 / STATISTICAL",
    title: "Column profiling",
    body: "Type purity, null density, regex coverage for dates / emails / IDs, outliers, and cardinality anomalies.",
  },
  {
    num: "03 / DUPLICATES",
    title: "Exact & fuzzy",
    body: "Catches near-miss IDs like POL-01001 vs POL-0100l — the ones that silently corrupt joins.",
  },
  {
    num: "04 / TIME-SERIES",
    title: "Anomaly detection",
    body: "Rolling z-score spikes and STUMPY matrix-profile discords over any date × numeric column pair.",
  },
  {
    num: "05 / SEMANTIC",
    title: "Claude review",
    body: "Prompt-cached per-column review: does the header match the content? Flags issues regex can't see.",
  },
] as const;

export function FeaturesStrip() {
  return (
    <section className="features">
      {FEATURES.map((feature) => (
        <div key={feature.num} className="feature">
          <div className="feature__num">{feature.num}</div>
          <div className="feature__title">{feature.title}</div>
          <div className="feature__body">{feature.body}</div>
        </div>
      ))}
    </section>
  );
}
