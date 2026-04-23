"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";

import { ReportHeader } from "@/components/report-header";
import { ReportTabs } from "@/components/report-tabs";
import { ScanningView } from "@/components/scanning-view";
import { useJob } from "@/hooks/use-job";
import { ApiError } from "@/lib/api";
import { downloadFindingsCsv } from "@/lib/csv";

export default function AnalysisLayout({ children }: { children: ReactNode }) {
  const { jobId } = useParams<{ jobId: string }>();
  const { data: job, isLoading, error } = useJob(jobId);

  if (isLoading) {
    return <ScanningView filename="workbook" done={false} />;
  }

  if (error) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className="screen screen--narrow">
        <div className="empty-state">
          <h3>{notFound ? "Job not found" : "Couldn't load this job"}</h3>
          <p>
            {notFound
              ? "The job may have expired or the link is invalid."
              : error.message}
          </p>
          <Link href="/" className="btn btn--primary" style={{ marginTop: 16 }}>
            Upload a new file
          </Link>
        </div>
      </div>
    );
  }

  if (!job) return null;

  if (job.status === "failed") {
    return (
      <div className="screen screen--narrow">
        <div className="empty-state">
          <h3>Inspection failed</h3>
          <p>{job.error ?? "The detector stack crashed mid-run."}</p>
          <Link href="/" className="btn btn--primary" style={{ marginTop: 16 }}>
            Try another file
          </Link>
        </div>
      </div>
    );
  }

  if (job.status !== "succeeded" || !job.result) {
    return <ScanningView filename={job.filename} done={false} />;
  }

  const result = job.result;
  const scanSeconds =
    new Date(job.updated_at).getTime() - new Date(job.created_at).getTime();

  return (
    <div className="screen">
      <ReportHeader
        result={result}
        scanSeconds={scanSeconds > 0 ? scanSeconds / 1000 : null}
        onDownload={() => downloadFindingsCsv(result.findings, result.filename)}
      />
      <ReportTabs
        jobId={jobId}
        issueCount={result.findings.length}
        anomalyCount={result.anomalies.length}
      />
      {children}
    </div>
  );
}
