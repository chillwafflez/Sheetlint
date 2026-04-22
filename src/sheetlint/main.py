"""FastAPI application entry point.

Wires lifespan-managed singletons (JobStore + its cleanup task), CORS, the
versioned API routers, exception handlers, and a /health probe.

Run locally with:
    uv run uvicorn sheetlint.main:app --reload
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from sheetlint import __version__
from sheetlint.analysis.exceptions import FileTooLargeError, InvalidExcelFileError
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
    cleanup_task = asyncio.create_task(
        _periodic_cleanup(app.state.job_store, settings.job_cleanup_interval_seconds)
    )

    try:
        yield
    finally:
        cleanup_task.cancel()
        with suppress(asyncio.CancelledError):
            await cleanup_task
        log.info("Shutdown complete")


async def _periodic_cleanup(store: JobStore, interval_seconds: int) -> None:
    while True:
        try:
            await asyncio.sleep(interval_seconds)
            await store.cleanup_expired()
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("Job cleanup tick failed")


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
            "Submit a workbook to `/analysis`, then poll the returned job URL."
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

    @app.exception_handler(JobNotFoundError)
    async def _job_not_found(_: Request, exc: JobNotFoundError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": str(exc), "job_id": str(exc.job_id)},
        )


app = _build_app()
