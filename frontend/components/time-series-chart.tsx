import type { TimeSeriesMetadata } from "@/lib/schemas";

/**
 * Inline-SVG time-series chart.
 *
 * Replaces the prior Plotly-based chart — the design's visual vocabulary
 * (polyline, warn-ringed z-spikes, critical X discord markers, muted tick
 * axes) reads better hand-drawn than routed through Plotly's layout engine,
 * and drops ~1 MB of client bundle.
 */

const WIDTH = 1080;
const HEIGHT = 220;
const PAD = { l: 44, r: 16, t: 12, b: 32 };
const INNER = {
  w: WIDTH - PAD.l - PAD.r,
  h: HEIGHT - PAD.t - PAD.b,
};
const X_TICK_COUNT = 7;
const Y_TICK_COUNT = 5;

function formatY(value: number): string {
  if (Math.abs(value) >= 1000) return `${Math.round(value / 1000)}k`;
  if (Math.abs(value) >= 10) return value.toFixed(0);
  return value.toFixed(1);
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(5, 10);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function TimeSeriesChart({
  metadata,
}: {
  metadata: TimeSeriesMetadata;
}) {
  const { values, dates, z_flagged: zFlagged, mp_flagged: mpFlagged } = metadata;
  const n = values.length;

  if (n === 0) {
    return (
      <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
        No points in this series.
      </div>
    );
  }

  const maxV = Math.max(...values) * 1.05;
  const minV = Math.min(0, ...values);
  const range = maxV - minV || 1;

  const x = (i: number) =>
    PAD.l + (n === 1 ? INNER.w / 2 : (i / (n - 1)) * INNER.w);
  const y = (v: number) => PAD.t + INNER.h - ((v - minV) / range) * INNER.h;

  const pointsPath = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const fillPath = `${PAD.l},${y(minV)} ${pointsPath} ${x(n - 1)},${y(minV)}`;

  const yTicks = Array.from({ length: Y_TICK_COUNT }, (_, i) =>
    minV + (range * i) / (Y_TICK_COUNT - 1),
  );
  const xTicks = Array.from({ length: X_TICK_COUNT }, (_, i) =>
    Math.round((i / (X_TICK_COUNT - 1)) * (n - 1)),
  );

  return (
    <svg
      className="ts-chart"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Time-series chart"
    >
      {yTicks.map((tick, i) => (
        <g key={`y-${i}`}>
          <line
            x1={PAD.l}
            x2={WIDTH - PAD.r}
            y1={y(tick)}
            y2={y(tick)}
            stroke="var(--rule)"
            strokeWidth={1}
            strokeDasharray={i === 0 ? "0" : "2 3"}
          />
          <text
            x={PAD.l - 8}
            y={y(tick) + 4}
            fontSize={10}
            fill="var(--ink-3)"
            fontFamily="var(--font-jetbrains-mono)"
            textAnchor="end"
          >
            {formatY(tick)}
          </text>
        </g>
      ))}

      {xTicks.map((idx, i) => (
        <text
          key={`x-${i}`}
          x={x(idx)}
          y={HEIGHT - 10}
          fontSize={10}
          fill="var(--ink-3)"
          fontFamily="var(--font-jetbrains-mono)"
          textAnchor="middle"
        >
          {formatDate(dates[idx])}
        </text>
      ))}

      <polygon points={fillPath} fill="var(--accent)" opacity={0.07} />
      <polyline
        points={pointsPath}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />

      {zFlagged.map((idx) =>
        idx >= 0 && idx < n ? (
          <circle
            key={`z-${idx}`}
            cx={x(idx)}
            cy={y(values[idx])}
            r={4}
            fill="none"
            stroke="var(--warn)"
            strokeWidth={1.5}
          />
        ) : null,
      )}

      {mpFlagged.map((idx) => {
        if (idx < 0 || idx >= n) return null;
        const cx = x(idx);
        const cy = y(values[idx]);
        return (
          <g
            key={`mp-${idx}`}
            stroke="var(--critical)"
            strokeWidth={2}
            strokeLinecap="round"
          >
            <line x1={cx - 5} y1={cy - 5} x2={cx + 5} y2={cy + 5} />
            <line x1={cx - 5} y1={cy + 5} x2={cx + 5} y2={cy - 5} />
          </g>
        );
      })}
    </svg>
  );
}
