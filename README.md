# Sheetlint

Pre-handoff data quality inspector for messy, human-entered Excel files.
Catches structural, statistical, semantic, and time-series anomalies before
files reach an ingestion pipeline or a downstream consumer.

**Backend:** FastAPI wrapping a framework-free detector library.
**Frontend:** Next.js 16 (App Router) + shadcn/ui + TanStack Query + Plotly.

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

Requires **Python 3.11+** with [`uv`](https://docs.astral.sh/uv/) and
**Node.js 20+** with npm.

### Backend

```bash
pip install uv                            # if you don't have it
uv sync                                   # creates .venv, installs from uv.lock
cp .env.example .env                      # (optional) set ANTHROPIC_API_KEY
uv run uvicorn sheetlint.main:app --reload
```

API at <http://localhost:8000>; OpenAPI docs at <http://localhost:8000/docs>.

### Frontend

In a second terminal:

```bash
cd frontend
npm install
cp .env.local.example .env.local         # (optional) override NEXT_PUBLIC_API_URL
npm run dev
```

App at <http://localhost:3000>. The default CORS config on the backend
already permits `http://localhost:3000`.

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
├── pyproject.toml              # backend (uv-managed) + ruff/pytest config
├── uv.lock
├── .env.example
├── samples/
│   └── generate_sample.py      # builds a deliberately broken demo workbook
├── src/sheetlint/              # ─── BACKEND ───
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
│   │       ├── structural.py, statistical.py, duplicates.py
│   │       ├── timeseries.py   # STUMPY + rolling z-score
│   │       └── ai.py           # Claude semantic checks
│   └── jobs/                   # async job tracking bounded context
│       ├── router.py           # GET /api/v1/jobs/{id}
│       ├── schemas.py, service.py, exceptions.py, dependencies.py
├── tests/
│   ├── conftest.py             # httpx.AsyncClient + ASGITransport
│   └── test_analysis_flow.py
└── frontend/                   # ─── FRONTEND ───
    ├── package.json, next.config.ts, tsconfig.json, components.json
    ├── .env.local.example
    ├── app/
    │   ├── layout.tsx, providers.tsx, globals.css
    │   ├── page.tsx            # upload zone
    │   └── analysis/[jobId]/
    │       ├── layout.tsx      # polls job, renders nav + status banner
    │       ├── page.tsx        # Overview (trust score + KPIs + critical findings + AI)
    │       ├── issues/page.tsx # filterable table + CSV export
    │       └── time-series/page.tsx  # Plotly per anomaly
    ├── components/
    │   ├── ui/                 # shadcn components
    │   ├── upload-zone.tsx, trust-score-card.tsx, severity-kpis.tsx
    │   ├── finding-card.tsx, severity-badge.tsx, job-status-banner.tsx
    │   ├── analysis-nav.tsx, time-series-chart.tsx  # plotly, dynamic-imported
    ├── lib/
    │   ├── schemas.ts          # Zod mirroring backend Pydantic models
    │   ├── api.ts              # fetch client with Zod validation
    │   ├── env.ts              # validated NEXT_PUBLIC_* env
    │   └── utils.ts            # cn()
    └── hooks/
        ├── use-submit-analysis.ts  # TanStack useMutation → router.push
        └── use-job.ts              # TanStack useQuery with polling
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
# Backend
uv run pytest                       # run the test suite
uv run ruff check src tests         # lint
uv run ruff format src tests        # format

# Frontend (from frontend/)
npm run lint
npm run build                       # production build — type-checks everything
npm run dev                         # dev server with hot reload
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
