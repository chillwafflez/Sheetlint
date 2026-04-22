"""Jobs-domain exceptions."""

from __future__ import annotations

from uuid import UUID


class JobNotFoundError(Exception):
    """Requested job_id is not in the store (expired or never existed)."""

    def __init__(self, job_id: UUID) -> None:
        self.job_id = job_id
        super().__init__(f"Job {job_id} not found")
