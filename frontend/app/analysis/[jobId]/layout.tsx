"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";

import { AnalysisNav } from "@/components/analysis-nav";
import { JobStatusBanner } from "@/components/job-status-banner";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useJob } from "@/hooks/use-job";
import { ApiError } from "@/lib/api";

export default function AnalysisLayout({ children }: { children: ReactNode }) {
  const { jobId } = useParams<{ jobId: string }>();
  const { data: job, isLoading, error } = useJob(jobId);

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  if (error) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <h2 className="text-xl font-semibold">
          {notFound ? "Job not found" : "Couldn't load this job"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {notFound
            ? "The job may have expired or the link is invalid."
            : error.message}
        </p>
        <Link
          href="/"
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          Upload a new file
        </Link>
      </div>
    );
  }

  if (!job) return null;

  const ready = job.status === "succeeded" && job.result !== null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3" />
            Upload another
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {job.filename}
          </h1>
        </div>
        {ready && job.result ? (
          <Badge variant="secondary" className="text-sm">
            Grade {job.result.trust_score.grade}
          </Badge>
        ) : null}
      </header>

      <JobStatusBanner job={job} />

      {ready ? (
        <>
          <AnalysisNav jobId={jobId} />
          {children}
        </>
      ) : null}
    </div>
  );
}
