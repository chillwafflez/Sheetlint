"""Time-series anomaly detector.

Two methods ensembled:
    1. STUMPY matrix-profile discord detection — finds subsequences whose shape
       is unlike any other in the series. Good for novel patterns a z-score misses.
    2. Rolling z-score on STL residual — classic spike detection. Cheap, reliable.

We run both and surface their union so the demo shows multiple methods agreeing
when the signal is strong.
"""

from __future__ import annotations

import warnings

import numpy as np
import pandas as pd

try:
    import stumpy
    _HAS_STUMPY = True
except ImportError:
    _HAS_STUMPY = False

from sheetlint.analysis.parser import ExcelDocument, SheetView
from sheetlint.analysis.schemas import AnomalyResult, Finding, Severity

MIN_LEN_FOR_STUMPY = 50
ZSCORE_THRESHOLD = 3.0
ROLLING_WINDOW = 7
DISCORD_COUNT = 3  # top-K discords to flag


def _looks_like_date_column(series: pd.Series) -> bool:
    if series.empty:
        return False
    sample = series.dropna().head(20)
    if sample.empty:
        return False
    if pd.api.types.is_datetime64_any_dtype(sample):
        return True
    try:
        with warnings.catch_warnings():
            # We're probing arbitrary columns to see if they look date-like;
            # the "format could not be inferred" warning is expected noise here.
            warnings.simplefilter("ignore", UserWarning)
            parsed = pd.to_datetime(sample, errors="coerce")
        return parsed.notna().mean() >= 0.8
    except (ValueError, TypeError):
        return False


def _find_timeseries_pairs(sheet: SheetView) -> list[tuple[str, str]]:
    """Return list of (date_column, numeric_column) pairs worth analyzing."""
    if sheet.df.empty:
        return []
    date_cols = [c for c in sheet.df.columns if _looks_like_date_column(sheet.df[c])]
    numeric_cols = [
        c for c in sheet.df.columns
        if pd.api.types.is_numeric_dtype(sheet.df[c]) and sheet.df[c].notna().sum() >= 20
    ]
    if not date_cols:
        return []
    # Pair each numeric column with the first date column (simple heuristic)
    return [(date_cols[0], numeric_col) for numeric_col in numeric_cols]


def _rolling_zscore(values: np.ndarray) -> np.ndarray:
    s = pd.Series(values)
    median = s.rolling(ROLLING_WINDOW, center=True, min_periods=1).median()
    mad = (s - median).abs().rolling(ROLLING_WINDOW, center=True, min_periods=1).median()
    # Guard against division-by-zero on flat segments
    mad_safe = mad.replace(0, mad[mad > 0].median() if (mad > 0).any() else 1.0)
    return (0.6745 * (s - median) / mad_safe).fillna(0).to_numpy()


def _stumpy_discords(values: np.ndarray, window: int) -> list[int]:
    """Return indices of the top-K discords (highest matrix profile values)."""
    if not _HAS_STUMPY or len(values) < MIN_LEN_FOR_STUMPY:
        return []
    try:
        mp = stumpy.stump(values.astype(float), m=window)
    except (ValueError, RuntimeError):
        return []
    profile = mp[:, 0].astype(float)
    # Top-K indices by profile value
    k = min(DISCORD_COUNT, len(profile))
    top_indices = np.argpartition(-profile, k - 1)[:k]
    # Shift to the center of each subsequence for nicer highlighting
    return sorted(int(i + window // 2) for i in top_indices)


class TimeSeriesDetector:
    name = "TimeSeries"

    def run(self, doc: ExcelDocument) -> list[Finding]:
        findings: list[Finding] = []
        for sheet in doc.sheets:
            findings.extend(self._run_sheet(sheet))
        return findings

    def analyze(self, doc: ExcelDocument) -> list[AnomalyResult]:
        """Return structured per-series anomaly results for the UI chart layer."""
        results: list[AnomalyResult] = []
        for sheet in doc.sheets:
            for date_col, num_col in _find_timeseries_pairs(sheet):
                result = self._analyze_series(sheet, date_col, num_col)
                if result is not None:
                    results.append(result)
        return results

    def _run_sheet(self, sheet: SheetView) -> list[Finding]:
        out: list[Finding] = []
        for date_col, num_col in _find_timeseries_pairs(sheet):
            result = self._analyze_series(sheet, date_col, num_col)
            if result is None or not result.flagged_indices:
                continue
            out.append(
                Finding(
                    detector=self.name,
                    severity=Severity.WARNING,
                    sheet=sheet.name,
                    column=num_col,
                    message=(
                        f"Time-series '{num_col}' has {len(result.flagged_indices)} anomalous "
                        f"point(s) detected by {result.detector}. {result.explanation}"
                    ),
                    suggested_fix=(
                        "Verify whether these spikes reflect real events (e.g. one-off charges, "
                        "market shocks) or data-entry errors."
                    ),
                    rows=result.flagged_indices,
                    metadata={"date_column": date_col, "series": num_col},
                )
            )
        return out

    def _analyze_series(self, sheet: SheetView, date_col: str, num_col: str) -> AnomalyResult | None:
        df = sheet.df[[date_col, num_col]].dropna()
        if len(df) < 20:
            return None

        df = df.copy()
        df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
        df = df.dropna().sort_values(date_col).reset_index(drop=True)
        values = df[num_col].astype(float).to_numpy()

        # Baseline: rolling z-score on residuals
        z = _rolling_zscore(values)
        z_flagged = sorted(int(i) for i in np.where(np.abs(z) > ZSCORE_THRESHOLD)[0].tolist())

        # Matrix profile: pick a pragmatic window if we have the length for it
        window = max(7, len(values) // 20)
        mp_flagged = _stumpy_discords(values, window) if len(values) >= MIN_LEN_FOR_STUMPY else []

        flagged = sorted(set(z_flagged) | set(mp_flagged))
        if not flagged:
            return None

        explanations = []
        if z_flagged:
            explanations.append(f"{len(z_flagged)} z-score spike(s)")
        if mp_flagged:
            explanations.append(f"{len(mp_flagged)} matrix-profile discord(s)")
        explanation = "Ensemble: " + ", ".join(explanations) + "."

        detector_label = "STUMPY + z-score" if mp_flagged else "rolling z-score"
        return AnomalyResult(
            detector=detector_label,
            series_name=f"{sheet.name}.{num_col}",
            scores=np.abs(z).tolist(),
            flagged_indices=flagged,
            explanation=explanation,
            metadata={
                "date_column": date_col,
                "num_column": num_col,
                "window": window,
                "dates": df[date_col].dt.strftime("%Y-%m-%d").tolist(),
                "values": values.tolist(),
                "z_flagged": z_flagged,
                "mp_flagged": mp_flagged,
            },
        )
