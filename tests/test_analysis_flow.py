"""End-to-end smoke test for the analysis pipeline.

Exercises the full happy path:
    POST /api/v1/analysis (multipart upload) -> 202 + job_id
    GET  /api/v1/jobs/{id}                   -> poll until terminal
    Assert succeeded + findings present + trust_score below perfect
"""

from __future__ import annotations

import asyncio

import pytest
from httpx import AsyncClient

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

POLL_ATTEMPTS = 100
POLL_INTERVAL_SECONDS = 0.1


async def test_health(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["environment"] == "test"


async def test_analysis_flow_succeeds(client: AsyncClient, broken_workbook_bytes: bytes) -> None:
    submit = await client.post(
        "/api/v1/analysis",
        files={"file": ("broken.xlsx", broken_workbook_bytes, XLSX_MIME)},
    )
    assert submit.status_code == 202, submit.text
    created = submit.json()
    job_id = created["id"]
    assert created["status"] == "pending"
    assert created["status_url"].endswith(f"/api/v1/jobs/{job_id}")
    assert submit.headers.get("location") == created["status_url"]

    job = await _poll_until_terminal(client, job_id)
    assert job["status"] == "succeeded", job

    result = job["result"]
    assert result is not None
    assert result["filename"] == "broken.xlsx"
    assert len(result["findings"]) > 0
    assert result["trust_score"]["score"] < 100
    assert result["trust_score"]["grade"] in {"A", "B", "C", "D", "F"}


async def test_unknown_job_returns_404(client: AsyncClient) -> None:
    response = await client.get("/api/v1/jobs/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
    body = response.json()
    assert "not found" in body["detail"].lower()


async def test_invalid_extension_rejected(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/analysis",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    assert response.status_code == 400
    assert "extension" in response.json()["detail"].lower()


async def _poll_until_terminal(client: AsyncClient, job_id: str) -> dict:
    last: dict = {}
    for _ in range(POLL_ATTEMPTS):
        response = await client.get(f"/api/v1/jobs/{job_id}")
        assert response.status_code == 200, response.text
        last = response.json()
        if last["status"] in {"succeeded", "failed"}:
            return last
        await asyncio.sleep(POLL_INTERVAL_SECONDS)
    pytest.fail(f"Job did not complete in time. Last state: {last}")
