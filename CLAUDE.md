# Sheetlint — Claude project context

## What this is

A pre-handoff data-quality inspector for messy human-entered `.xlsx` files.
Catches structural, statistical, ML, and AI-driven semantic anomalies before
files reach an ingestion pipeline or a downstream consumer. Two personas:
**domain workers** (insurance, finance, mortgage) who clean files before
handoff, and **data engineers / analysts** who receive those files.

The project started as a 1-week Streamlit prototype assigned by the user's
tech lead. As of 2026-04-21 the Streamlit layer has been removed and the
codebase now ships as a **FastAPI backend** wrapping the original
framework-free detector library (Tier 1 of the production migration plan).
A Next.js frontend will consume the API in Tier 2.

## Stack

- **Python 3.11+** (tested on 3.13 via conda / uv venv)
- **Package & env manager:** `uv` + `pyproject.toml` + `uv.lock`
- **Web:** FastAPI ≥0.122, Uvicorn, python-multipart
- **Validation & settings:** Pydantic v2, pydantic-settings
- **Data:** pandas ≥2.2, numpy, openpyxl (dual load — `data_only=True` and `=False`)
- **Detection:** STUMPY (matrix profile), rapidfuzz
- **AI:** anthropic SDK, `claude-opus-4-7`, adaptive thinking, prompt caching, structured outputs via `client.messages.parse()`
- **Testing:** pytest, pytest-asyncio, httpx (+ ASGITransport)
- **Lint / format:** ruff (replaces black, isort, autoflake)

## Architectural rules

1. **Detectors are framework-free.** Nothing under
   `src/sheetlint/analysis/detectors/` or `src/sheetlint/analysis/{parser,scoring,service}.py`
   may import FastAPI, web frameworks, or Streamlit. The core is drivable
   from a script, test, notebook, or future worker queue. This is why the
   API wrapper was a one-day job.

2. **Detector Protocol is the contract.** Every detector implements:
   ```python
   class Detector(Protocol):
       name: str
       def run(self, doc: ExcelDocument) -> list[Finding]: ...
   ```
   Drop a new file in `src/sheetlint/analysis/detectors/`, register it in
   `detectors/__init__.py`, it shows up in every response automatically.
   No router or schema changes needed.

3. **Dual openpyxl load is non-negotiable.** `parser.py` loads each workbook
   twice — `data_only=True` for calculated values, `data_only=False` for
   formula strings. This is the only way to see merged cells, formulas,
   and Excel error literals. Pandas alone cannot.

4. **One broken detector can't kill the report.** `service.py` wraps each
   detector in try/except and logs failures.

5. **Sample file mirrors detector surface.** `samples/generate_sample.py`
   seeds *one of every issue type*. When you add a new detector, add a
   deliberate trigger to the sample so the demo continues to showcase the
   full surface.

6. **Claude API defaults:** model `claude-opus-4-7`,
   `thinking={"type": "adaptive"}`, prompt caching on the stable system
   prompt, structured outputs via `messages.parse()` with a Pydantic
   `ColumnAssessment` model. Deterministic sampling (first N rows, not
   random) so the cache prefix stays stable.

7. **Pydantic schemas cross the API boundary.** `analysis/schemas.py`
   (`Finding`, `AnalysisResult`, `AnomalyResult`, `TrustScore`) is the
   single source of truth — detectors construct them, routers return them
   via `response_model`. No separate DTO layer in Tier 1.

8. **Domain packages own their surface.** Each bounded context (analysis,
   jobs) has its own `router.py`, `schemas.py`, `service.py`,
   `dependencies.py`, `exceptions.py`. Cross-domain imports are explicit
   — never wildcard.

## File layout

```
sheetlint/
├── pyproject.toml                   # uv project + ruff + pytest config
├── uv.lock
├── .env.example
├── samples/
│   └── generate_sample.py           # seeds the broken demo workbook
├── src/sheetlint/
│   ├── main.py                      # FastAPI app, lifespan, CORS, handlers
│   ├── config.py                    # pydantic-settings global Settings
│   ├── analysis/
│   │   ├── router.py                # POST /api/v1/analysis
│   │   ├── schemas.py               # Finding, AnalysisResult, etc. (Pydantic v2)
│   │   ├── service.py               # analyze() orchestration
│   │   ├── parser.py                # dual openpyxl load + header detection
│   │   ├── scoring.py               # compute_trust_score(findings) -> TrustScore
│   │   ├── dependencies.py          # ValidatedUpload dependency
│   │   ├── exceptions.py
│   │   └── detectors/
│   │       ├── base.py              # Detector Protocol
│   │       ├── structural.py
│   │       ├── statistical.py
│   │       ├── duplicates.py
│   │       ├── timeseries.py        # STUMPY + rolling z-score
│   │       └── ai.py                # Claude semantic checks (DI'd api_key)
│   └── jobs/
│       ├── router.py                # GET /api/v1/jobs/{id}
│       ├── schemas.py               # Job, JobStatus, JobCreated
│       ├── service.py               # in-memory JobStore (asyncio.Lock + dict)
│       ├── dependencies.py          # JobStoreDep, valid_job_id
│       └── exceptions.py
└── tests/
    ├── conftest.py                  # httpx.AsyncClient + ASGITransport
    └── test_analysis_flow.py
```

## How to run

```bash
uv sync                                        # creates .venv, installs all deps
cp .env.example .env                           # (optional) set ANTHROPIC_API_KEY
uv run uvicorn sheetlint.main:app --reload     # API at http://localhost:8000
uv run pytest                                  # run the test suite
uv run ruff check src tests                    # lint
```

## Endpoints

- `GET /health` — liveness probe
- `POST /api/v1/analysis` — multipart upload, returns `202 + JobCreated` with
  a `Location` header pointing at the polling URL. The detector stack runs
  as a FastAPI `BackgroundTask` that hops onto a worker thread via
  `run_in_threadpool` so the event loop stays free for CPU-heavy detectors
  (STUMPY, openpyxl).
- `GET /api/v1/jobs/{id}` — poll for job state; once `status` is `succeeded`,
  `result` holds the full `AnalysisResult`.

## Conventions

- Follow existing module structure when adding detectors. Lift the same
  patterns: module-level constants for thresholds, `_helper` functions,
  one public class with `name` and `run()`.
- Severity policy: `CRITICAL` for breaks-the-pipeline issues, `WARNING`
  for likely-wrong-or-suspicious, `INFO` for FYI.
- Always populate `Finding.suggested_fix` — that's the difference between
  "report" and "useful report."
- Free-form chart data goes in `Finding.metadata` (e.g. the time-series
  detector stashes `dates`/`values`/`z_flagged`/`mp_flagged` there for
  future chart endpoints).
- For domain errors, define an exception class in the domain's
  `exceptions.py`, then map it to an HTTP response via an
  `@app.exception_handler` in `main.py`.

## Known Tier 1 limitations (to fix in Tier 1.5/2)

- **In-memory JobStore.** Dies with the worker; single-process only. Swap
  for Redis-backed storage — the `JobStore` interface in `jobs/service.py`
  is the exact shape to port.
- **BackgroundTasks, not Celery.** If the worker dies mid-analysis, the
  job is lost. Acceptable now because the job registry is also in-memory;
  upgrade both together.
- **AI detector is sequential.** Per-column Claude calls could be
  `asyncio.gather`'d for a big latency win on wide sheets.
- **No persistence of past runs.** Every analysis is fresh; there's no
  history, no share links, no auth.

## Where to find more

`context/project-context.md` is the live, evolving document — read it for
full history, decision log, current progress, and the production migration
plan. Update it at the end of any non-trivial work session so the next
Claude session can pick up cold.
