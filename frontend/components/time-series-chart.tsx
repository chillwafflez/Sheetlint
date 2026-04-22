"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";
import type { TimeSeriesMetadata } from "@/lib/schemas";

// Plotly is ~1MB; keep it out of the main bundle and off the server.
const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
  loading: () => <Skeleton className="h-[360px] w-full" />,
});

export function TimeSeriesChart({ metadata }: { metadata: TimeSeriesMetadata }) {
  const { dates, values, z_flagged: zFlagged, mp_flagged: mpFlagged } = metadata;

  const valueTrace = {
    x: dates,
    y: values,
    mode: "lines" as const,
    name: "Value",
    line: { color: "#2563EB", width: 1.6 },
    type: "scatter" as const,
  };

  const zTrace = {
    x: zFlagged.map((i) => dates[i]).filter(Boolean),
    y: zFlagged.map((i) => values[i]).filter((v) => v !== undefined),
    mode: "markers" as const,
    name: "Z-score spike",
    marker: {
      color: "#F59E0B",
      size: 10,
      symbol: "circle-open",
      line: { width: 2 },
    },
    type: "scatter" as const,
  };

  const mpTrace = {
    x: mpFlagged.map((i) => dates[i]).filter(Boolean),
    y: mpFlagged.map((i) => values[i]).filter((v) => v !== undefined),
    mode: "markers" as const,
    name: "Matrix-profile discord",
    marker: {
      color: "#DC2626",
      size: 12,
      symbol: "x",
      line: { width: 2 },
    },
    type: "scatter" as const,
  };

  const data = [
    valueTrace,
    ...(zTrace.x.length > 0 ? [zTrace] : []),
    ...(mpTrace.x.length > 0 ? [mpTrace] : []),
  ];

  return (
    <Plot
      data={data}
      layout={{
        height: 360,
        margin: { l: 48, r: 20, t: 10, b: 40 },
        legend: { orientation: "h", y: -0.18 },
        hovermode: "x unified",
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        font: { family: "inherit", size: 12 },
        xaxis: { gridcolor: "rgba(148,163,184,0.2)" },
        yaxis: { gridcolor: "rgba(148,163,184,0.2)" },
      }}
      config={{ displayModeBar: false, responsive: true }}
      useResizeHandler
      style={{ width: "100%" }}
    />
  );
}
