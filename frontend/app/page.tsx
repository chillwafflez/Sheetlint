import { FileSpreadsheet, Sparkles, TrendingUp } from "lucide-react";

import { UploadZone } from "@/components/upload-zone";

const FEATURES = [
  {
    Icon: FileSpreadsheet,
    title: "Structural & statistical",
    body: "Merged cells, mid-sheet headers, formula errors, type drift, regex coverage, fuzzy near-duplicates.",
  },
  {
    Icon: TrendingUp,
    title: "Time-series anomalies",
    body: "Rolling z-score spikes and STUMPY matrix-profile discords ensembled per (date, numeric) column pair.",
  },
  {
    Icon: Sparkles,
    title: "Claude semantic checks",
    body: "Per-column prompt-cached review of whether the header matches the content, and which values don't fit.",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-3xl space-y-10">
        <header className="space-y-3 text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Sheetlint
          </h1>
          <p className="text-balance text-lg text-muted-foreground">
            Pre-handoff data quality inspector for messy, human-entered Excel
            files. Catch issues before they become pipeline failures.
          </p>
        </header>

        <UploadZone />

        <section className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map(({ Icon, title, body }) => (
            <div key={title} className="space-y-2">
              <Icon className="size-5 text-blue-600 dark:text-blue-400" />
              <div className="text-sm font-medium">{title}</div>
              <p className="text-xs text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
