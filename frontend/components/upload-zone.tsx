"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { toast } from "sonner";

import { DocIcon } from "@/components/icons";
import { useSubmitAnalysis } from "@/hooks/use-submit-analysis";

const ACCEPTED_EXTENSIONS = [".xlsx"] as const;
const MAX_MB = 50;

function isAccepted(file: File): boolean {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export function UploadZone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [stagedName, setStagedName] = useState<string | null>(null);
  const { mutate, isPending } = useSubmitAnalysis();

  function submit(file: File | null | undefined) {
    if (!file) return;
    if (!isAccepted(file)) {
      toast.error("Only .xlsx files are supported.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`File exceeds the ${MAX_MB} MB limit.`);
      return;
    }
    setStagedName(file.name);
    mutate(file);
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    submit(event.target.files?.[0]);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    submit(event.dataTransfer.files?.[0]);
  }

  const busy = isPending;
  const title =
    busy && stagedName ? (
      <>
        Reading <span className="mono">{stagedName}</span>…
      </>
    ) : (
      "Drop an .xlsx file to inspect"
    );

  return (
    <div
      className={`drop ${dragging ? "dragging" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div className="drop__icon" aria-hidden />
      <div className="drop__title">{title}</div>
      <div className="drop__sub">
        Or click to browse. Max {MAX_MB} MB. Files are processed by the
        Sheetlint API — nothing is persisted beyond the job TTL.
      </div>

      <div className="drop__actions">
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <DocIcon /> Choose file
        </button>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          className="sr"
          onChange={onChange}
          disabled={busy}
        />
      </div>

      <div className="drop__hint">
        Supports .xlsx — up to 50 sheets per workbook
      </div>
    </div>
  );
}
