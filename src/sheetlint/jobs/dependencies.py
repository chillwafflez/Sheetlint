"""Jobs-domain dependencies — store accessor + path-param validators."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends, Request

from sheetlint.jobs.exceptions import JobNotFoundError
from sheetlint.jobs.schemas import Job
from sheetlint.jobs.service import JobStore


def get_job_store(request: Request) -> JobStore:
    """Pull the JobStore singleton off app.state (initialized in lifespan)."""
    return request.app.state.job_store


JobStoreDep = Annotated[JobStore, Depends(get_job_store)]


async def valid_job_id(job_id: UUID, store: JobStoreDep) -> Job:
    job = await store.get(job_id)
    if job is None:
        raise JobNotFoundError(job_id)
    return job


JobDep = Annotated[Job, Depends(valid_job_id)]
