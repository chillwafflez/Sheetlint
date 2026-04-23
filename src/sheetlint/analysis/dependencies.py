"""Analysis-domain dependencies — upload validation and store accessors."""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

from fastapi import Depends, Request, UploadFile

from sheetlint.analysis.exceptions import FileTooLargeError, InvalidExcelFileError
from sheetlint.analysis.preview import PreviewStore
from sheetlint.config import SettingsDep


async def validate_upload(file: UploadFile, settings: SettingsDep) -> UploadFile:
    """Cheap pre-flight: extension + size. Content validity is openpyxl's job."""
    if not file.filename:
        raise InvalidExcelFileError("Upload is missing a filename.")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in settings.accepted_extensions:
        raise InvalidExcelFileError(
            f"Extension '{suffix}' not accepted. Allowed: {', '.join(settings.accepted_extensions)}."
        )

    if file.size is not None and file.size > settings.max_upload_size_bytes:
        raise FileTooLargeError(file.size, settings.max_upload_size_bytes)

    return file


ValidatedUpload = Annotated[UploadFile, Depends(validate_upload)]


def get_preview_store(request: Request) -> PreviewStore:
    """Pull the PreviewStore singleton off app.state (initialized in lifespan)."""
    return request.app.state.preview_store


PreviewStoreDep = Annotated[PreviewStore, Depends(get_preview_store)]
