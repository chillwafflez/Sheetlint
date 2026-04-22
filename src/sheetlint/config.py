"""Global application settings — loaded from environment via pydantic-settings.

Env vars are unprefixed at the top level for clarity. When a domain grows
enough variables to warrant scoping, split it into its own `BaseSettings`
subclass with `env_prefix` per the FastAPI best-practices guide.
"""

from __future__ import annotations

from enum import StrEnum
from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(StrEnum):
    LOCAL = "local"
    STAGING = "staging"
    PRODUCTION = "production"
    TEST = "test"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    environment: Environment = Environment.LOCAL
    log_level: str = "INFO"

    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    max_upload_size_mb: int = 50
    accepted_extensions: list[str] = Field(default_factory=lambda: [".xlsx"])

    job_result_ttl_hours: int = 24
    job_cleanup_interval_seconds: int = 600

    # AI layer — if key is None, the AI detector silently no-ops.
    anthropic_api_key: str | None = None
    enable_ai: bool = True

    @property
    def docs_enabled(self) -> bool:
        """Hide Swagger / ReDoc in production."""
        return self.environment in {Environment.LOCAL, Environment.STAGING}

    @property
    def max_upload_size_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()


SettingsDep = Annotated[Settings, Depends(get_settings)]
