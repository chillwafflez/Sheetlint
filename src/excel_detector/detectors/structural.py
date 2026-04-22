"""Structural detector — catches Excel-specific integrity issues.

These are the signals that make this tool different from a generic pandas
profiler: merged cells, formula errors, hidden sheets, pre-header title rows.
"""

from __future__ import annotations

from openpyxl.utils import range_boundaries

from excel_detector.detectors.base import Finding, Severity
from excel_detector.parser import ExcelDocument, SheetView


class StructuralDetector:
    name = "Structural"

    def run(self, doc: ExcelDocument) -> list[Finding]:
        findings: list[Finding] = []

        # Hidden sheets — workbook-level finding
        for name in doc.hidden_sheet_names:
            findings.append(
                Finding(
                    detector=self.name,
                    severity=Severity.WARNING,
                    sheet=name,
                    message=f"Sheet '{name}' is hidden and may contain data the user did not intend to share.",
                    suggested_fix="Unhide the sheet to review its contents, or delete it if unused.",
                )
            )

        for sheet in doc.sheets:
            findings.extend(self._run_sheet(sheet))

        return findings

    def _run_sheet(self, sheet: SheetView) -> list[Finding]:
        out: list[Finding] = []

        # Mid-sheet header shift
        if sheet.header_row > 1:
            out.append(
                Finding(
                    detector=self.name,
                    severity=Severity.WARNING,
                    sheet=sheet.name,
                    message=(
                        f"Header row detected at row {sheet.header_row} instead of row 1. "
                        f"There are {sheet.header_row - 1} pre-header rows that may contain "
                        "titles, metadata, or mis-pasted content."
                    ),
                    suggested_fix="Remove pre-header rows or move them to a dedicated 'Notes' sheet.",
                    metadata={"header_row": sheet.header_row},
                )
            )

        # Merged cells within the data region
        for merged in sheet.merged_ranges:
            try:
                min_col, min_row, max_col, max_row = range_boundaries(merged)
            except ValueError:
                continue
            if min_row > sheet.header_row:
                out.append(
                    Finding(
                        detector=self.name,
                        severity=Severity.CRITICAL,
                        sheet=sheet.name,
                        message=(
                            f"Merged cells at {merged} fall inside the data region. "
                            "Programmatic ingestion will see empty cells after the top-left of the merge."
                        ),
                        suggested_fix="Unmerge and repeat the value in each cell, or restructure the table.",
                        metadata={"range": merged},
                    )
                )

        # Formula errors
        if sheet.error_cells:
            # Group by error literal so the user sees a digest, not 50 identical findings
            by_error: dict[str, list[tuple[int, int]]] = {}
            for row, col, err in sheet.error_cells:
                by_error.setdefault(err, []).append((row, col))
            for err, locations in by_error.items():
                coords = ", ".join(f"R{r}C{c}" for r, c in locations[:5])
                more = f" (+{len(locations) - 5} more)" if len(locations) > 5 else ""
                out.append(
                    Finding(
                        detector=self.name,
                        severity=Severity.CRITICAL,
                        sheet=sheet.name,
                        message=(
                            f"{len(locations)} cell(s) contain {err} formula errors: {coords}{more}"
                        ),
                        suggested_fix=(
                            "Fix the broken formula references — these cells currently hold an error "
                            "value, not real data."
                        ),
                        rows=[r - sheet.header_row - 1 for r, _ in locations if r > sheet.header_row],
                        metadata={"error_literal": err, "count": len(locations)},
                    )
                )

        # Completely empty columns
        if not sheet.df.empty:
            empty_cols = [c for c in sheet.df.columns if sheet.df[c].isna().all()]
            if empty_cols:
                out.append(
                    Finding(
                        detector=self.name,
                        severity=Severity.INFO,
                        sheet=sheet.name,
                        message=f"{len(empty_cols)} column(s) contain no data: {', '.join(map(str, empty_cols[:5]))}",
                        suggested_fix="Drop unused columns before handoff.",
                        metadata={"empty_columns": empty_cols},
                    )
                )

        return out
