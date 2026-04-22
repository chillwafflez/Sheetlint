"""Core types shared by every detector.

The Detector Protocol is the extension point for v2. Any class that implements
`name` and `run(doc) -> list[Finding]` can be registered in `detectors/__init__.py`
and will appear in the report automatically.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import TYPE_CHECKING, Protocol, runtime_checkable

if TYPE_CHECKING:
    from excel_detector.parser import ExcelDocument


class Severity(str, Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"

    @property
    def weight(self) -> int:
        return {"critical": 20, "warning": 5, "info": 1}[self.value]

    @property
    def color(self) -> str:
        return {"critical": "#DC2626", "warning": "#F59E0B", "info": "#0EA5E9"}[self.value]

    @property
    def label(self) -> str:
        return self.value.capitalize()


@dataclass(frozen=True)
class Finding:
    """A single data-quality issue surfaced by a detector.

    `rows` holds the 0-indexed DataFrame row positions the issue applies to
    (empty list = sheet-level finding). `column` is the column name or None
    for structural issues that span the whole sheet.
    """

    detector: str
    severity: Severity
    sheet: str
    message: str
    column: str | None = None
    rows: list[int] = field(default_factory=list)
    suggested_fix: str | None = None
    metadata: dict = field(default_factory=dict)

    @property
    def row_count(self) -> int:
        return len(self.rows)


@dataclass
class AnomalyResult:
    """Per-detector output from the time-series layer.

    `scores` is aligned with the input series index; higher = more anomalous.
    `flagged_indices` is the subset the detector considers actionable.
    """

    detector: str
    series_name: str
    scores: list[float]
    flagged_indices: list[int]
    explanation: str
    metadata: dict = field(default_factory=dict)


@runtime_checkable
class Detector(Protocol):
    """Every detector implements this shape.

    Keep `run` synchronous and side-effect-free — the UI runs them sequentially
    and expects the same ExcelDocument to be safe across calls.
    """

    name: str

    def run(self, doc: ExcelDocument) -> list[Finding]: ...


@dataclass
class AnalysisResult:
    """Complete output of a single file inspection — what the UI renders from."""

    filename: str
    findings: list[Finding] = field(default_factory=list)
    anomalies: list[AnomalyResult] = field(default_factory=list)
    inferred_schemas: dict[str, str] = field(default_factory=dict)
    trust_score: float = 100.0
    score_breakdown: dict[str, float] = field(default_factory=dict)

    def findings_by_severity(self, severity: Severity) -> list[Finding]:
        return [f for f in self.findings if f.severity is severity]

    def findings_by_detector(self) -> dict[str, list[Finding]]:
        grouped: dict[str, list[Finding]] = {}
        for f in self.findings:
            grouped.setdefault(f.detector, []).append(f)
        return grouped
