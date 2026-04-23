"""Orchestration — runs the detector stack against a parsed document.

Framework-free: drivable from a script, a test, an async background task, or
a worker. The FastAPI router calls `analyze` from a thread pool so the event
loop stays responsive while detectors do CPU-heavy work (STUMPY, openpyxl).
"""

from __future__ import annotations

import logging
from collections.abc import Iterable
from pathlib import Path
from typing import BinaryIO

from sheetlint.analysis.detectors import build_detectors, default_detectors
from sheetlint.analysis.detectors.base import Detector
from sheetlint.analysis.detectors.timeseries import TimeSeriesDetector
from sheetlint.analysis.parser import ExcelDocument, parse_excel
from sheetlint.analysis.schemas import AnalysisResult, DetectorId
from sheetlint.analysis.scoring import compute_trust_score

log = logging.getLogger(__name__)


def analyze(
    source: str | Path | BinaryIO | bytes,
    *,
    filename: str | None = None,
    enable_ai: bool = True,
    api_key: str | None = None,
    detectors: list[Detector] | None = None,
    detector_ids: Iterable[DetectorId] | None = None,
    sheet_filter: Iterable[str] | None = None,
) -> tuple[ExcelDocument, AnalysisResult]:
    """Parse and run the detector stack against a single file.

    Args:
        source: path, file-like, or raw bytes for the workbook.
        filename: display name (derived from the path when not given).
        enable_ai: include the AI detector in the default stack.
        api_key: Anthropic key for the AI detector; None → AI no-ops.
        detectors: pre-built detector instances. Takes precedence if set.
        detector_ids: subset of DetectorId to instantiate via the registry.
            Ignored when `detectors` is provided. Falls back to
            `default_detectors(enable_ai=enable_ai, api_key=api_key)`.
        sheet_filter: worksheet names to inspect. Sheets not in the filter
            are removed from the parsed document before detectors run — they
            still show up in findings only if a detector happens to walk the
            raw workbook directly, which none of the current ones do.

    Returns:
        The parsed ExcelDocument (possibly filtered) and the AnalysisResult.
    """
    doc = parse_excel(source, filename=filename)

    if sheet_filter is not None:
        allowed = set(sheet_filter)
        doc.sheets = [s for s in doc.sheets if s.name in allowed]

    stack = _resolve_stack(
        detectors=detectors,
        detector_ids=detector_ids,
        enable_ai=enable_ai,
        api_key=api_key,
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


def _resolve_stack(
    *,
    detectors: list[Detector] | None,
    detector_ids: Iterable[DetectorId] | None,
    enable_ai: bool,
    api_key: str | None,
) -> list[Detector]:
    if detectors is not None:
        return detectors
    if detector_ids is not None:
        return build_detectors(detector_ids, api_key=api_key)
    return default_detectors(enable_ai=enable_ai, api_key=api_key)
