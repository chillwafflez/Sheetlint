"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ApiError, createPreview } from "@/lib/api";
import type { AnalysisPreview } from "@/lib/schemas";

/**
 * Upload a workbook to /analysis/preview and navigate to the Configure
 * screen on success. Consumers call `mutate(file)` and observe `isPending`
 * for button state.
 */
export function useCreatePreview() {
  const router = useRouter();

  return useMutation<AnalysisPreview, Error, File>({
    mutationFn: createPreview,
    onSuccess: (preview) => {
      router.push(`/configure/${preview.preview_id}`);
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
