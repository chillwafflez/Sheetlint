"""Orchestration — runs the detector stack against a parsed document.

Framework-free: drivable from a script, a test, an async background task, or
a worker. The FastAPI router calls `analyze` from a thread pool so the event
loop stays responsive while detectors do CPU-heavy work (STUMPY, openpyxl).
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import BinaryIO

from sheetlint.analysis.detectors import default_detectors
from sheetlint.analysis.detectors.base import Detector
from sheetlint.analysis.detectors.timeseries import TimeSeriesDetector
from sheetlint.analysis.parser import ExcelDocument, parse_excel
from sheetlint.analysis.schemas import AnalysisResult
from sheetlint.analysis.scoring import compute_trust_score

log = logging.getLogger(__name__)


def analyze(
    source: str | Path | BinaryIO | bytes,
    *,
    filename: str | None = None,
    enable_ai: bool = True,
    api_key: str | None = None,
    detectors: list[Detector] | None = None,
) -> tuple[ExcelDocument, AnalysisResult]:
    """Parse and run the full detector stack against a single file.

    Returns the parsed ExcelDocument so callers can render raw data alongside
    findings, and the AnalysisResult containing all findings + scoring.
    """
    doc = parse_excel(source, filename=filename)
    stack = (
        detectors
        if detectors is not None
        else default_detectors(enable_ai=enable_ai, api_key=api_key)
    )

    result = AnalysisResult(filename=doc.filename)

    for detector in stack:
        try:
            result.findings.extend(detector.run(doc))
        except Exception:
            # One broken detector must not kill the whole report.
            log.exception("Detector %s failed", detector.name)

        if isinstance(detector, TimeSeriesDetector):
            try:
                result.anomalies.extend(detector.analyze(doc))
            except Exception:
                log.exception("TimeSeries analyze step failed")

    result.trust_score = compute_trust_score(result.findings)
    return doc, result
