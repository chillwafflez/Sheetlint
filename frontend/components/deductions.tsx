export function Deductions({
  breakdown,
}: {
  breakdown: Record<string, number>;
}) {
  const entries = Object.entries(breakdown)
    .filter(([, pts]) => pts > 0)
    .sort(([, a], [, b]) => b - a);

  if (entries.length === 0) {
    return (
      <div className="deductions">
        <div className="deductions__title">
          <span>Points deducted by detector</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
          Clean file — no points deducted.
        </div>
      </div>
    );
  }

  const max = Math.max(...entries.map(([, v]) => v));

  return (
    <div className="deductions">
      <div className="deductions__title">
        <span>Points deducted by detector</span>
        <span
          className="mono"
          style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 400 }}
        >
          /100
        </span>
      </div>
      {entries.map(([detector, pts]) => (
        <div
          key={detector}
          className="deduction-row"
          style={
            {
              "--pct": `${(pts / max) * 100}%`,
            } as React.CSSProperties
          }
        >
          <div className="deduction-row__label">{detector}</div>
          <div className="deduction-row__bar" />
          <div className="deduction-row__val">−{pts.toFixed(1)}</div>
        </div>
      ))}
    </div>
  );
}
