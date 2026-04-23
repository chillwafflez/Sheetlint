"use client";

import { useEffect, useRef } from "react";

import { useScanLog } from "@/hooks/use-scan-log";

const MAX_LINES = 12;

export function ScanningView({
  filename,
  done,
}: {
  filename: string;
  done: boolean;
}) {
  const { lines, progress } = useScanLog(done);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const recent = lines.slice(-MAX_LINES);

  return (
    <div className="screen screen--narrow">
      <div className="scanning">
        <div className="spinner" aria-hidden />
        <h2>
          Inspecting <span className="mono" style={{ fontSize: 22 }}>{filename}</span>
        </h2>
        <div className="scanning__sub">
          Running the detector stack. Progress is approximate while the backend
          works.
        </div>

        <div className="scan-progress" aria-label="scan progress">
          <div className="scan-progress__bar" style={{ width: `${progress}%` }} />
        </div>

        <div className="scan-list" ref={scrollRef} role="log" aria-live="polite">
          {recent.length === 0 ? (
            <div className="scan-line">
              <span className="scan-line__ts bounce">──────</span>
              <span className="scan-line__tag bounce">[init]</span>
              <span className="scan-line__msg bounce">warming detectors…</span>
            </div>
          ) : (
            recent.map((line, i) => (
              <div className="scan-line" key={`${line.tag}-${lines.length - recent.length + i}`}>
                <span className="scan-line__ts">{line.ts}</span>
                <span className="scan-line__tag">[{line.tag}]</span>
                <span className="scan-line__msg">{line.msg}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
