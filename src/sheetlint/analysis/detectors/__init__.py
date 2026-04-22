"""Detector registry.

Add new detectors here. The orchestrator iterates this list — order matters
only for display in the report.
"""

from __future__ import annotations

from sheetlint.analysis.detectors.ai import AIDetector
from sheetlint.analysis.detectors.base import Detector
from sheetlint.analysis.detectors.duplicates import DuplicatesDetector
from sheetlint.analysis.detectors.statistical import StatisticalDetector
from sheetlint.analysis.detectors.structural import StructuralDetector
from sheetlint.analysis.detectors.timeseries import TimeSeriesDetector


def default_detectors(
    *, enable_ai: bool = True, api_key: str | None = None
) -> list[Detector]:
    """Return the default detector stack in display order.

    The AI detector is optional — it requires an ANTHROPIC_API_KEY and adds
    latency. Toggle it off for quick iteration or CI runs. If `enable_ai` is
    True but `api_key` is None, the AI detector is still appended but becomes
    a no-op at run time.
    """
    stack: list[Detector] = [
        StructuralDetector(),
        StatisticalDetector(),
        DuplicatesDetector(),
        TimeSeriesDetector(),
    ]
    if enable_ai:
        stack.append(AIDetector(api_key=api_key))
    return stack


__all__ = [
    "AIDetector",
    "Detector",
    "DuplicatesDetector",
    "StatisticalDetector",
    "StructuralDetector",
    "TimeSeriesDetector",
    "default_detectors",
]
