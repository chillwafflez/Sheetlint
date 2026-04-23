"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ApiError, submitAnalysis } from "@/lib/api";
import type { AnalysisConfig, JobCreated } from "@/lib/schemas";

/**
 * Submit an AnalysisConfig (preview_id + selected sheets + detectors) and
 * navigate to the job polling page on 202.
 */
export function useSubmitAnalysis() {
  const router = useRouter();

  return useMutation<JobCreated, Error, AnalysisConfig>({
    mutationFn: submitAnalysis,
    onSuccess: (job) => {
      router.push(`/analysis/${job.id}`);
    },
    onError: (error) => {
      const message =
        error instanceof ApiError
          ? `Submission failed (${error.status}): ${error.message}`
          : error.message || "Submission failed";
      toast.error(message);
    },
  });
}
