import { TimeSeriesChart } from "@/components/time-series-chart";
import {
  timeSeriesMetadataSchema,
  type AnomalyResult,
} from "@/lib/schemas";

function summarize(zCount: number, mpCount: number): string {
  const parts: string[] = [];
  if (zCount > 0) parts.push(`${zCount} z-score spike${zCount === 1 ? "" : "s"}`);
  if (mpCount > 0)
    parts.push(
      `${mpCount} matrix-profile discord${mpCount === 1 ? "" : "s"}`,
    );
  if (parts.length === 0) return "No anomalies flagged in the ensemble.";
  return `Ensemble: ${parts.join(", ")}.`;
}

export function TsCard({ anomaly }: { anomaly: AnomalyResult }) {
  const parsed = timeSeriesMetadataSchema.safeParse(anomaly.metadata);

  return (
    <article className="ts-card">
      <header className="ts-card__head">
        <div>
          <div className="ts-card__title">{anomaly.series_name}</div>
          <div className="ts-card__sub">
            {parsed.success
              ? summarize(
                  parsed.data.z_flagged.length,
                  parsed.data.mp_flagged.length,
                )
              : anomaly.explanation}
          </div>
        </div>

        {parsed.success && (
          <div className="ts-card__legend">
            <span>
              <span className="sw" />
              value
            </span>
            {parsed.data.mp_flagged.length > 0 && (
              <span>
                <span className="swx" />
                discord
              </span>
            )}
            {parsed.data.z_flagged.length > 0 && (
              <span>
                <span className="swo" />
                z-spike
              </span>
            )}
          </div>
        )}
      </header>

      {parsed.success ? (
        <TimeSeriesChart metadata={parsed.data} />
      ) : (
        <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
          Chart data unavailable for this series.
        </div>
      )}
    </article>
  );
}
