"""Trust-score computation.

The single 0–100 number business stakeholders anchor on. Weighted by severity
(critical > warning > info), with a row-count multiplier so a critical that
affects 200 rows hurts more than one that affects 1. The detector breakdown
explains the score for the data-engineer audience.
"""

from __future__ import annotations

from sheetlint.analysis.schemas import Finding, TrustScore

_GRADE_THRESHOLDS = (
    (95.0, "A+"),
    (85.0, "A"),
    (75.0, "B"),
    (60.0, "C"),
    (40.0, "D"),
)


def compute_trust_score(findings: list[Finding]) -> TrustScore:
    """Roll a list of findings into a 0–100 score plus per-detector breakdown."""
    if not findings:
        return TrustScore(score=100.0, grade="A+")

    breakdown: dict[str, float] = {}
    by_severity: dict[str, int] = {"critical": 0, "warning": 0, "info": 0}

    for f in findings:
        # Cap the row multiplier at 2× so a single critical can't tank the
        # whole score regardless of how many rows it touches.
        row_multiplier = 1.0 + min(f.row_count / 200.0, 1.0)
        deduction = f.severity.weight * row_multiplier
        breakdown[f.detector] = breakdown.get(f.detector, 0.0) + deduction
        by_severity[f.severity.value] += 1

    total_deduction = sum(breakdown.values())
    score = max(0.0, 100.0 - total_deduction)
    return TrustScore(
        score=round(score, 1),
        grade=_grade(score),
        breakdown={k: round(v, 1) for k, v in breakdown.items()},
        by_severity=by_severity,
    )


def _grade(score: float) -> str:
    for threshold, letter in _GRADE_THRESHOLDS:
        if score >= threshold:
            return letter
    return "F"
