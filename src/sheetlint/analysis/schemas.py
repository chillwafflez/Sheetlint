"""Public data shapes for the analysis domain.

These Pydantic models cross the API boundary, so they serve double duty as
the internal contract that detectors construct and the wire format FastAPI
exposes via `response_model`. Keep them free of behavior beyond computed
fields — orchestration and scoring live in service.py and scoring.py.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

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


class DetectorId(StrEnum):
    """Stable identifiers used by clients to select a subset of detectors.

    The display string on each `Finding.detector` stays PascalCase (e.g.
    "Structural") because it's what the report UI renders — these lowercase
    ids are the machine-readable handles used in `AnalysisConfig`.
    """

    STRUCTURAL = "structural"
    STATISTICAL = "statistical"
    DUPLICATES = "duplicates"
    TIMESERIES = "timeseries"
    AI = "ai"


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


class SheetPreview(BaseModel):
    """First N data rows of a sheet, rendered as plain strings for UI display."""

    headers: list[str]
    rows: list[list[str]]


class SheetMetadata(BaseModel):
    """Lightweight summary of one worksheet — populated during preview parsing.

    `flags` are display-ready hint labels ("merged cells", "formula errors",
    "hidden", "pre-header rows", "empty", "wide", "looks clean") derived
    cheaply from the parsed sheet without running any detectors.
    """

    name: str
    row_count: int
    col_count: int
    hidden: bool
    header_row: int = Field(
        description="1-indexed row number where the detected header lives."
    )
    flags: list[str]
    preview: SheetPreview


class AnalysisPreview(BaseModel):
    """Response from POST /analysis/preview — what the Configure screen reads."""

    preview_id: UUID
    filename: str
    created_at: datetime
    expires_at: datetime
    sheets: list[SheetMetadata]


class AnalysisConfig(BaseModel):
    """Payload for POST /analysis — references a prior preview and picks
    which worksheets and detectors to run.
    """

    preview_id: UUID
    sheets: list[str] = Field(
        min_length=1,
        description="Names of worksheets to inspect (subset of preview.sheets).",
    )
    detectors: list[DetectorId] = Field(
        min_length=1,
        description="Detector ids to run. Order in this list determines display order in the report.",
    )
