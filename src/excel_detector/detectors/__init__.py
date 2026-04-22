"""Detector registry.

Add new detectors here. The UI iterates this list — order matters only for display.
"""

from __future__ import annotations

from excel_detector.detectors.ai import AIDetector
from excel_detector.detectors.base import (
    AnalysisResult,
    AnomalyResult,
    Detector,
    Finding,
    Severity,
)
from excel_detector.detectors.duplicates import DuplicatesDetector
from excel_detector.detectors.statistical import StatisticalDetector
from excel_detector.detectors.structural import StructuralDetector
from excel_detector.detectors.timeseries import TimeSeriesDetector


def default_detectors(*, enable_ai: bool = True) -> list[Detector]:
    """Return the default detector stack in display order.

    The AI detector is optional — it requires an ANTHROPIC_API_KEY and adds
    latency. Toggle it off for quick iteration or CI runs.
    """
    stack: list[Detector] = [
        StructuralDetector(),
        StatisticalDetector(),
        DuplicatesDetector(),
        TimeSeriesDetector(),
    ]
    if enable_ai:
        stack.append(AIDetector())
    return stack


__all__ = [
    "AIDetector",
    "AnalysisResult",
    "AnomalyResult",
    "Detector",
    "DuplicatesDetector",
    "Finding",
    "Severity",
    "StatisticalDetector",
    "StructuralDetector",
    "TimeSeriesDetector",
    "default_detectors",
]
