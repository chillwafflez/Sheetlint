"""End-to-end tests for the preview → analysis → job flow.

Covers:
    - /health liveness
    - POST /analysis/preview + GET /analysis/preview/{id}
    - POST /analysis (AnalysisConfig) → polling → succeeded job
    - Invalid extension, unknown preview, invalid sheet name, unknown job
"""

from __future__ import annotations

import asyncio
from uuid import uuid4

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


async def test_preview_returns_sheet_metadata(
    client: AsyncClient, broken_workbook_bytes: bytes
) -> None:
    preview = await _create_preview(client, broken_workbook_bytes)

    assert preview["filename"] == "broken.xlsx"
    assert len(preview["sheets"]) == 1
    sheet = preview["sheets"][0]
    assert sheet["name"] == "Submissions"
    assert sheet["row_count"] > 0
    assert sheet["col_count"] == 4
    assert "pre-header rows" in sheet["flags"]  # row 1 is the title row
    assert isinstance(sheet["preview"]["headers"], list)
    assert len(sheet["preview"]["rows"]) > 0


async def test_preview_can_be_refetched_by_id(
    client: AsyncClient, broken_workbook_bytes: bytes
) -> None:
    created = await _create_preview(client, broken_workbook_bytes)
    fetched = await client.get(f"/api/v1/analysis/preview/{created['preview_id']}")
    assert fetched.status_code == 200
    assert fetched.json()["preview_id"] == created["preview_id"]


async def test_unknown_preview_returns_404(client: AsyncClient) -> None:
    response = await client.get(f"/api/v1/analysis/preview/{uuid4()}")
    assert response.status_code == 404


async def test_analysis_flow_succeeds(
    client: AsyncClient, broken_workbook_bytes: bytes
) -> None:
    preview = await _create_preview(client, broken_workbook_bytes)

    submit = await client.post(
        "/api/v1/analysis",
        json={
            "preview_id": preview["preview_id"],
            "sheets": [preview["sheets"][0]["name"]],
            "detectors": ["structural", "statistical", "duplicates"],
        },
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


async def test_detector_filter_is_honored(
    client: AsyncClient, broken_workbook_bytes: bytes
) -> None:
    preview = await _create_preview(client, broken_workbook_bytes)

    submit = await client.post(
        "/api/v1/analysis",
        json={
            "preview_id": preview["preview_id"],
            "sheets": [preview["sheets"][0]["name"]],
            "detectors": ["structural"],
        },
    )
    assert submit.status_code == 202
    job = await _poll_until_terminal(client, submit.json()["id"])
    result = job["result"]
    assert result is not None
    detectors_fired = {f["detector"] for f in result["findings"]}
    assert detectors_fired <= {"Structural"}, detectors_fired


async def test_preview_cannot_be_reused(
    client: AsyncClient, broken_workbook_bytes: bytes
) -> None:
    preview = await _create_preview(client, broken_workbook_bytes)
    config = {
        "preview_id": preview["preview_id"],
        "sheets": [preview["sheets"][0]["name"]],
        "detectors": ["structural"],
    }

    first = await client.post("/api/v1/analysis", json=config)
    assert first.status_code == 202
    await _poll_until_terminal(client, first.json()["id"])

    # Second submission with the same preview_id — the background task
    # discards the preview on completion, so this must 404.
    second = await client.post("/api/v1/analysis", json=config)
    assert second.status_code == 404


async def test_unknown_sheet_in_config_rejected(
    client: AsyncClient, broken_workbook_bytes: bytes
) -> None:
    preview = await _create_preview(client, broken_workbook_bytes)
    response = await client.post(
        "/api/v1/analysis",
        json={
            "preview_id": preview["preview_id"],
            "sheets": ["NoSuchSheet"],
            "detectors": ["structural"],
        },
    )
    assert response.status_code == 400
    assert "NoSuchSheet" in response.json()["detail"]


async def test_unknown_job_returns_404(client: AsyncClient) -> None:
    response = await client.get(
        "/api/v1/jobs/00000000-0000-0000-0000-000000000000"
    )
    assert response.status_code == 404
    body = response.json()
    assert "not found" in body["detail"].lower()


async def test_invalid_extension_rejected(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/analysis/preview",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    assert response.status_code == 400
    assert "extension" in response.json()["detail"].lower()


async def test_unparseable_xlsx_rejected(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/analysis/preview",
        files={"file": ("fake.xlsx", b"not really an xlsx", XLSX_MIME)},
    )
    assert response.status_code == 400


async def _create_preview(client: AsyncClient, workbook_bytes: bytes) -> dict:
    response = await client.post(
        "/api/v1/analysis/preview",
        files={"file": ("broken.xlsx", workbook_bytes, XLSX_MIME)},
    )
    assert response.status_code == 201, response.text
    return response.json()


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
