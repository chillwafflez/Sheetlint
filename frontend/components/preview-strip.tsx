import type { SheetPreview } from "@/lib/schemas";

const MAX_COLS = 12;

export function PreviewStrip({ preview }: { preview: SheetPreview }) {
  if (preview.headers.length === 0) {
    return null;
  }

  const headers = preview.headers.slice(0, MAX_COLS);
  const rows = preview.rows.map((row) => row.slice(0, MAX_COLS));
  const colCount = headers.length;
  const gridTemplateColumns = `40px repeat(${colCount}, minmax(90px, 1fr))`;

  return (
    <div className="preview-strip" style={{ gridTemplateColumns }}>
      <div className="cell head" />
      {headers.map((header, i) => (
        <div key={`h-${i}`} className="cell head">
          {header || <span style={{ color: "var(--ink-4)" }}>(empty)</span>}
        </div>
      ))}
      {rows.map((row, rowIdx) => (
        <PreviewRow
          key={`row-${rowIdx}`}
          rowNum={rowIdx + 1}
          cells={row}
          colCount={colCount}
        />
      ))}
    </div>
  );
}

function PreviewRow({
  rowNum,
  cells,
  colCount,
}: {
  rowNum: number;
  cells: readonly string[];
  colCount: number;
}) {
  const padded = Array.from({ length: colCount }, (_, i) => cells[i] ?? "");
  return (
    <>
      <div className="cell rownum">{rowNum}</div>
      {padded.map((cell, i) => (
        <div key={i} className="cell" title={cell}>
          {cell || <span style={{ color: "var(--ink-4)" }}>—</span>}
        </div>
      ))}
    </>
  );
}
