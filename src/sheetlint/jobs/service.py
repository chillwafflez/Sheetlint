"""In-memory JobStore — Tier 1 implementation.

This is the single point we'll swap for Redis in Tier 1.5/2. Keep the public
interface narrow so the swap is mechanical: `create`, `get`, `mark_running`,
`set_result`, `set_error`, `cleanup_expired`.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sheetlint.analysis.schemas import AnalysisResult
from sheetlint.jobs.schemas import Job, JobStatus

log = logging.getLogger(__name__)


class JobStore:
    """Thread-safe (asyncio-safe) in-process job registry."""

    def __init__(self, ttl_hours: int) -> None:
        self._jobs: dict[UUID, Job] = {}
        self._lock = asyncio.Lock()
        self._ttl = timedelta(hours=ttl_hours)

    async def create(self, filename: str) -> Job:
        now = datetime.now(UTC)
        job = Job(
            id=uuid4(),
            status=JobStatus.PENDING,
            filename=filename,
            created_at=now,
            updated_at=now,
        )
        async with self._lock:
            self._jobs[job.id] = job
        return job

    async def get(self, job_id: UUID) -> Job | None:
        async with self._lock:
            return self._jobs.get(job_id)

    async def mark_running(self, job_id: UUID) -> None:
        async with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            job.status = JobStatus.RUNNING
            job.updated_at = datetime.now(UTC)

    async def set_result(self, job_id: UUID, result: AnalysisResult) -> None:
        async with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            job.status = JobStatus.SUCCEEDED
            job.result = result
            job.updated_at = datetime.now(UTC)

    async def set_error(self, job_id: UUID, error: str) -> None:
        async with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            job.status = JobStatus.FAILED
            job.error = error
            job.updated_at = datetime.now(UTC)

    async def cleanup_expired(self) -> int:
        """Remove jobs whose updated_at is older than TTL. Returns count removed."""
        cutoff = datetime.now(UTC) - self._ttl
        async with self._lock:
            stale = [jid for jid, job in self._jobs.items() if job.updated_at < cutoff]
            for jid in stale:
                del self._jobs[jid]
        if stale:
            log.info("Cleaned up %d expired job(s)", len(stale))
        return len(stale)
