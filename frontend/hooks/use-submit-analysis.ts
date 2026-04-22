"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ApiError, submitAnalysis } from "@/lib/api";
import type { JobCreated } from "@/lib/schemas";

/**
 * Upload a workbook and navigate to its polling page on success.
 * Consumers call `mutate(file)` and observe `isPending` for button state.
 */
export function useSubmitAnalysis() {
  const router = useRouter();

  return useMutation<JobCreated, Error, File>({
    mutationFn: submitAnalysis,
    onSuccess: (job) => {
      router.push(`/analysis/${job.id}`);
    },
    onError: (error) => {
      const message =
        error instanceof ApiError
          ? `Upload failed (${error.status}): ${error.message}`
          : error.message || "Upload failed";
      toast.error(message);
    },
  });
}
