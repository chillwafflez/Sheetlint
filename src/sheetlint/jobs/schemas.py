"""Job tracking shapes — what the /jobs endpoints return."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, Field

from sheetlint.analysis.schemas import AnalysisResult


class JobStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"

    @property
    def is_terminal(self) -> bool:
        return self in {JobStatus.SUCCEEDED, JobStatus.FAILED}


class Job(BaseModel):
    """A tracked unit of analysis work."""

    id: UUID
    status: JobStatus
    filename: str
    created_at: datetime
    updated_at: datetime
    result: AnalysisResult | None = None
    error: str | None = Field(
        default=None,
        description="Populated when status is 'failed' — short human-readable reason.",
    )


class JobCreated(BaseModel):
    """Returned from POST /analysis when a job is accepted."""

    id: UUID
    status: JobStatus
    status_url: str = Field(description="Poll this URL to check job progress.")
