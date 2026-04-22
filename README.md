# Sheetlint

Pre-handoff data quality inspector for messy, human-entered Excel files.
Catches structural, statistical, semantic, and time-series anomalies before
files reach an ingestion pipeline or a downstream consumer.

A FastAPI backend wraps a framework-free detector library. Submit an `.xlsx`
to `POST /api/v1/analysis`, then poll the returned job URL for the report.

## Who it's for

- **Domain workers** (insurance agents, finance analysts, mortgage processors)
  who prepare Excel files and want to clean them before handing off.
- **Data engineers / analysts** who receive those files and need a structured
  issue report so they can push back on specific problems.

## What it detects

| Category | Examples |
|---|---|
| **Structural** | Merged cells in data rows, mid-sheet header shifts, hidden sheets, formula errors (`#REF!`, `#N/A`), empty rows/cols |
| **Statistical** | Type purity (97% numeric, 3% strings in rows 103–200), regex pattern coverage, null density |
| **Duplicates** | Exact duplicate rows, fuzzy near-duplicates (`"Californa"` vs `"California"`) |
| **Time-series** | STUMPY matrix-profile discords + rolling z-score ensemble for spikes and unusual patterns |
| **Semantic (AI)** | Column-name-vs-content mismatch, entity-type drift, cross-column logical checks |

## Setup

Requires **Python 3.11+** and [`uv`](https://docs.astral.sh/uv/) for dependency management.

```bash
# 1. Install uv if you don't have it
pip install uv

# 2. Sync dependencies (creates .venv, installs everything from uv.lock)
uv sync

# 3. Configure environment (optional — sensible defaults are baked in)
cp .env.example .env
# edit .env to set ANTHROPIC_API_KEY if you want AI semantic checks

# 4. Run the API
uv run uvicorn sheetlint.main:app --reload
```

The API is at <http://localhost:8000>; OpenAPI docs at <http://localhost:8000/docs>.

## API

### Submit a workbook for inspection

```bash
curl -X POST http://localhost:8000/api/v1/analysis \
  -F "file=@/path/to/workbook.xlsx"
```

Response (`202 Accepted`):

```json
{
  "id": "8b8c4f9e-4f6a-4c2d-9d1f-d5d1c5a7e4d3",
  "status": "pending",
  "status_url": "http://localhost:8000/api/v1/jobs/8b8c4f9e-..."
}
```

### Poll for the result

```bash
curl http://localhost:8000/api/v1/jobs/{id}
```

Once `status` is `succeeded`, `result` contains the full `AnalysisResult` —
findings, anomalies, trust score, grade, and per-detector breakdown.

## Project structure

```
sheetlint/
├── pyproject.toml              # uv-managed project + ruff/pytest config
├── uv.lock
├── .env.example
├── samples/
│   └── generate_sample.py      # builds a deliberately broken demo workbook
├── src/sheetlint/
│   ├── main.py                 # FastAPI app, lifespan, CORS, exception handlers
│   ├── config.py               # pydantic-settings
│   ├── analysis/               # analysis bounded context
│   │   ├── router.py           # POST /api/v1/analysis
│   │   ├── schemas.py          # Finding, AnalysisResult, AnomalyResult, TrustScore
│   │   ├── service.py          # orchestration (parse + run detectors + score)
│   │   ├── parser.py           # dual openpyxl load
│   │   ├── scoring.py          # trust score computation
│   │   ├── exceptions.py
│   │   ├── dependencies.py     # upload validation
│   │   └── detectors/          # framework-free detector stack
│   │       ├── base.py         # Detector Protocol
│   │       ├── structural.py
│   │       ├── statistical.py
│   │       ├── duplicates.py
│   │       ├── timeseries.py   # STUMPY + rolling z-score
│   │       └── ai.py           # Claude semantic checks
│   └── jobs/                   # async job tracking bounded context
│       ├── router.py           # GET /api/v1/jobs/{id}
│       ├── schemas.py
│       ├── service.py          # in-memory JobStore (Tier 1 — Redis later)
│       ├── exceptions.py
│       └── dependencies.py
└── tests/
    ├── conftest.py             # httpx.AsyncClient + ASGITransport
    └── test_analysis_flow.py
```

## Adding a new detector

Every detector implements the same protocol:

```python
class Detector(Protocol):
    name: str
    def run(self, doc: ExcelDocument) -> list[Finding]: ...
```

1. Drop a new file in `src/sheetlint/analysis/detectors/`.
2. Register it in `detectors/__init__.py` (`default_detectors()`).
3. Add a deliberate trigger to `samples/generate_sample.py` so the demo
   continues to surface every detector.

No changes to the router, schemas, or scoring are needed — the orchestrator
picks it up automatically.

## Development

```bash
uv run pytest              # run the test suite
uv run ruff check src tests
uv run ruff format src tests
```

## Notes

- The AI detector uses `claude-opus-4-7` with adaptive thinking and prompt
  caching on the system prompt. One LLM call per column, deterministic
  sampling so the cache prefix stays stable across re-runs. If
  `ANTHROPIC_API_KEY` is unset the detector silently no-ops and the rest
  of the stack still runs.
- STUMPY needs ≥ ~50 points in a time series to be meaningful. Shorter
  series fall back to rolling z-score only.
- Only `.xlsx` is supported. `.xls`, `.csv`, and `.xlsm` would extend
  `analysis/parser.py`.
- The in-memory `JobStore` is Tier 1 — single-worker only. For real
  production deploys, swap it for Redis-backed storage with the same
  interface (see `jobs/service.py`).
