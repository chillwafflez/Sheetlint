"""Analysis endpoints — a two-step flow.

    POST /analysis/preview    multipart upload -> AnalysisPreview
    GET  /analysis/preview/{preview_id} -> AnalysisPreview
    POST /analysis            AnalysisConfig JSON -> 202 + JobCreated

The upload is stashed on the preview endpoint (file on disk, metadata in
PreviewStore). Configure then submits an AnalysisConfig referencing the
preview_id, which the analysis endpoint resolves to the temp file and
hands to a background task.
"""

from __future__ import annotations

import asyncio
import logging
import os
import tempfile
from collections.abc import Iterable
from contextlib import suppress
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Request, Response, UploadFile, status
from fastapi.concurrency import run_in_threadpool

from sheetlint.analysis.dependencies import PreviewStoreDep, ValidatedUpload
from sheetlint.analysis.exceptions import (
    InvalidAnalysisConfigError,
    InvalidExcelFileError,
    PreviewNotFoundError,
)
from sheetlint.analysis.parser import parse_excel
from sheetlint.analysis.preview import PreviewStore
from sheetlint.analysis.schemas import AnalysisConfig, AnalysisPreview, DetectorId
from sheetlint.analysis.service import analyze
from sheetlint.config import Settings, SettingsDep
from sheetlint.jobs.dependencies import JobStoreDep
from sheetlint.jobs.schemas import JobCreated
from sheetlint.jobs.service import JobStore

log = logging.getLogger(__name__)

router = APIRouter(prefix="/analysis", tags=["analysis"])


# --------------------------------------------------------------------------- #
# Preview — stage an upload and return worksheet metadata for the Configure UI
# --------------------------------------------------------------------------- #


@router.post(
    "/preview",
    response_model=AnalysisPreview,
    status_code=status.HTTP_201_CREATED,
    summary="Stage a workbook and return worksheet metadata",
    responses={
        201: {"description": "Preview created. POST /analysis to run the stack."},
        400: {"description": "Invalid file type, missing filename, or unparseable workbook."},
        413: {"description": "Upload exceeds the configured size limit."},
    },
)
async def create_preview(
    upload: ValidatedUpload,
    preview_store: PreviewStoreDep,
) -> AnalysisPreview:
    filename = upload.filename or "uploaded.xlsx"
    temp_path = await _persist_upload(upload)
    try:
        doc = await run_in_threadpool(parse_excel, str(temp_path), filename)
    except Exception as exc:
        log.warning("parse_excel failed on upload %s: %s", filename, exc)
        await _safe_unlink(temp_path)
        raise InvalidExcelFileError(
            f"Could not parse '{filename}' as an Excel workbook."
        ) from exc

    return await preview_store.create(doc=doc, temp_path=temp_path)


@router.get(
    "/preview/{preview_id}",
    response_model=AnalysisPreview,
    summary="Read a pending preview by id",
    responses={404: {"description": "Preview expired, consumed, or never existed."}},
)
async def get_preview(
    preview_id: UUID,
    preview_store: PreviewStoreDep,
) -> AnalysisPreview:
    preview = await preview_store.get(preview_id)
    if preview is None:
        raise PreviewNotFoundError(preview_id)
    return preview


# --------------------------------------------------------------------------- #
# Analysis — consume a preview and kick off the detector job
# --------------------------------------------------------------------------- #


@router.post(
    "",
    response_model=JobCreated,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Run the detector stack against a previously staged workbook",
    responses={
        202: {"description": "Job accepted; poll the status_url for the result."},
        400: {"description": "Config references an unknown worksheet."},
        404: {"description": "Preview expired, consumed, or never existed."},
    },
)
async def create_analysis(
    request: Request,
    response: Response,
    background: BackgroundTasks,
    config: AnalysisConfig,
    settings: SettingsDep,
    store: JobStoreDep,
    preview_store: PreviewStoreDep,
) -> JobCreated:
    preview = await preview_store.get(config.preview_id)
    if preview is None:
        raise PreviewNotFoundError(config.preview_id)

    available = {sheet.name for sheet in preview.sheets}
    missing = [name for name in config.sheets if name not in available]
    if missing:
        raise InvalidAnalysisConfigError(
            f"Preview does not contain sheet(s): {', '.join(missing)}."
        )

    file_path = await preview_store.path(config.preview_id)
    if file_path is None:
        # Window between .get and .path — preview expired mid-request.
        raise PreviewNotFoundError(config.preview_id)

    job = await store.create(filename=preview.filename)

    background.add_task(
        _run_analysis_job,
        store=store,
        preview_store=preview_store,
        job_id=job.id,
        preview_id=config.preview_id,
        file_path=file_path,
        filename=preview.filename,
        sheet_filter=list(config.sheets),
        detector_ids=list(config.detectors),
        settings=settings,
    )

    status_url = str(request.url_for("get_job", job_id=job.id))
    response.headers["Location"] = status_url
    return JobCreated(id=job.id, status=job.status, status_url=status_url)


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


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
        await _safe_unlink(path)
        raise
    return path


async def _safe_unlink(path: Path) -> None:
    with suppress(OSError):
        await asyncio.to_thread(path.unlink, missing_ok=True)


async def _run_analysis_job(
    *,
    store: JobStore,
    preview_store: PreviewStore,
    job_id: UUID,
    preview_id: UUID,
    file_path: Path,
    filename: str,
    sheet_filter: Iterable[str],
    detector_ids: Iterable[DetectorId],
    settings: Settings,
) -> None:
    """Background task — runs the detector stack on a worker thread, then
    discards the preview so the temp file is cleaned up exactly once."""
    await store.mark_running(job_id)
    try:
        _, result = await run_in_threadpool(
            analyze,
            file_path,
            filename=filename,
            enable_ai=settings.enable_ai,
            api_key=settings.anthropic_api_key,
            detector_ids=list(detector_ids),
            sheet_filter=list(sheet_filter),
        )
        await store.set_result(job_id, result)
    except Exception as exc:
        log.exception("Analysis job %s failed", job_id)
        await store.set_error(job_id, f"{type(exc).__name__}: {exc}")
    finally:
        await preview_store.discard(preview_id)
        await _safe_unlink(file_path)
