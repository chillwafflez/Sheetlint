"""Analysis-domain exceptions — translated to HTTP responses by main.py."""

from __future__ import annotations


class InvalidExcelFileError(Exception):
    """Upload didn't pass cheap pre-flight checks (extension, missing filename)."""

    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(reason)


class FileTooLargeError(Exception):
    """Upload exceeds the configured size limit."""

    def __init__(self, size_bytes: int, limit_bytes: int) -> None:
        self.size_bytes = size_bytes
        self.limit_bytes = limit_bytes
        super().__init__(f"File size {size_bytes} exceeds limit {limit_bytes}")
