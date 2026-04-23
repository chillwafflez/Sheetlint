"""Preview registry — stages uploaded files + sheet metadata between the
/preview endpoint and the /analysis endpoint.

Same shape as `JobStore` on purpose: both move to Redis together in the
Tier 1.5 upgrade. Values carry a temp file path alongside the parsed
metadata; callers never touch the path directly, they ask the store to
resolve a preview_id when they're ready to run the analysis.
"""

from __future__ import annotations

import asyncio
import logging
import math
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import pandas as pd
from openpyxl.utils import range_boundaries

from sheetlint.analysis.parser import ExcelDocument, SheetView
from sheetlint.analysis.schemas import (
    AnalysisPreview,
    SheetMetadata,
    SheetPreview,
)

log = logging.getLogger(__name__)

# Flag strings are display-ready labels; if logic ever depends on them,
# promote to a proper StrEnum and let the UI map ids to labels.
_FLAG_HIDDEN = "hidden"
_FLAG_MERGED = "merged cells"
_FLAG_FORMULA_ERRORS = "formula errors"
_FLAG_PRE_HEADER = "pre-header rows"
_FLAG_EMPTY = "empty"
_FLAG_WIDE = "wide"
_FLAG_CLEAN = "looks clean"

_WIDE_COL_THRESHOLD = 20
_PREVIEW_ROW_COUNT = 5


def _cell_to_str(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    try:
        if pd.isna(value):
            return ""
    except (TypeError, ValueError):
        # pd.isna rejects exotic values (e.g. arrays); fall through.
        pass
    return str(value)


def _preview_of(sheet: SheetView) -> SheetPreview:
    if sheet.df.empty:
        return SheetPreview(headers=[], rows=[])
    headers = [str(c) for c in sheet.df.columns]
    top = sheet.df.head(_PREVIEW_ROW_COUNT)
    rows: list[list[str]] = [
        [_cell_to_str(v) for v in row.tolist()] for _, row in top.iterrows()
    ]
    return SheetPreview(headers=headers, rows=rows)


def _flags_for(sheet: SheetView) -> list[str]:
    flags: list[str] = []
    if sheet.is_hidden:
        flags.append(_FLAG_HIDDEN)
    if sheet.header_row > 1:
        flags.append(_FLAG_PRE_HEADER)
    for merged in sheet.merged_ranges:
        try:
            _, min_row, _, _ = range_boundaries(merged)
        except ValueError:
            continue
        if min_row is not None and min_row > sheet.header_row:
            flags.append(_FLAG_MERGED)
            break
    if sheet.error_cells:
        flags.append(_FLAG_FORMULA_ERRORS)
    if sheet.n_rows == 0:
        flags.append(_FLAG_EMPTY)
    if sheet.n_cols > _WIDE_COL_THRESHOLD:
        flags.append(_FLAG_WIDE)
    if not flags:
        flags.append(_FLAG_CLEAN)
    return flags


def build_sheet_metadata(sheet: SheetView) -> SheetMetadata:
    return SheetMetadata(
        name=sheet.name,
        row_count=sheet.n_rows,
        col_count=sheet.n_cols,
        hidden=sheet.is_hidden,
        header_row=sheet.header_row,
        flags=_flags_for(sheet),
        preview=_preview_of(sheet),
    )


def build_preview_from_doc(
    doc: ExcelDocument,
    *,
    preview_id: UUID,
    ttl: timedelta,
) -> AnalysisPreview:
    now = datetime.now(UTC)
    return AnalysisPreview(
        preview_id=preview_id,
        filename=doc.filename,
        created_at=now,
        expires_at=now + ttl,
        sheets=[build_sheet_metadata(s) for s in doc.sheets],
    )


@dataclass
class _PreviewEntry:
    preview: AnalysisPreview
    temp_path: Path


class PreviewStore:
    """Async-safe registry for staged uploads awaiting configuration."""

    def __init__(self, ttl_minutes: int) -> None:
        self._entries: dict[UUID, _PreviewEntry] = {}
        self._lock = asyncio.Lock()
        self._ttl = timedelta(minutes=ttl_minutes)

    @property
    def ttl(self) -> timedelta:
        return self._ttl

    async def create(
        self, *, doc: ExcelDocument, temp_path: Path
    ) -> AnalysisPreview:
        preview_id = uuid4()
        preview = build_preview_from_doc(doc, preview_id=preview_id, ttl=self._ttl)
        async with self._lock:
            self._entries[preview_id] = _PreviewEntry(
                preview=preview, temp_path=temp_path
            )
        return preview

    async def get(self, preview_id: UUID) -> AnalysisPreview | None:
        async with self._lock:
            entry = self._entries.get(preview_id)
            if entry is None:
                return None
            if entry.preview.expires_at < datetime.now(UTC):
                return None
            return entry.preview

    async def path(self, preview_id: UUID) -> Path | None:
        """Resolve a preview_id to its temp file path if still valid."""
        async with self._lock:
            entry = self._entries.get(preview_id)
            if entry is None:
                return None
            if entry.preview.expires_at < datetime.now(UTC):
                return None
            return entry.temp_path

    async def discard(self, preview_id: UUID) -> Path | None:
        """Remove the preview and return its temp path (for caller to unlink)."""
        async with self._lock:
            entry = self._entries.pop(preview_id, None)
        return entry.temp_path if entry is not None else None

    async def cleanup_expired(self) -> list[Path]:
        """Drop expired entries. Returns their temp paths for caller to unlink."""
        now = datetime.now(UTC)
        freed: list[Path] = []
        async with self._lock:
            expired = [
                pid
                for pid, entry in self._entries.items()
                if entry.preview.expires_at < now
            ]
            for pid in expired:
                entry = self._entries.pop(pid)
                freed.append(entry.temp_path)
        if freed:
            log.info("Cleaned up %d expired preview(s)", len(freed))
        return freed
