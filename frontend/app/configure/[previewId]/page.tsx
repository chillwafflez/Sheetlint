"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ConfigureFooter } from "@/components/configure-footer";
import { DetectorPicker } from "@/components/detector-picker";
import { ArrowBackIcon, DocIcon, SparkleIcon } from "@/components/icons";
import { PreviewStrip } from "@/components/preview-strip";
import { SheetPicker } from "@/components/sheet-picker";
import { usePreview } from "@/hooks/use-preview";
import { useSubmitAnalysis } from "@/hooks/use-submit-analysis";
import { ApiError } from "@/lib/api";
import type { AnalysisPreview, DetectorId } from "@/lib/schemas";

const DEFAULT_DETECTORS: readonly DetectorId[] = [
  "structural",
  "statistical",
  "duplicates",
  "timeseries",
] as const;

export default function ConfigurePage() {
  const { previewId } = useParams<{ previewId: string }>();
  const { data: preview, isLoading, error } = usePreview(previewId);

  if (isLoading) {
    return <ConfigureSkeleton />;
  }

  if (error) {
    const expired = error instanceof ApiError && error.status === 404;
    return (
      <div className="screen screen--narrow">
        <div className="empty-state">
          <h3>{expired ? "Preview expired" : "Couldn't load this preview"}</h3>
          <p>
            {expired
              ? "Previews expire after 30 minutes or once they've been submitted for analysis. Upload the file again to continue."
              : error.message}
          </p>
          <Link
            href="/"
            className="btn btn--primary"
            style={{ marginTop: 16 }}
          >
            Upload again
          </Link>
        </div>
      </div>
    );
  }

  if (!preview) return null;

  return <ConfigureView preview={preview} />;
}

function ConfigureView({ preview }: { preview: AnalysisPreview }) {
  const router = useRouter();
  const { mutate: submit, isPending } = useSubmitAnalysis();

  const visibleSheets = useMemo(
    () => preview.sheets.filter((sheet) => !sheet.hidden),
    [preview.sheets],
  );

  const [includeHidden, setIncludeHidden] = useState(false);
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(
    () => new Set(visibleSheets.map((s) => s.name)),
  );
  const [selectedDetectors, setSelectedDetectors] = useState<Set<DetectorId>>(
    () => new Set(DEFAULT_DETECTORS),
  );

  const displayedSheets = includeHidden ? preview.sheets : visibleSheets;

  function toggleSheet(name: string) {
    setSelectedSheets((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleDetector(id: DetectorId) {
    setSelectedDetectors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedSheets(new Set(visibleSheets.map((s) => s.name)));
  }

  function clearSheets() {
    setSelectedSheets(new Set());
  }

  const sheetCount = selectedSheets.size;
  const detectorCount = selectedDetectors.size;
  const canRun = sheetCount > 0 && detectorCount > 0;

  const singleSelectedSheet =
    sheetCount === 1
      ? preview.sheets.find((s) => selectedSheets.has(s.name))
      : undefined;

  function handleRun() {
    if (!canRun) return;
    submit({
      preview_id: preview.preview_id,
      sheets: [...selectedSheets],
      detectors: [...selectedDetectors],
    });
  }

  return (
    <div className="screen">
      <div className="config-head">
        <div>
          <div className="config-head__eyebrow">Inspection setup</div>
          <h2>What should we look at?</h2>
          <span className="file-pill">
            <DocIcon /> {preview.filename}
          </span>
        </div>
        <Link href="/" className="btn btn--ghost">
          <ArrowBackIcon /> Upload another
        </Link>
      </div>

      <div className="section-label" style={{ marginTop: 0 }}>
        <div className="section-label__lead">
          <span className="section-label__num">STEP 01</span>
          <span className="section-label__title">
            Choose worksheets to inspect
          </span>
        </div>
        <div className="section-label__body">
          Pick the tabs you actually care about. Skipping non-tabular notes,
          lookup sheets, or archives makes the report far more readable.
        </div>
      </div>

      <SheetPicker
        sheets={displayedSheets}
        selected={selectedSheets}
        onToggle={toggleSheet}
      />

      <div className="sheet-controls">
        <label>
          <input
            type="checkbox"
            checked={includeHidden}
            onChange={(e) => setIncludeHidden(e.target.checked)}
          />
          Show hidden worksheets
        </label>
        <span>·</span>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={selectAllVisible}
        >
          Select all visible
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={clearSheets}
        >
          Clear
        </button>
        {singleSelectedSheet && (
          <span className="sheet-controls__preview-note">
            Preview: first {singleSelectedSheet.preview.rows.length} row
            {singleSelectedSheet.preview.rows.length === 1 ? "" : "s"} of{" "}
            <span className="mono">{singleSelectedSheet.name}</span>
          </span>
        )}
      </div>

      {singleSelectedSheet && (
        <PreviewStrip preview={singleSelectedSheet.preview} />
      )}

      <div className="section-label">
        <div className="section-label__lead">
          <span className="section-label__num">STEP 02</span>
          <span className="section-label__title">
            Pick which detectors to run
          </span>
        </div>
        <div className="section-label__body">
          Each detector runs independently. Toggle off the ones you don&apos;t
          need — fewer detectors means a shorter, more focused report.
        </div>
      </div>

      <DetectorPicker
        selected={selectedDetectors}
        onToggle={toggleDetector}
      />

      {selectedDetectors.has("ai") && (
        <div className="ai-callout">
          <SparkleIcon style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Claude semantic checks</strong> call the API once per
            unique column header (prompt-cached with
            {" "}
            <span className="mono">claude-opus-4-7</span>). Disable to keep
            the run free and local-only.
          </div>
        </div>
      )}

      <ConfigureFooter
        sheetCount={sheetCount}
        detectorCount={detectorCount}
        canRun={canRun}
        isSubmitting={isPending}
        onCancel={() => router.push("/")}
        onRun={handleRun}
      />
    </div>
  );
}

function ConfigureSkeleton() {
  return (
    <div className="screen">
      <div className="config-head">
        <div>
          <div className="config-head__eyebrow">Inspection setup</div>
          <h2>Reading workbook…</h2>
        </div>
      </div>
      <div style={{ color: "var(--ink-3)", fontSize: 13 }}>
        Parsing the file and gathering worksheet metadata.
      </div>
    </div>
  );
}
