"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Simulates a streaming detector log while the backend works.
 *
 * The FastAPI stack runs the detectors as a batch — no SSE stream — but the
 * UX win from "you can see it working" is large, so this hook cycles through
 * a pre-written script timed to the typical 8–14 s job duration. Progress
 * jumps to 100 once `done` is true (derived, not written from an effect).
 */

const LOG_SCRIPT: ReadonlyArray<readonly [string, string]> = [
  ["parse", "parse workbook — scanning sheets"],
  ["struct", "sweeping merged cells and hidden sheets"],
  ["struct", "formula-error sweep"],
  ["stats", "profiling columns — type purity, regex coverage"],
  ["stats", "outlier sweep against rolling median"],
  ["dup", "hashing rows for exact duplicates"],
  ["dup", "fuzzy pass on ID-like columns"],
  ["ts", "matrix-profile over (date, numeric) pairs"],
  ["ts", "rolling z-score for spike detection"],
  ["ai", "claude review — per-column header/content match"],
  ["score", "scoring and bucketing findings"],
  ["done", "finalizing report"],
] as const;

export type ScanLine = {
  ts: string;
  tag: string;
  msg: string;
};

const STEP_MS = 900;
const MAX_TICK_PROGRESS = 95;

export function useScanLog(done: boolean) {
  const [lines, setLines] = useState<ScanLine[]>([]);
  const [tickProgress, setTickProgress] = useState(0);
  const indexRef = useRef(0);

  useEffect(() => {
    if (done) return;

    const interval = setInterval(() => {
      const i = indexRef.current;
      if (i >= LOG_SCRIPT.length) return;

      const [tag, msg] = LOG_SCRIPT[i];
      const ts = new Date().toISOString().slice(11, 19);
      const next = i + 1;
      indexRef.current = next;

      setLines((prev) => [...prev, { ts, tag, msg }]);
      setTickProgress(
        Math.min(
          MAX_TICK_PROGRESS,
          Math.round((next / LOG_SCRIPT.length) * MAX_TICK_PROGRESS),
        ),
      );
    }, STEP_MS);

    return () => clearInterval(interval);
  }, [done]);

  const progress = done ? 100 : tickProgress;
  return { lines, progress };
}
