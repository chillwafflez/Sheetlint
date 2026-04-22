"""AI detector — Claude-driven semantic checks on column contents.

For each column we send the header name plus a small sample of values to Claude
and ask three questions:
    1. Does the column name plausibly match the content?
    2. Are there values that don't fit the column's apparent purpose?
    3. What entity type does the column actually represent?

We use:
    - claude-opus-4-7 with adaptive thinking
    - Prompt caching on the system prompt (stable across columns → big cost savings)
    - Pydantic-typed structured outputs via client.messages.parse() so we get
      validated results, not raw JSON we have to clean up ourselves.

If no API key is supplied at construction the detector becomes a no-op — the
rest of the stack still runs.
"""

from __future__ import annotations

import logging
from typing import Any

from pydantic import BaseModel, Field

from sheetlint.analysis.parser import ExcelDocument, SheetView
from sheetlint.analysis.schemas import Finding, Severity

log = logging.getLogger(__name__)

AI_MODEL = "claude-opus-4-7"
SAMPLE_SIZE = 20
MAX_COLUMNS_PER_SHEET = 25  # safety ceiling — very wide sheets skip the rest

SYSTEM_PROMPT = """You are a data quality auditor specializing in Excel files \
that were hand-edited by non-technical users (insurance agents, finance staff, \
etc.). You are given one column at a time: its header and a sample of values.

For each column, assess:
  1. Does the header name accurately describe the values you see?
  2. Are there specific values that do not fit the column's apparent purpose?
  3. What entity type does the column actually hold (e.g. USD amount, US phone, \
ISO date, free-text address)?

Be conservative: only flag genuine mismatches. Columns with empty values, \
unfamiliar domain codes, or legitimately varied free-text (addresses, names) \
are fine — do not invent problems.

Return your answer strictly matching the provided JSON schema. Keep the \
explanation under 200 characters."""


class ColumnAssessment(BaseModel):
    """Structured output schema Claude returns per column."""

    name_matches_content: bool = Field(description="True if the column header fits the content.")
    inferred_entity_type: str = Field(description="Short label for what the column actually holds.")
    has_issues: bool = Field(description="True if there are specific problematic values.")
    issue_summary: str = Field(description="One-sentence summary of the issue, or empty if no issue.")
    suspect_value_indices: list[int] = Field(
        default_factory=list,
        description="0-indexed positions in the provided sample that don't fit the column's purpose.",
    )


class AIDetector:
    name = "AI"

    def __init__(self, api_key: str | None = None, model: str = AI_MODEL):
        self.api_key = api_key
        self.model = model
        self._client: Any = None

    def _ensure_client(self) -> Any:
        if self._client is not None:
            return self._client
        if not self.api_key:
            return None
        try:
            import anthropic
        except ImportError:
            log.warning("anthropic SDK not installed — skipping AI detector.")
            return None
        self._client = anthropic.Anthropic(api_key=self.api_key)
        return self._client

    def run(self, doc: ExcelDocument) -> list[Finding]:
        client = self._ensure_client()
        if client is None:
            return []

        findings: list[Finding] = []
        for sheet in doc.sheets:
            if sheet.df.empty:
                continue
            findings.extend(self._run_sheet(client, sheet))
        return findings

    def _run_sheet(self, client: Any, sheet: SheetView) -> list[Finding]:
        out: list[Finding] = []
        columns = list(sheet.df.columns)[:MAX_COLUMNS_PER_SHEET]

        for col in columns:
            series = sheet.df[col].dropna()
            if len(series) < 3:
                continue

            # Deterministic sample preserves the cache prefix across re-runs.
            sample_indices = series.index[:SAMPLE_SIZE].tolist()
            sample_values = [str(series.iloc[sample_indices.index(i)]) for i in sample_indices]

            user_message = self._build_user_message(str(col), sample_values)

            try:
                response = client.messages.parse(
                    model=self.model,
                    max_tokens=2048,
                    thinking={"type": "adaptive"},
                    system=[
                        {
                            "type": "text",
                            "text": SYSTEM_PROMPT,
                            "cache_control": {"type": "ephemeral"},
                        }
                    ],
                    messages=[{"role": "user", "content": user_message}],
                    output_format=ColumnAssessment,
                )
            except Exception as exc:
                log.warning("AI detector failed on column %s: %s", col, exc)
                continue

            assessment: ColumnAssessment | None = response.parsed_output
            if assessment is None:
                continue

            if not assessment.name_matches_content:
                out.append(
                    Finding(
                        detector=self.name,
                        severity=Severity.CRITICAL,
                        sheet=sheet.name,
                        column=str(col),
                        message=(
                            f"Column name '{col}' doesn't match its content — values look like "
                            f"{assessment.inferred_entity_type}. {assessment.issue_summary}"
                        ),
                        suggested_fix=f"Rename the column to describe {assessment.inferred_entity_type}, or move the misplaced data elsewhere.",
                        metadata={
                            "inferred_type": assessment.inferred_entity_type,
                            "cache_read": getattr(response.usage, "cache_read_input_tokens", 0),
                        },
                    )
                )

            if assessment.has_issues and assessment.suspect_value_indices:
                df_rows = [
                    sample_indices[i]
                    for i in assessment.suspect_value_indices
                    if i < len(sample_indices)
                ]
                out.append(
                    Finding(
                        detector=self.name,
                        severity=Severity.WARNING,
                        sheet=sheet.name,
                        column=str(col),
                        message=f"Column '{col}': {assessment.issue_summary}",
                        suggested_fix="Review the flagged values and correct or remove them.",
                        rows=df_rows,
                        metadata={"inferred_type": assessment.inferred_entity_type},
                    )
                )

        return out

    @staticmethod
    def _build_user_message(column_name: str, sample_values: list[str]) -> str:
        numbered = "\n".join(f"  [{i}] {v}" for i, v in enumerate(sample_values))
        return (
            f"Column header: {column_name!r}\n"
            f"Sample values (0-indexed within this sample):\n{numbered}\n\n"
            "Assess this column and return the structured result."
        )
