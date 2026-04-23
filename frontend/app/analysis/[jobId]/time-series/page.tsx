"use client";

import { useParams } from "next/navigation";

import { TsCard } from "@/components/ts-card";
import { useJob } from "@/hooks/use-job";

export default function TimeSeriesPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { data: job } = useJob(jobId);
  const anomalies = job?.result?.anomalies ?? [];

  if (anomalies.length === 0) {
    return (
      <div className="empty-state">
        <h3>No time-series columns detected.</h3>
        <div>
          Time-series detection needs a date column paired with a numeric
          column holding at least 20 points.
        </div>
      </div>
    );
  }

  return (
    <div>
      {anomalies.map((anomaly, i) => (
        <TsCard
          key={`${anomaly.series_name}-${i}`}
          anomaly={anomaly}
        />
      ))}
    </div>
  );
}
