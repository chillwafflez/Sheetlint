"""Job endpoints — clients poll here after POST /analysis returns 202."""

from __future__ import annotations

from fastapi import APIRouter, status

from sheetlint.jobs.dependencies import JobDep
from sheetlint.jobs.schemas import Job

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get(
    "/{job_id}",
    response_model=Job,
    status_code=status.HTTP_200_OK,
    summary="Get job status and result",
    responses={404: {"description": "Job not found or expired"}},
)
async def get_job(job: JobDep) -> Job:
    """Return the current state of a job. Once `status` is `succeeded`,
    `result` will contain the full `AnalysisResult`."""
    return job
