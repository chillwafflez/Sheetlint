"use client";

import { useQuery } from "@tanstack/react-query";

import { ApiError, getJob } from "@/lib/api";
import type { Job } from "@/lib/schemas";

const POLL_MS = 500;

/**
 * Poll a job until it reaches a terminal state. Stops polling once the job
 * is `succeeded` or `failed`; a 404 also halts (no such job).
 */
export function useJob(jobId: string) {
  return useQuery<Job, Error>({
    queryKey: ["job", jobId],
    queryFn: () => getJob(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "succeeded" || status === "failed") return false;
      return POLL_MS;
    },
    refetchIntervalInBackground: false,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false;
      return failureCount < 2;
    },
  });
}
