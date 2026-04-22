"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";

import { FindingCard } from "@/components/finding-card";
import { SeverityKpis } from "@/components/severity-kpis";
import { TrustScoreCard } from "@/components/trust-score-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useJob } from "@/hooks/use-job";
import type { Finding } from "@/lib/schemas";

const MAX_CRITICAL_PREVIEW = 5;

export default function OverviewPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { data: job } = useJob(jobId);
  const result = job?.result;

  const criticalFindings = useMemo(
    () => result?.findings.filter((f) => f.severity === "critical") ?? [],
    [result],
  );

  const aiFindings = useMemo(
    () => result?.findings.filter((f) => f.detector === "AI") ?? [],
    [result],
  );

  if (!result) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <TrustScoreCard trustScore={result.trust_score} />

        <div className="flex flex-col gap-4">
          <SeverityKpis trustScore={result.trust_score} />
          <DetectorBreakdown breakdown={result.trust_score.breakdown} />
        </div>
      </div>

      <CriticalFindings findings={criticalFindings} />

      {aiFindings.length > 0 ? <AiInsights findings={aiFindings} /> : null}
    </div>
  );
}

function DetectorBreakdown({ breakdown }: { breakdown: Record<string, number> }) {
  const entries = Object.entries(breakdown).sort(([, a], [, b]) => b - a);
  const max = Math.max(1, ...entries.map(([, v]) => v));

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Clean file — no points deducted.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Points deducted per detector</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5 pb-5">
        {entries.map(([detector, points]) => (
          <div key={detector} className="space-y-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium">{detector}</span>
              <span className="tabular-nums text-muted-foreground">
                {points.toFixed(1)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-blue-600 dark:bg-blue-400"
                style={{ width: `${(points / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CriticalFindings({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Critical issues</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No critical issues.
        </CardContent>
      </Card>
    );
  }

  const shown = findings.slice(0, MAX_CRITICAL_PREVIEW);
  const extra = findings.length - shown.length;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold">
          {findings.length} critical issue{findings.length === 1 ? "" : "s"}
        </h2>
        {extra > 0 ? (
          <span className="text-xs text-muted-foreground">
            +{extra} more on the Issues tab
          </span>
        ) : null}
      </div>

      <div className="space-y-2">
        {shown.map((finding, i) => (
          <FindingCard
            key={`${finding.detector}-${finding.sheet}-${finding.column ?? i}`}
            finding={finding}
          />
        ))}
      </div>
    </section>
  );
}

function AiInsights({ findings }: { findings: Finding[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">AI semantic findings</h2>
      <div className="space-y-2">
        {findings.map((finding, i) => (
          <FindingCard
            key={`ai-${finding.column ?? finding.sheet}-${i}`}
            finding={finding}
          />
        ))}
      </div>
    </section>
  );
}
