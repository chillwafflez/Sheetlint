"""FastAPI application entry point.

Wires lifespan-managed singletons (JobStore + PreviewStore + their cleanup
tasks), CORS, the versioned API routers, exception handlers, and a /health
probe.

Run locally with:
    uv run uvicorn sheetlint.main:app --reload
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from sheetlint import __version__
from sheetlint.analysis.exceptions import (
    FileTooLargeError,
    InvalidAnalysisConfigError,
    InvalidExcelFileError,
    PreviewNotFoundError,
)
from sheetlint.analysis.preview import PreviewStore
from sheetlint.analysis.router import router as analysis_router
from sheetlint.config import SettingsDep, get_settings
from sheetlint.jobs.exceptions import JobNotFoundError
from sheetlint.jobs.router import router as jobs_router
from sheetlint.jobs.service import JobStore

log = logging.getLogger(__name__)

API_PREFIX = "/api/v1"


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    logging.basicConfig(
        level=settings.log_level.upper(),
        format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    )
    log.info("Starting sheetlint v%s in %s mode", __version__, settings.environment.value)

    app.state.job_store = JobStore(ttl_hours=settings.job_result_ttl_hours)
    app.state.preview_store = PreviewStore(ttl_minutes=settings.preview_ttl_minutes)

    job_cleanup = asyncio.create_task(
        _periodic(
            lambda: _run_job_cleanup(app.state.job_store),
            settings.job_cleanup_interval_seconds,
            "job cleanup",
        )
    )
    preview_cleanup = asyncio.create_task(
        _periodic(
            lambda: _run_preview_cleanup(app.state.preview_store),
            settings.preview_cleanup_interval_seconds,
            "preview cleanup",
        )
    )

    try:
        yield
    finally:
        for task in (job_cleanup, preview_cleanup):
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
        log.info("Shutdown complete")


async def _periodic(
    work: Callable[[], Awaitable[None]],
    interval_seconds: int,
    label: str,
) -> None:
    """Run `work` every `interval_seconds`. Swallows errors so one bad tick
    doesn't kill the loop."""
    while True:
        try:
            await asyncio.sleep(interval_seconds)
            await work()
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("%s tick failed", label)


async def _run_job_cleanup(store: JobStore) -> None:
    await store.cleanup_expired()


async def _run_preview_cleanup(store: PreviewStore) -> None:
    """Reap expired previews and unlink their temp files off the event loop."""
    for path in await store.cleanup_expired():
        await _unlink_path(path)


async def _unlink_path(path: Path) -> None:
    with suppress(OSError):
        await asyncio.to_thread(path.unlink, missing_ok=True)


def _build_app() -> FastAPI:
    settings = get_settings()
    docs_kwargs: dict[str, str | None] = {}
    if not settings.docs_enabled:
        docs_kwargs = {"openapi_url": None, "docs_url": None, "redoc_url": None}

    app = FastAPI(
        title="Sheetlint",
        version=__version__,
        description=(
            "Pre-handoff data quality inspector for messy human-entered Excel files. "
            "Stage an upload at `/analysis/preview`, then POST an `AnalysisConfig` "
            "to `/analysis` to run the detector stack and poll `/jobs/{id}`."
        ),
        lifespan=lifespan,
        **docs_kwargs,  # type: ignore[arg-type]
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(analysis_router, prefix=API_PREFIX)
    app.include_router(jobs_router, prefix=API_PREFIX)

    _register_exception_handlers(app)
    _register_health_route(app)
    return app


def _register_health_route(app: FastAPI) -> None:
    @app.get("/health", tags=["meta"], summary="Liveness probe")
    async def health(settings: SettingsDep) -> dict[str, str]:
        return {
            "status": "ok",
            "version": __version__,
            "environment": settings.environment.value,
        }


def _register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(InvalidExcelFileError)
    async def _invalid_file(_: Request, exc: InvalidExcelFileError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": exc.reason},
        )

    @app.exception_handler(FileTooLargeError)
    async def _file_too_large(_: Request, exc: FileTooLargeError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            content={
                "detail": str(exc),
                "size_bytes": exc.size_bytes,
                "limit_bytes": exc.limit_bytes,
            },
        )

    @app.exception_handler(InvalidAnalysisConfigError)
    async def _invalid_config(_: Request, exc: InvalidAnalysisConfigError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": exc.reason},
        )

    @app.exception_handler(PreviewNotFoundError)
    async def _preview_not_found(
        _: Request, exc: PreviewNotFoundError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": str(exc), "preview_id": str(exc.preview_id)},
        )

    @app.exception_handler(JobNotFoundError)
    async def _job_not_found(_: Request, exc: JobNotFoundError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": str(exc), "job_id": str(exc.job_id)},
        )


app = _build_app()
