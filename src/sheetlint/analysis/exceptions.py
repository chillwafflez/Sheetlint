"""Analysis-domain exceptions — translated to HTTP responses by main.py."""

from __future__ import annotations

from uuid import UUID


class InvalidExcelFileError(Exception):
    """Upload didn't pass cheap pre-flight checks (extension, missing filename,
    or openpyxl couldn't parse it)."""

    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(reason)


class FileTooLargeError(Exception):
    """Upload exceeds the configured size limit."""

    def __init__(self, size_bytes: int, limit_bytes: int) -> None:
        self.size_bytes = size_bytes
        self.limit_bytes = limit_bytes
        super().__init__(f"File size {size_bytes} exceeds limit {limit_bytes}")


class PreviewNotFoundError(Exception):
    """Preview_id doesn't exist in the store (expired, consumed, or invalid)."""

    def __init__(self, preview_id: UUID) -> None:
        self.preview_id = preview_id
        super().__init__(f"Preview {preview_id} not found or expired")


class InvalidAnalysisConfigError(Exception):
    """Config references a sheet that isn't in the preview."""

    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(reason)
