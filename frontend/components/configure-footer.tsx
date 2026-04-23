"use client";

import { ArrowIcon } from "@/components/icons";

type ConfigureFooterProps = {
  sheetCount: number;
  detectorCount: number;
  canRun: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onRun: () => void;
};

export function ConfigureFooter({
  sheetCount,
  detectorCount,
  canRun,
  isSubmitting,
  onCancel,
  onRun,
}: ConfigureFooterProps) {
  return (
    <div className="config-footer">
      <div className="config-footer__summary">
        Inspecting <strong>{sheetCount}</strong> worksheet
        {sheetCount === 1 ? "" : "s"} with <strong>{detectorCount}</strong>{" "}
        detector{detectorCount === 1 ? "" : "s"}.{" "}
        <span style={{ color: "var(--ink-3)" }}>Typical: 8–14 s.</span>
      </div>

      <div className="config-footer__actions">
        <button
          type="button"
          className="btn"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="button"
          className={`btn btn--accent ${canRun ? "" : "btn--disabled"}`}
          disabled={!canRun || isSubmitting}
          onClick={onRun}
        >
          {isSubmitting ? "Submitting…" : "Run inspection"} <ArrowIcon />
        </button>
      </div>
    </div>
  );
}
