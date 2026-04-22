import { AlertOctagon, Loader2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { Job } from "@/lib/schemas";

export function JobStatusBanner({ job }: { job: Job }) {
  if (job.status === "pending" || job.status === "running") {
    return (
      <Card className="border-blue-200 bg-blue-50/60 dark:border-blue-900/50 dark:bg-blue-900/20">
        <CardContent className="flex items-center gap-3 p-4 text-sm">
          <Loader2 className="size-4 animate-spin text-blue-600 dark:text-blue-400" />
          <div>
            <div className="font-medium text-blue-900 dark:text-blue-100">
              Inspecting {job.filename}…
            </div>
            <div className="text-xs text-blue-700/80 dark:text-blue-300/80">
              {job.status === "pending"
                ? "Queued — the detector stack is about to start."
                : "Running every detector against the workbook."}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (job.status === "failed") {
    return (
      <Card className="border-red-200 bg-red-50/60 dark:border-red-900/50 dark:bg-red-900/20">
        <CardContent className="flex items-start gap-3 p-4 text-sm">
          <AlertOctagon className="mt-0.5 size-4 text-red-600 dark:text-red-400" />
          <div>
            <div className="font-medium text-red-900 dark:text-red-100">
              Inspection failed
            </div>
            <div className="text-xs text-red-700/80 dark:text-red-300/80">
              {job.error ?? "Unknown error. Try re-uploading the file."}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
