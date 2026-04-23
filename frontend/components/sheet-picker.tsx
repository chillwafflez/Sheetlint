"use client";

import { CheckIcon, EyeOffIcon } from "@/components/icons";
import type { SheetMetadata } from "@/lib/schemas";

type SheetPickerProps = {
  sheets: readonly SheetMetadata[];
  selected: ReadonlySet<string>;
  onToggle: (name: string) => void;
};

export function SheetPicker({ sheets, selected, onToggle }: SheetPickerProps) {
  if (sheets.length === 0) {
    return (
      <div className="empty-state" style={{ padding: "32px 20px" }}>
        <h3>No worksheets in this workbook.</h3>
        <div>Upload a different file to continue.</div>
      </div>
    );
  }

  return (
    <div className="sheets">
      {sheets.map((sheet) => (
        <SheetCard
          key={sheet.name}
          sheet={sheet}
          selected={selected.has(sheet.name)}
          onToggle={() => onToggle(sheet.name)}
        />
      ))}
    </div>
  );
}

function SheetCard({
  sheet,
  selected,
  onToggle,
}: {
  sheet: SheetMetadata;
  selected: boolean;
  onToggle: () => void;
}) {
  const classes = [
    "sheet-card",
    selected ? "selected" : "",
    sheet.hidden ? "hidden-sheet" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={classes}
      onClick={onToggle}
      aria-pressed={selected}
    >
      <div className="sheet-card__check" aria-hidden>
        {selected && <CheckIcon />}
      </div>
      <div className="sheet-card__head">
        <span className="sheet-card__name">{sheet.name}</span>
      </div>
      <div className="sheet-card__dims">
        {sheet.row_count.toLocaleString()} rows · {sheet.col_count} cols
      </div>
      <div className="sheet-card__hint">
        {sheet.hidden && (
          <span className="chip">
            <EyeOffIcon /> hidden
          </span>
        )}
        {sheet.flags.map((flag) => (
          <FlagChip key={flag} flag={flag} />
        ))}
      </div>
    </button>
  );
}

function FlagChip({ flag }: { flag: string }) {
  if (flag === "hidden") return null; // rendered separately with the icon
  if (flag === "looks clean") {
    return (
      <span className="chip chip--ok">
        <CheckIcon /> looks clean
      </span>
    );
  }
  return <span className="chip">{flag}</span>;
}
