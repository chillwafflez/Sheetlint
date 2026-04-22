# Sheetlint — Claude project context

## What this is

A pre-handoff data-quality inspector for messy human-entered `.xlsx` files.
Catches structural, statistical, ML, and AI-driven semantic anomalies before
files reach an ingestion pipeline or a downstream consumer. Two personas:
**domain workers** (insurance, finance, mortgage) who clean files before
handoff, and **data engineers / analysts** who receive those files.

The project started as a 1-week Streamlit prototype assigned by the user's
tech lead. As of 2026-04-21 the Streamlit layer has been removed. The codebase
now ships as a **FastAPI backend** (Tier 1) wrapping the original
framework-free detector library, plus a **Next.js 16 frontend** (Tier 2)
that consumes the API.

## Stack

### Backend
- **Python 3.11+** (tested on 3.13 via conda / uv venv)
- **Package & env manager:** `uv` + `pyproject.toml` + `uv.lock`
- **Web:** FastAPI ≥0.122, Uvicorn, python-multipart
- **Validation & settings:** Pydantic v2, pydantic-settings
- **Data:** pandas ≥2.2, numpy, openpyxl (dual load — `data_only=True` and `=False`)
- **Detection:** STUMPY (matrix profile), rapidfuzz
- **AI:** anthropic SDK, `claude-opus-4-7`, adaptive thinking, prompt caching, structured outputs via `client.messages.parse()`
- **Testing:** pytest, pytest-asyncio, httpx (+ ASGITransport)
- **Lint / format:** ruff

### Frontend
- **Next.js 16** (App Router, Turbopack, typed routes), **React 19**, **TypeScript strict**
- **Styling:** Tailwind CSS v4, shadcn/ui (base-nova preset, neutral palette, lucide icons)
- **Data fetching:** TanStack Query v5 (mutation for upload, query with `refetchInterval` for job polling)
- **Validation:** Zod v4 — every `fetch().json()` goes through `.parse()` in `lib/api.ts`
- **Charts:** Plotly.js via react-plotly.js, dynamic-imported with `ssr: false`
- **Toasts:** sonner

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

9. **Frontend validates at the network boundary.** `frontend/lib/schemas.ts`
   mirrors the backend Pydantic models as Zod schemas; `lib/api.ts` pipes
   every response through `.parse()` before typed values leave the module.
   Keep schemas in lockstep with `src/sheetlint/{analysis,jobs}/schemas.py`.

10. **Frontend pages are Client Components.** The interactivity (upload,
    polling, filters, Plotly) demands it. Layouts that need route params
    use `useParams()`, not awaited `params` props. Plotly is always
    dynamic-imported with `{ ssr: false }` to keep the server bundle lean.

## File layout

```
sheetlint/
├── pyproject.toml, uv.lock, .env.example
├── samples/generate_sample.py
├── src/sheetlint/                   # ─── BACKEND ───
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
│   │       ├── structural.py, statistical.py, duplicates.py
│   │       ├── timeseries.py        # STUMPY + rolling z-score
│   │       └── ai.py                # Claude semantic checks (DI'd api_key)
│   └── jobs/
│       ├── router.py                # GET /api/v1/jobs/{id}
│       ├── schemas.py, service.py, dependencies.py, exceptions.py
├── tests/
│   ├── conftest.py                  # httpx.AsyncClient + ASGITransport
│   └── test_analysis_flow.py
└── frontend/                        # ─── FRONTEND ───
    ├── package.json, next.config.ts, tsconfig.json, components.json
    ├── .env.local.example
    ├── app/
    │   ├── layout.tsx, providers.tsx, globals.css
    │   ├── page.tsx                 # upload zone + landing hero
    │   └── analysis/[jobId]/
    │       ├── layout.tsx           # polls job, shows status + nav
    │       ├── page.tsx             # Overview
    │       ├── issues/page.tsx      # filterable table + CSV export
    │       └── time-series/page.tsx # Plotly per anomaly
    ├── components/
    │   ├── ui/                      # shadcn components (auto-generated)
    │   └── *.tsx                    # upload-zone, trust-score-card, etc.
    ├── lib/{schemas,api,env,utils}.ts
    └── hooks/{use-submit-analysis,use-job}.ts
```

## How to run

```bash
# Backend (terminal 1)
uv sync
cp .env.example .env
uv run uvicorn sheetlint.main:app --reload     # http://localhost:8000

# Frontend (terminal 2)
cd frontend
npm install
npm run dev                                    # http://localhost:3000

# Checks
uv run pytest                                  # backend test suite
uv run ruff check src tests                    # backend lint
cd frontend && npm run build                   # frontend type-check + build
cd frontend && npm run lint                    # frontend lint
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

## Frontend routes

- `/` — upload zone + landing hero
- `/analysis/[jobId]` — Overview (trust score, severity KPIs, per-detector
  breakdown, top critical findings, AI insights if any)
- `/analysis/[jobId]/issues` — filterable findings table with CSV export
- `/analysis/[jobId]/time-series` — Plotly charts with z-score + matrix-profile
  markers

Polling: `hooks/use-job.ts` calls `useQuery` with a `refetchInterval` that
halts once `status` is `succeeded` or `failed`. TanStack Query dedupes, so
every page that calls `useJob(id)` shares one cached poll loop.

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
