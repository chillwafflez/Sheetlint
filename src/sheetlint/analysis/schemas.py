"""Public data shapes for the analysis domain.

These Pydantic models cross the API boundary, so they serve double duty as
the internal contract that detectors construct and the wire format FastAPI
exposes via `response_model`. Keep them free of behavior beyond computed
fields — orchestration and scoring live in service.py and scoring.py.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, computed_field


class Severity(StrEnum):
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


class Finding(BaseModel):
    """A single data-quality issue surfaced by a detector.

    `rows` holds the 0-indexed DataFrame row positions the issue applies to
    (empty list = sheet-level finding). `column` is None for structural issues
    that span the whole sheet.
    """

    model_config = ConfigDict(frozen=True)

    detector: str
    severity: Severity
    sheet: str
    message: str
    column: str | None = None
    rows: list[int] = Field(default_factory=list)
    suggested_fix: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def row_count(self) -> int:
        return len(self.rows)


class AnomalyResult(BaseModel):
    """Per-detector output from the time-series layer.

    `scores` is aligned with the input series index; higher = more anomalous.
    `flagged_indices` is the subset the detector considers actionable.
    """

    detector: str
    series_name: str
    scores: list[float]
    flagged_indices: list[int]
    explanation: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class TrustScore(BaseModel):
    """Single 0–100 trust signal plus per-detector and per-severity breakdowns."""

    score: float = Field(ge=0, le=100)
    grade: str
    breakdown: dict[str, float] = Field(default_factory=dict)
    by_severity: dict[str, int] = Field(default_factory=dict)


def _default_trust_score() -> TrustScore:
    return TrustScore(score=100.0, grade="A+")


class AnalysisResult(BaseModel):
    """Complete output of a single file inspection — what the API returns."""

    filename: str
    trust_score: TrustScore = Field(default_factory=_default_trust_score)
    findings: list[Finding] = Field(default_factory=list)
    anomalies: list[AnomalyResult] = Field(default_factory=list)
    inferred_schemas: dict[str, str] = Field(default_factory=dict)

    def findings_by_severity(self, severity: Severity) -> list[Finding]:
        return [f for f in self.findings if f.severity is severity]

    def findings_by_detector(self) -> dict[str, list[Finding]]:
        grouped: dict[str, list[Finding]] = {}
        for f in self.findings:
            grouped.setdefault(f.detector, []).append(f)
        return grouped
