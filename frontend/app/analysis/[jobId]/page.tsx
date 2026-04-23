"use client";

import { useParams } from "next/navigation";
import { useMemo } from "react";

import { Callout } from "@/components/callout";
import { Deductions } from "@/components/deductions";
import { SeverityKpis } from "@/components/severity-kpis";
import { TrustScoreCard } from "@/components/trust-score-card";
import { useJob } from "@/hooks/use-job";
import type { Finding } from "@/lib/schemas";

const MAX_WARNING_PREVIEW = 3;

export default function OverviewPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { data: job } = useJob(jobId);
  const result = job?.result;

  const criticals = useMemo(
    () => result?.findings.filter((f) => f.severity === "critical") ?? [],
    [result],
  );
  const warnings = useMemo(
    () => result?.findings.filter((f) => f.severity === "warning") ?? [],
    [result],
  );

  if (!result) return null;

  return (
    <>
      <div className="overview-grid">
        <TrustScoreCard trustScore={result.trust_score} />
        <div className="overview-right">
          <SeverityKpis trustScore={result.trust_score} />
          <Deductions breakdown={result.trust_score.breakdown} />
        </div>
      </div>

      <CriticalSection findings={criticals} />
      <WarningSection findings={warnings} />
    </>
  );
}

function CriticalSection({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) return null;

  return (
    <>
      <div className="section-label">
        <div className="section-label__lead">
          <span className="section-label__num">CRITICAL</span>
          <span className="section-label__title">
            {findings.length} issue{findings.length === 1 ? "" : "s"} will block
            clean ingestion
          </span>
        </div>
        <div className="section-label__body">
          Fix these before piping this file into anything downstream.
        </div>
      </div>

      <div className="callout-list">
        {findings.map((finding, i) => (
          <Callout key={calloutKey(finding, i)} finding={finding} />
        ))}
      </div>
    </>
  );
}

function WarningSection({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) return null;
  const preview = findings.slice(0, MAX_WARNING_PREVIEW);

  return (
    <>
      <div className="section-label">
        <div className="section-label__lead">
          <span className="section-label__num">NOTABLE</span>
          <span className="section-label__title">
            Warnings worth a second look
          </span>
        </div>
        <div className="section-label__body">
          Not blocking, but likely to cause downstream headaches if ignored.
        </div>
      </div>

      <div className="callout-list">
        {preview.map((finding, i) => (
          <Callout key={calloutKey(finding, i)} finding={finding} />
        ))}
      </div>
    </>
  );
}

function calloutKey(finding: Finding, index: number): string {
  return `${finding.detector}-${finding.sheet}-${finding.column ?? "col"}-${index}`;
}
