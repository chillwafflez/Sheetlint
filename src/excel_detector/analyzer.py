"""Top-level orchestration — runs every detector against a parsed document.

Kept separate from the UI so the pipeline can also be driven from scripts, CI,
or tests without importing Streamlit.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import BinaryIO

from excel_detector.detectors import default_detectors
from excel_detector.detectors.base import AnalysisResult, Detector
from excel_detector.detectors.timeseries import TimeSeriesDetector
from excel_detector.parser import ExcelDocument, parse_excel
from excel_detector.scoring import TrustScore

log = logging.getLogger(__name__)


def analyze(
    source: str | Path | BinaryIO | bytes,
    *,
    filename: str | None = None,
    enable_ai: bool = True,
    detectors: list[Detector] | None = None,
) -> tuple[ExcelDocument, AnalysisResult]:
    """Parse and run the full detector stack against a single file.

    Returns the parsed ExcelDocument so the UI can render the raw data alongside
    findings, and the AnalysisResult containing all findings + scoring.
    """
    doc = parse_excel(source, filename=filename)
    stack = detectors if detectors is not None else default_detectors(enable_ai=enable_ai)

    result = AnalysisResult(filename=doc.filename)

    for detector in stack:
        try:
            result.findings.extend(detector.run(doc))
        except Exception as exc:
            # One broken detector must not kill the whole report
            log.exception("Detector %s failed: %s", detector.name, exc)

        if isinstance(detector, TimeSeriesDetector):
            try:
                result.anomalies.extend(detector.analyze(doc))
            except Exception as exc:
                log.exception("TimeSeries analyze step failed: %s", exc)

    score = TrustScore.from_findings(result.findings)
    result.trust_score = score.score
    result.score_breakdown = score.breakdown
    # Attach the grade as well so the UI doesn't need to recompute
    result.score_breakdown["_grade"] = score.grade  # type: ignore[assignment]
    result.score_breakdown["_by_severity"] = score.by_severity  # type: ignore[assignment]

    return doc, result
