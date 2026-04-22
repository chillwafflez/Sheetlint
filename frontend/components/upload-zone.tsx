"use client";

import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSubmitAnalysis } from "@/hooks/use-submit-analysis";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = ".xlsx";
const ACCEPTED_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function isXlsx(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith(".xlsx") ||
    file.type === ACCEPTED_MIME ||
    file.type === ""
  );
}

export function UploadZone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const { mutate, isPending } = useSubmitAnalysis();

  function submit(file: File | null | undefined) {
    if (!file) return;
    if (!isXlsx(file)) {
      toast.error("Only .xlsx files are supported.");
      return;
    }
    mutate(file);
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    submit(event.target.files?.[0]);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    submit(event.dataTransfer.files?.[0]);
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(true);
  }

  return (
    <Card
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={() => setDragOver(false)}
      className={cn(
        "border-2 border-dashed transition-colors",
        dragOver
          ? "border-blue-500 bg-blue-50/60 dark:bg-blue-900/20"
          : "border-border",
        isPending && "pointer-events-none opacity-70",
      )}
    >
      <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
          {isPending ? (
            <Loader2 className="size-6 animate-spin" />
          ) : (
            <FileSpreadsheet className="size-6" />
          )}
        </div>

        <div className="space-y-1">
          <div className="text-base font-medium">
            {isPending ? "Uploading…" : "Drop an .xlsx file to inspect"}
          </div>
          <div className="text-xs text-muted-foreground">
            Or click to browse. Max 50 MB.
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={onChange}
          className="hidden"
          disabled={isPending}
        />

        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isPending}
        >
          <Upload className="size-4" />
          Choose file
        </Button>
      </CardContent>
    </Card>
  );
}
