"use client";

import { useQuery } from "@tanstack/react-query";

import { ApiError, getPreview } from "@/lib/api";
import type { AnalysisPreview } from "@/lib/schemas";

/**
 * Read a staged preview by id. 404 halts retry — the preview expired or
 * was consumed by a prior /analysis submission.
 */
export function usePreview(previewId: string) {
  return useQuery<AnalysisPreview, Error>({
    queryKey: ["preview", previewId],
    queryFn: () => getPreview(previewId),
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false;
      return failureCount < 2;
    },
    // Previews are short-lived and never mutate — avoid background refetches.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
