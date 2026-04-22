"""Analysis endpoint — accepts an Excel upload and kicks off a background job.

Returns 202 Accepted with a `JobCreated` body and a `Location` header pointing
at the polling URL. The actual detector stack runs in a background task that
hops onto a worker thread (`run_in_threadpool`) so the event loop stays free.
"""

from __future__ import annotations

import asyncio
import logging
import os
import tempfile
from contextlib import suppress
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Request, Response, UploadFile, status
from fastapi.concurrency import run_in_threadpool

from sheetlint.analysis.dependencies import ValidatedUpload
from sheetlint.analysis.service import analyze
from sheetlint.config import Settings, SettingsDep
from sheetlint.jobs.dependencies import JobStoreDep
from sheetlint.jobs.schemas import JobCreated
from sheetlint.jobs.service import JobStore

log = logging.getLogger(__name__)

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post(
    "",
    response_model=JobCreated,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Submit an Excel file for analysis",
    responses={
        202: {"description": "Job accepted; poll the status_url for the result."},
        400: {"description": "Invalid file type or missing filename."},
        413: {"description": "Upload exceeds the configured size limit."},
    },
)
async def create_analysis(
    request: Request,
    response: Response,
    background: BackgroundTasks,
    upload: ValidatedUpload,
    settings: SettingsDep,
    store: JobStoreDep,
) -> JobCreated:
    file_path = await _persist_upload(upload)
    filename = upload.filename or "uploaded.xlsx"
    job = await store.create(filename=filename)

    background.add_task(
        _run_analysis_job,
        store=store,
        job_id=job.id,
        file_path=file_path,
        filename=filename,
        settings=settings,
    )

    status_url = str(request.url_for("get_job", job_id=job.id))
    response.headers["Location"] = status_url
    return JobCreated(id=job.id, status=job.status, status_url=status_url)


async def _persist_upload(upload: UploadFile) -> Path:
    """Stream the upload to a temp file so the background task outlives the
    request scope. Caller is responsible for unlinking the result."""
    fd, name = tempfile.mkstemp(suffix=".xlsx", prefix="sheetlint_")
    path = Path(name)
    chunk_size = 64 * 1024
    try:
        with os.fdopen(fd, "wb") as out:
            while chunk := await upload.read(chunk_size):
                out.write(chunk)
    except Exception:
        await asyncio.to_thread(path.unlink, missing_ok=True)
        raise
    return path


async def _run_analysis_job(
    *,
    store: JobStore,
    job_id: UUID,
    file_path: Path,
    filename: str,
    settings: Settings,
) -> None:
    """Background task — runs the detector stack on a worker thread."""
    await store.mark_running(job_id)
    try:
        _, result = await run_in_threadpool(
            analyze,
            file_path,
            filename=filename,
            enable_ai=settings.enable_ai,
            api_key=settings.anthropic_api_key,
        )
        await store.set_result(job_id, result)
    except Exception as exc:
        log.exception("Analysis job %s failed", job_id)
        await store.set_error(job_id, f"{type(exc).__name__}: {exc}")
    finally:
        with suppress(OSError):
            await asyncio.to_thread(file_path.unlink)
