"use client";

import { useParams } from "next/navigation";

import { TimeSeriesChart } from "@/components/time-series-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useJob } from "@/hooks/use-job";
import {
  type AnomalyResult,
  timeSeriesMetadataSchema,
} from "@/lib/schemas";

export default function TimeSeriesPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { data: job } = useJob(jobId);
  const anomalies = job?.result?.anomalies ?? [];

  if (anomalies.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No time-series columns detected in this file. Time-series detection
          requires a date column paired with a numeric column holding at least
          20 points.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {anomalies.map((anomaly, i) => (
        <AnomalyPanel key={`${anomaly.series_name}-${i}`} anomaly={anomaly} />
      ))}
    </div>
  );
}

function AnomalyPanel({ anomaly }: { anomaly: AnomalyResult }) {
  const parsed = timeSeriesMetadataSchema.safeParse(anomaly.metadata);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{anomaly.series_name}</CardTitle>
        <p className="text-xs text-muted-foreground">{anomaly.explanation}</p>
      </CardHeader>
      <CardContent>
        {parsed.success ? (
          <TimeSeriesChart metadata={parsed.data} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Chart data unavailable for this series.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
