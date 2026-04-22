"""Data trust score — single 0–100 number business stakeholders can anchor on.

Weighted by severity (critical > warning > info). Also caps the floor at 0
and returns a per-detector breakdown so the UI can explain *why* the score
is what it is.
"""

from __future__ import annotations

from dataclasses import dataclass

from excel_detector.detectors.base import Finding, Severity


@dataclass
class TrustScore:
    score: float
    breakdown: dict[str, float]  # per-detector points deducted
    by_severity: dict[str, int]  # count of findings per severity
    grade: str

    @classmethod
    def from_findings(cls, findings: list[Finding]) -> TrustScore:
        if not findings:
            return cls(score=100.0, breakdown={}, by_severity={}, grade="A+")

        breakdown: dict[str, float] = {}
        by_severity: dict[str, int] = {"critical": 0, "warning": 0, "info": 0}

        for f in findings:
            # Row-heavy findings deserve a small multiplier, capped so a 10000-row
            # type-mismatch doesn't obliterate the score
            row_multiplier = 1.0 + min(f.row_count / 200.0, 1.0)
            deduction = f.severity.weight * row_multiplier
            breakdown[f.detector] = breakdown.get(f.detector, 0) + deduction
            by_severity[f.severity.value] += 1

        total_deduction = sum(breakdown.values())
        score = max(0.0, 100.0 - total_deduction)
        return cls(
            score=round(score, 1),
            breakdown={k: round(v, 1) for k, v in breakdown.items()},
            by_severity=by_severity,
            grade=_grade(score),
        )


def _grade(score: float) -> str:
    if score >= 95:
        return "A+"
    if score >= 85:
        return "A"
    if score >= 75:
        return "B"
    if score >= 60:
        return "C"
    if score >= 40:
        return "D"
    return "F"
