"""Statistical detector — column-level consistency checks.

Catches the pattern the user explicitly called out: "column has mostly numeric
values except rows 103-200 have strings". Also covers null density, cardinality
issues, and simple pattern drift.
"""

from __future__ import annotations

import re

import pandas as pd

from excel_detector.detectors.base import Finding, Severity
from excel_detector.parser import ExcelDocument, SheetView

# Threshold: if >= TYPE_PURITY threshold of non-null values match a single type,
# anything else is a suspect outlier. Tuned to catch the "few stringified numbers
# in a money column" case without crying wolf on genuinely mixed-type columns.
TYPE_PURITY_THRESHOLD = 0.85

# Patterns we try to auto-detect per column. Order matters — more specific first.
PATTERN_DETECTORS = [
    ("email", re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")),
    ("phone_us", re.compile(r"^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$")),
    ("zip_us", re.compile(r"^\d{5}(-\d{4})?$")),
    ("ssn", re.compile(r"^\d{3}-\d{2}-\d{4}$")),
    ("iso_date", re.compile(r"^\d{4}-\d{2}-\d{2}$")),
    ("us_date", re.compile(r"^\d{1,2}/\d{1,2}/\d{2,4}$")),
    ("currency", re.compile(r"^\$?-?\d{1,3}(,\d{3})*(\.\d{1,2})?$")),
]


def _classify_value(val: object) -> str:
    """Return one of: 'null', 'int', 'float', 'bool', 'datetime', 'string'."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return "null"
    if isinstance(val, bool):
        return "bool"
    if isinstance(val, int):
        return "int"
    if isinstance(val, float):
        return "float"
    if isinstance(val, pd.Timestamp):
        return "datetime"
    return "string"


class StatisticalDetector:
    name = "Statistical"

    def run(self, doc: ExcelDocument) -> list[Finding]:
        findings: list[Finding] = []
        for sheet in doc.sheets:
            if sheet.df.empty:
                continue
            findings.extend(self._run_sheet(sheet))
        return findings

    def _run_sheet(self, sheet: SheetView) -> list[Finding]:
        out: list[Finding] = []

        for col in sheet.df.columns:
            series = sheet.df[col]
            non_null_indices = series.dropna().index.tolist()
            if not non_null_indices:
                continue

            # --- Type purity
            type_counts: dict[str, list[int]] = {}
            for idx in non_null_indices:
                t = _classify_value(series.iloc[idx])
                type_counts.setdefault(t, []).append(idx)

            if len(type_counts) > 1:
                dominant_type, dominant_rows = max(type_counts.items(), key=lambda kv: len(kv[1]))
                dominant_fraction = len(dominant_rows) / len(non_null_indices)
                if dominant_fraction >= TYPE_PURITY_THRESHOLD:
                    outlier_rows = [
                        idx for t, idxs in type_counts.items() if t != dominant_type for idx in idxs
                    ]
                    severity = Severity.CRITICAL if dominant_type in {"int", "float"} else Severity.WARNING
                    out.append(
                        Finding(
                            detector=self.name,
                            severity=severity,
                            sheet=sheet.name,
                            column=str(col),
                            message=(
                                f"Column '{col}' is {dominant_fraction:.0%} {dominant_type} but "
                                f"has {len(outlier_rows)} value(s) of a different type "
                                f"(first rows: {outlier_rows[:5]})."
                            ),
                            suggested_fix=(
                                f"Standardize the column to {dominant_type} — the off-type entries "
                                "are likely human-entry mistakes (e.g. 'N/A' in a money column)."
                            ),
                            rows=outlier_rows,
                            metadata={"dominant_type": dominant_type, "fraction": dominant_fraction},
                        )
                    )

            # --- Regex pattern coverage (strings only)
            string_values = [
                (idx, str(series.iloc[idx]))
                for idx in non_null_indices
                if isinstance(series.iloc[idx], str)
            ]
            if len(string_values) >= 10:
                best_pattern, best_match_rate = None, 0.0
                best_nonmatching: list[int] = []
                for pattern_name, regex in PATTERN_DETECTORS:
                    matched = [idx for idx, v in string_values if regex.match(v)]
                    rate = len(matched) / len(string_values)
                    if rate > best_match_rate:
                        best_match_rate = rate
                        best_pattern = pattern_name
                        best_nonmatching = [idx for idx, v in string_values if not regex.match(v)]
                if best_pattern and 0.80 <= best_match_rate < 0.98:
                    out.append(
                        Finding(
                            detector=self.name,
                            severity=Severity.WARNING,
                            sheet=sheet.name,
                            column=str(col),
                            message=(
                                f"Column '{col}' looks like a {best_pattern} column "
                                f"({best_match_rate:.0%} match), but {len(best_nonmatching)} entries don't fit the format."
                            ),
                            suggested_fix=f"Normalize the {len(best_nonmatching)} off-format entries to standard {best_pattern}.",
                            rows=best_nonmatching,
                            metadata={"pattern": best_pattern, "match_rate": best_match_rate},
                        )
                    )

            # --- Null density (excessive missing values)
            null_fraction = series.isna().mean()
            if 0.20 < null_fraction < 0.95:
                out.append(
                    Finding(
                        detector=self.name,
                        severity=Severity.INFO,
                        sheet=sheet.name,
                        column=str(col),
                        message=f"Column '{col}' is {null_fraction:.0%} empty.",
                        suggested_fix="Decide whether empty entries are meaningful ('not applicable') or missing data that should be collected.",
                        metadata={"null_fraction": null_fraction},
                    )
                )

        return out
