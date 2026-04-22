"""Duplicates detector — exact + fuzzy near-duplicates.

Fuzzy matching via rapidfuzz catches the typos human entry introduces:
'California' vs 'Californa', trailing spaces, case drift, etc.
"""

from __future__ import annotations

from collections import Counter

from rapidfuzz import fuzz, process

from sheetlint.analysis.parser import ExcelDocument, SheetView
from sheetlint.analysis.schemas import Finding, Severity

FUZZY_THRESHOLD = 88  # 0-100; 88 catches 'Californa' -> 'California' without false positives
FUZZY_MIN_CARDINALITY = 5
FUZZY_MAX_CARDINALITY = 500  # skip free-text columns — too expensive, too noisy


class DuplicatesDetector:
    name = "Duplicates"

    def run(self, doc: ExcelDocument) -> list[Finding]:
        findings: list[Finding] = []
        for sheet in doc.sheets:
            if sheet.df.empty:
                continue
            findings.extend(self._run_sheet(sheet))
        return findings

    def _run_sheet(self, sheet: SheetView) -> list[Finding]:
        out: list[Finding] = []
        df = sheet.df

        # Exact row duplicates
        dup_mask = df.duplicated(keep=False)
        if dup_mask.any():
            dup_rows = df.index[dup_mask].tolist()
            out.append(
                Finding(
                    detector=self.name,
                    severity=Severity.WARNING,
                    sheet=sheet.name,
                    message=f"{len(dup_rows)} duplicate row(s) detected (exact match across all columns).",
                    suggested_fix="Deduplicate or investigate whether the duplicates represent repeated real-world events.",
                    rows=dup_rows,
                )
            )

        # Fuzzy near-duplicate values per categorical column
        for col in df.columns:
            series = df[col].dropna().astype(str)
            unique_values = series.unique().tolist()
            card = len(unique_values)
            if not (FUZZY_MIN_CARDINALITY <= card <= FUZZY_MAX_CARDINALITY):
                continue

            counts = Counter(series)
            clusters = self._fuzzy_cluster(unique_values, counts)
            for canonical, variants in clusters.items():
                if len(variants) < 2:
                    continue
                affected_rows = series.index[series.isin(variants)].tolist()
                out.append(
                    Finding(
                        detector=self.name,
                        severity=Severity.WARNING,
                        sheet=sheet.name,
                        column=str(col),
                        message=(
                            f"Column '{col}' contains {len(variants)} near-duplicate variants of "
                            f"'{canonical}': {variants[:4]}"
                        ),
                        suggested_fix=f"Normalize all variants to '{canonical}' (or your preferred canonical form).",
                        rows=affected_rows,
                        metadata={"canonical": canonical, "variants": variants},
                    )
                )

        return out

    def _fuzzy_cluster(self, values: list[str], counts: Counter) -> dict[str, list[str]]:
        """Group values by fuzzy similarity. Canonical = most common in each cluster."""
        remaining = list(values)
        clusters: dict[str, list[str]] = {}
        while remaining:
            seed = remaining.pop(0)
            matches = process.extract(seed, remaining, scorer=fuzz.ratio, score_cutoff=FUZZY_THRESHOLD)
            members = [seed] + [m[0] for m in matches]
            # Remove members from remaining list
            for m in matches:
                if m[0] in remaining:
                    remaining.remove(m[0])
            canonical = max(members, key=lambda v: counts.get(v, 0))
            clusters[canonical] = members
        return clusters
