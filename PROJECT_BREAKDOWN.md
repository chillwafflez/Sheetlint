# Sheetlint — Full Project Deconstruction

> A presentation-grade breakdown of the **Sheetlint** project (codename
> "excel-detector"): what it does, why it exists, every technology in the
> stack, the architecture end-to-end, and every feature surface.
>
> Use this document as your study guide. It assumes zero prior familiarity and
> walks from "what problem does this solve" all the way down to the specific
> algorithms, API shapes, and hooks.

---

## Table of Contents

1. [Elevator Pitch](#1-elevator-pitch)
2. [The Problem It Solves](#2-the-problem-it-solves)
3. [Who Uses It — Two Personas](#3-who-uses-it--two-personas)
4. [The Tech Stack in Full](#4-the-tech-stack-in-full)
5. [High-Level Architecture](#5-high-level-architecture)
6. [End-to-End Request Flow](#6-end-to-end-request-flow)
7. [Backend Deep Dive](#7-backend-deep-dive)
8. [The Five Detectors](#8-the-five-detectors)
9. [The Trust Score](#9-the-trust-score)
10. [Frontend Deep Dive](#10-frontend-deep-dive)
11. [API Contract](#11-api-contract)
12. [Feature Catalogue](#12-feature-catalogue)
13. [Design System](#13-design-system)
14. [Testing, Linting, Tooling](#14-testing-linting-tooling)
15. [Known Limitations & Roadmap](#15-known-limitations--roadmap)
16. [Key Design Decisions (with "why")](#16-key-design-decisions-with-why)
17. [Presentation Cheat Sheet](#17-presentation-cheat-sheet)

---

## 1. Elevator Pitch

**Sheetlint is a pre-handoff data-quality inspector for messy, human-entered
Excel files.** You drop an `.xlsx` file in, pick which worksheets and which
detectors to run, and Sheetlint returns:

- A single **0–100 trust score** with a letter grade (A+ → F).
- A ranked list of **findings** grouped by severity (critical / warning / info),
  each with a plain-English `suggested_fix`.
- Per-column **time-series charts** with anomalies marked.
- A **CSV export** of the whole report.

It runs **five detector families** (structural / statistical / duplicates /
time-series / AI semantic) driven by openpyxl, pandas, rapidfuzz, STUMPY
matrix profiles, and Claude (`claude-opus-4-7` with prompt caching and
structured outputs).

Architecturally it is a **FastAPI backend + Next.js 16 frontend**, with the
detector library deliberately kept free of any web framework so it can be
driven from scripts, tests, or a future worker queue.

---

## 2. The Problem It Solves

Data engineers, analysts, and automation pipelines repeatedly get wrecked by
the same class of `.xlsx` problems when files come from non-technical
business users:

| Symptom in the wild | Why it breaks a pipeline |
|---|---|
| Title/notes rows **above** the real header | `pd.read_excel()` treats them as column headers and corrupts the schema. |
| **Merged cells** in the data region | Programmatic readers see the top-left value and `NaN` for the rest. |
| **Currency-as-text** mixed into a numeric column (`$1,200.00`) | Type coercion fails or silently drops the row. |
| **Fuzzy typos** in categorical columns (`Californa`, `Texsas`) | Joins and `GROUP BY`s split one cohort into several. |
| **Formula errors** (`#DIV/0!`, `#REF!`) | Downstream math inherits the error literal as a string. |
| **Hidden sheets** with sensitive internal notes | Privacy / compliance surprise. |
| **Spikes** in a time series that turn out to be typos | Skews dashboards until someone re-derives the source of truth. |
| **Column whose name doesn't match its content** | Silent data corruption no regex detector can catch. |

Every cleanup is manual and repeats per file. Sheetlint **automates the
pre-flight check** so the producer fixes the file before handoff, and the
consumer sees a concrete, prioritized list.

---

## 3. Who Uses It — Two Personas

The same findings serve two very different audiences, separated only by UI
presentation.

### Persona A — The Domain Worker
- Insurance agent, finance staff, mortgage processor.
- Lives in Excel; not a developer; won't read tracebacks.
- Core question: *"Is my file clean enough to send?"*
- **Surface:** the **0–100 trust score**, the colored severity badges, and
  the plain-language `suggested_fix` strings.

### Persona B — The Data Engineer / Analyst
- Receives the workbook from Persona A and pipes it into Spark / a warehouse.
- Core question: *"What specifically is wrong so I can push back with
  evidence?"*
- **Surface:** the **Issues table** with filters, the per-detector breakdown,
  the row indices, the time-series chart, the **CSV export**.

Both personas read the same `Finding` objects — separation is purely
presentational.

---

## 4. The Tech Stack in Full

### 4.1 Backend

| Area | Tech | Why |
|---|---|---|
| Language | **Python ≥3.11** (tested on 3.13) | Modern typing (`StrEnum`, `X \| None`, generic `list[T]`). |
| Package manager | **`uv`** + `pyproject.toml` + `uv.lock` | Fast, reproducible installs; replaces pip + requirements.txt. |
| Web framework | **FastAPI ≥0.122** | Pydantic-native, async-first, OpenAPI for free, dependency injection. |
| ASGI server | **Uvicorn** (`[standard]` extras) | Production-grade ASGI; plays nicely with FastAPI lifespan. |
| Multipart upload | **python-multipart ≥0.0.20** | Required for FastAPI `UploadFile`. |
| Validation | **Pydantic v2** | Every data shape. `ConfigDict(frozen=True)`, `@computed_field`, `StrEnum`. |
| Settings | **pydantic-settings** | `.env`-driven `Settings(BaseSettings)`; cached via `@lru_cache`. |
| Data | **pandas ≥2.2** | DataFrame layer for detectors. |
| Numerics | **numpy ≥1.26** | Used by the time-series detector and by STUMPY. |
| Excel I/O | **openpyxl ≥3.1** | Loaded **twice** per workbook — `data_only=True` and `data_only=False`. |
| Time-series ML | **STUMPY ≥1.13** | Matrix-profile discord detection. |
| Fuzzy matching | **rapidfuzz ≥3.9** | C-backed fuzzy string matching (`fuzz.ratio`, `process.extract`). |
| AI | **anthropic SDK ≥0.40** | `messages.parse()` with Pydantic-typed structured outputs, `thinking={"type": "adaptive"}`, prompt caching. |

**Dev-only:** pytest ≥8, pytest-asyncio, httpx (for async test client via
`ASGITransport`), ruff, mypy.

### 4.2 Frontend

| Area | Tech | Why |
|---|---|---|
| Framework | **Next.js 16.2.4** (App Router, **Turbopack**, typed routes) | Modern React framework; every page here is a Client Component. |
| Runtime | **React 19.2.4** | Latest; enables `useSyncExternalStore`, the new `use()` API, etc. |
| Language | **TypeScript (strict)** | Compile-time safety on top of Zod runtime safety. |
| Styling | **Tailwind CSS v4** + design tokens via `@theme inline` | Named component classes (`.btn`, `.score-card`, `.detector`) carry most of the design; Tailwind utilities fill the gaps. |
| Design tokens | **OKLCH colour space** in CSS custom properties | Forest palette (greens, muted stone). |
| Typography | **Instrument Serif** + **Inter** + **JetBrains Mono** (via `next/font/google`) | Editorial headlines, body sans, code mono. |
| Server state | **TanStack Query v5.99** | Polling, deduplication, retry logic, mutation lifecycle. |
| Schema validation | **Zod v4.3** | Every `fetch().json()` is piped through `.parse()` before values leave `lib/api.ts`. |
| Notifications | **sonner v2** | Toast errors on failed uploads / submissions. |
| Charts | **Hand-written inline SVG** (no chart library) | The time-series chart is ~150 lines of SVG; dropped ~1 MB of Plotly. |

### 4.3 Why these choices over the obvious alternatives

- **FastAPI over Flask/Django** → native async + Pydantic + free OpenAPI.
- **uv over pip/poetry** → speed + lockfile determinism.
- **Next.js 16 over plain React/Vite** → App Router, file-system routing,
  `useParams`, typed routes.
- **TanStack Query over SWR** → superior retry/polling primitives and a
  richer mutation API.
- **Zod over raw TS types** → TS types disappear at runtime; Zod enforces
  the contract on data crossing the network boundary.
- **STUMPY over Prophet/LSTM** → catches **shape anomalies**, not just
  spikes; zero training needed; works on any length ≥50 points.
- **rapidfuzz over fuzzywuzzy** → same API, C-implementation, ~10× faster.
- **openpyxl over pandas-only** → pandas hides merged cells, formulas, and
  Excel error literals. Without openpyxl, the Structural detector is
  literally impossible.
- **Inline SVG over Plotly/Chart.js** → the chart is simple (line +
  markers); a full charting library was ~1 MB of JS for what is now 4 KB.

---

## 5. High-Level Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│  BROWSER (Next.js 16 App Router — all pages are Client Components)    │
│  /                     → Upload zone                                  │
│  /configure/[id]       → Sheet + detector picker + preview strip      │
│  /analysis/[id]        → Overview (score, KPIs, deductions)           │
│  /analysis/[id]/issues → Filterable table + CSV                       │
│  /analysis/[id]/time-series → Inline-SVG charts per anomaly           │
└───────────────────────────┬───────────────────────────────────────────┘
                            │  fetch() → Zod.parse() → typed values
                            │  TanStack Query manages cache & polling
                            ▼
┌───────────────────────────────────────────────────────────────────────┐
│  FASTAPI (src/sheetlint/main.py)                                      │
│  POST /api/v1/analysis/preview     multipart → AnalysisPreview (201)  │
│  GET  /api/v1/analysis/preview/:id → AnalysisPreview                  │
│  POST /api/v1/analysis             AnalysisConfig JSON → JobCreated   │
│                                                             (202)    │
│  GET  /api/v1/jobs/:id             → Job (poll until terminal)        │
│  GET  /health                       → liveness probe                  │
│                                                                       │
│  Lifespan-managed singletons: JobStore, PreviewStore                  │
│  Periodic cleanup tasks unlink expired temp files                     │
│  Exception handlers: Invalid* → 400, FileTooLarge → 413,              │
│                      *NotFound → 404                                   │
└──────────────┬────────────────────────────────────────────────────────┘
               │  run_in_threadpool(analyze, ...) for CPU-heavy work
               ▼
┌───────────────────────────────────────────────────────────────────────┐
│  DETECTOR LIBRARY (framework-free — importable from scripts/tests)    │
│                                                                       │
│  parser.py  → parse_excel(source) → ExcelDocument (dual openpyxl)     │
│  service.py → analyze(...) → orchestrates detector stack              │
│  scoring.py → compute_trust_score(findings) → TrustScore              │
│                                                                       │
│  detectors/__init__.py  → build_detectors(ids, api_key)               │
│  detectors/base.py      → `class Detector(Protocol)`                  │
│  detectors/structural.py    detectors/statistical.py                  │
│  detectors/duplicates.py    detectors/timeseries.py                   │
│  detectors/ai.py  (Claude — optional if api_key is None)              │
└───────────────────────────────────────────────────────────────────────┘
```

### 5.1 The five architectural rules (enforced in CLAUDE.md)

1. **Detectors are framework-free.** No FastAPI or web imports anywhere
   under `analysis/detectors/` or `analysis/{parser,scoring,service}.py`.
2. **Detector Protocol is the contract.** `name: str` + `run(doc) -> list[Finding]`.
   Drop a file, register it, it shows up in every response.
3. **Dual openpyxl load is non-negotiable.** Merged cells and formulas
   require both `data_only=True` and `data_only=False` views.
4. **One broken detector can't kill the report.** `service.analyze()` wraps
   each detector in `try/except` and logs.
5. **Pydantic schemas cross the API boundary.** `analysis/schemas.py` is the
   *single source of truth* — detectors construct them; routers return them
   via `response_model`; Zod on the frontend mirrors them 1:1.

---

## 6. End-to-End Request Flow

This is the **two-step** flow that lets the user preview the file and pick
what to run before paying the detector cost:

```
USER drops foo.xlsx on /
    │
    │ useCreatePreview.mutate(file)
    ▼
POST /api/v1/analysis/preview  (multipart)
    │
    │ • ValidatedUpload dependency: extension + size pre-flight
    │ • _persist_upload streams to temp file on disk (64 KB chunks)
    │ • run_in_threadpool(parse_excel, path) — dual openpyxl load
    │ • PreviewStore.create({preview_id, temp_path, sheet_metadata[]})
    │
    ◄── 201 CREATED  { AnalysisPreview(preview_id, sheets[…]) }

Router pushes to /configure/{preview_id}
    │
    │ usePreview(id) via TanStack Query (staleTime: Infinity)
    ▼
GET /api/v1/analysis/preview/{preview_id}  → AnalysisPreview

User toggles sheets + detectors; clicks "Run inspection"
    │
    │ useSubmitAnalysis.mutate({preview_id, sheets, detectors})
    ▼
POST /api/v1/analysis  (application/json)
    │
    │ • PreviewStore.get(preview_id) — 404 if expired
    │ • Validate every requested sheet exists in the preview
    │ • JobStore.create(filename=preview.filename)
    │ • BackgroundTasks.add_task(_run_analysis_job, …)
    │ • Location header = /api/v1/jobs/{job_id}
    │
    ◄── 202 ACCEPTED  { JobCreated(id, status='pending', status_url) }

Router pushes to /analysis/{job_id}
    │
    │ useJob(id) polls every 500 ms; refetchInterval returns false once
    │ job.status ∈ {succeeded, failed}. Retry disabled on 404.
    │
    │ Meanwhile, on the server:
    │
    ▼
_run_analysis_job (background task on an asyncio task)
    │
    │ 1. store.mark_running(job_id)
    │ 2. run_in_threadpool(analyze, temp_path, …)      ← CPU-heavy
    │ 3. store.set_result(job_id, AnalysisResult)
    │    (or store.set_error on failure)
    │ 4. finally:
    │     preview_store.discard(preview_id)
    │     _safe_unlink(temp_path)

GET /api/v1/jobs/{id} now returns status='succeeded' + result
    │
    ▼
Frontend renders <ReportHeader> + <ReportTabs>
    • Overview       → trust score, KPIs, per-detector deductions
    • Issues         → filterable table, sortable, CSV export
    • Time-series    → inline-SVG per anomaly
```

### 6.1 Why two steps instead of one upload endpoint

- Lets the user **see what worksheets exist** before running detectors.
- Lets them **exclude hidden sheets**, "Reference" tabs, or the archive
  sheet that's got nothing to do with the data.
- Lets them **disable the AI detector** (which costs money per column).
- The trade-off is documented: the file is parsed twice — once on
  `/preview`, once in the background task. Acceptable for MVP; optimizable.

### 6.2 Why `run_in_threadpool` is critical

FastAPI's event loop is single-threaded. STUMPY and openpyxl are
CPU-bound and will **starve every other request** if run directly on the
loop. `fastapi.concurrency.run_in_threadpool` hops the work onto a worker
thread so the loop stays free to service `/jobs/{id}` polls.

---

## 7. Backend Deep Dive

### 7.1 Project layout

```
src/sheetlint/
├── __init__.py                ← __version__
├── main.py                    ← FastAPI app + lifespan + CORS + handlers
├── config.py                  ← pydantic-settings Settings + SettingsDep
├── analysis/                  ← BOUNDED CONTEXT: analysis
│   ├── router.py              ← /analysis/preview, /analysis endpoints
│   ├── schemas.py             ← Pydantic: Finding, AnalysisResult, etc.
│   ├── service.py             ← analyze() orchestration
│   ├── parser.py              ← dual openpyxl + header detection
│   ├── scoring.py             ← compute_trust_score(findings) → TrustScore
│   ├── preview.py             ← PreviewStore + flag derivation
│   ├── dependencies.py        ← ValidatedUpload, PreviewStoreDep
│   ├── exceptions.py          ← domain errors → HTTP status codes
│   └── detectors/
│       ├── __init__.py        ← registry: build_detectors(ids, api_key)
│       ├── base.py            ← @runtime_checkable Detector(Protocol)
│       ├── structural.py
│       ├── statistical.py
│       ├── duplicates.py
│       ├── timeseries.py      ← STUMPY + rolling z-score
│       └── ai.py              ← Claude (optional; no-ops without key)
└── jobs/                      ← BOUNDED CONTEXT: jobs
    ├── router.py              ← GET /jobs/{id}
    ├── schemas.py             ← Job, JobStatus, JobCreated
    ├── service.py             ← JobStore (in-memory, asyncio-lock)
    ├── dependencies.py        ← JobStoreDep, JobDep
    └── exceptions.py
```

**Convention:** every bounded context has its own
`router / schemas / service / dependencies / exceptions` files. Cross-domain
imports are explicit and one-way (analysis → jobs, never the reverse).

### 7.2 `main.py` — the composition root

- `lifespan` async context manager:
  - Constructs `JobStore(ttl_hours=...)` and `PreviewStore(ttl_minutes=...)`,
    mounts them on `app.state`.
  - Starts two periodic cleanup tasks (`_periodic` wrapper that swallows
    non-cancel errors so one bad tick doesn't kill the loop).
  - On shutdown, cancels the tasks and awaits their cancellation.
- `CORSMiddleware` with `cors_origins` from settings (default:
  `http://localhost:3000`).
- Routers mounted under `/api/v1`.
- **Exception handlers** translate domain exceptions → HTTP:
  - `InvalidExcelFileError` → 400
  - `FileTooLargeError` → 413 (with size_bytes + limit_bytes in body)
  - `InvalidAnalysisConfigError` → 400
  - `PreviewNotFoundError` → 404
  - `JobNotFoundError` → 404
- `/docs` is **disabled in production** via `docs_enabled` property on
  Settings (Local + Staging only).

### 7.3 `config.py` — settings layer

`Settings(BaseSettings)` with `.env` auto-loading, `extra="ignore"`,
`case_sensitive=False`. Notable fields:

| Setting | Default | Purpose |
|---|---|---|
| `environment` | `LOCAL` | StrEnum: LOCAL / STAGING / PRODUCTION / TEST |
| `cors_origins` | `["http://localhost:3000"]` | FastAPI CORS allowlist |
| `max_upload_size_mb` | `50` | Hard cap on upload size |
| `accepted_extensions` | `[".xlsx"]` | Extension allowlist |
| `job_result_ttl_hours` | `24` | Jobs GC'd after this |
| `preview_ttl_minutes` | `30` | Previews GC'd after this |
| `anthropic_api_key` | `None` | Without it, AI detector no-ops |
| `enable_ai` | `True` | Master switch for AI layer |

`get_settings()` is `@lru_cache`'d → behaves like a singleton across the
app but is trivially overridable in tests via dependency override.

### 7.4 `parser.py` — the dual-openpyxl-load parser

This is the unsung hero. The parse_excel function does:

1. `wb_values = openpyxl.load_workbook(path, data_only=True)`
2. `wb_formulas = openpyxl.load_workbook(path, data_only=False)`
3. For each worksheet, calls `_read_sheet(ws, wb_formulas)`.

`_read_sheet` collects:
- `raw_values`: full 2D list including pre-header rows
- `header_row`: 1-indexed detected header row (via `_detect_header_row`
  heuristic — highest string-fraction row in the first 10, with numeric
  penalty)
- `df`: pandas DataFrame using the detected headers; `dropna(how='all')`
- `merged_ranges`: strings like `"C20:C22"` from `ws.merged_cells.ranges`
- `formula_cells`: `[FormulaCell(row, col, formula, cached_value), …]`
  built by comparing the two workbook views
- `error_cells`: `[(row, col, literal), …]` for any cell whose value is
  one of `{#REF!, #N/A, #DIV/0!, #VALUE!, #NAME?, #NUM!, #NULL!}`
- `is_hidden`: `ws.sheet_state != "visible"`

The final `ExcelDocument` carries `sheets: list[SheetView]`,
`hidden_sheet_names`, and the raw `Workbook` for any detector that needs
to walk the tree.

### 7.5 `service.py` — the orchestrator

`analyze(source, filename, enable_ai, api_key, detectors, detector_ids,
sheet_filter)` returns `(ExcelDocument, AnalysisResult)`.

Key behaviors:
- **Precedence of detector selection:** explicit `detectors` list >
  `detector_ids` (resolved via the registry) > `default_detectors(enable_ai)`.
- **Sheet filter:** if `sheet_filter` is non-None, the parsed document's
  `sheets` is filtered to the subset **before** detectors run — they never
  see out-of-scope sheets.
- **Per-detector try/except** — one exception logs, the report continues.
- **TimeSeries dual-run:** `TimeSeriesDetector` is a special case; after
  `run()` returns `Finding`s, `analyze()` also calls `detector.analyze(doc)`
  to collect the `AnomalyResult` objects for the chart layer.

### 7.6 `preview.py` — the `PreviewStore` and flag derivation

`PreviewStore` is an **async-safe in-memory registry** with `asyncio.Lock`
and TTL-based expiry. It holds `_PreviewEntry(preview, temp_path)`.

Interface (the exact shape we'll port to Redis later):
- `create(doc, temp_path)` → creates an `AnalysisPreview` and stores it.
- `get(preview_id)` → returns the preview or `None` if expired/missing.
- `path(preview_id)` → resolves to the temp file path.
- `discard(preview_id)` → removes and returns its path.
- `cleanup_expired()` → reaper method called by the lifespan periodic task.

The **cheap flag derivation** runs during preview (no detector cost):

| Flag | Trigger |
|---|---|
| `hidden` | `sheet.is_hidden` |
| `pre-header rows` | `sheet.header_row > 1` |
| `merged cells` | Any merged range whose `min_row > header_row` (inside data region) |
| `formula errors` | `sheet.error_cells` non-empty |
| `empty` | `sheet.n_rows == 0` |
| `wide` | `sheet.n_cols > 20` |
| `looks clean` | No other flag matched |

These let the Configure page show per-sheet hints *before* the user decides
what to run.

### 7.7 `jobs/` — the async job registry

`JobStore` mirrors `PreviewStore`'s shape:
- `create(filename)` — returns a `Job(id=uuid4, status=PENDING, …)`.
- `get(job_id)` — lookup; `None` if expired or never existed.
- `mark_running` / `set_result` / `set_error` — state transitions.
- `cleanup_expired` — drops jobs whose `updated_at` is older than TTL.

`Job` carries the full `AnalysisResult` once `status == SUCCEEDED` — the
frontend reads `job.result` to render the report.

### 7.8 Dependencies + Annotated pattern

FastAPI endpoints never touch the store directly — they receive it via
`Annotated[..., Depends(...)]` aliases:

```python
# In jobs/dependencies.py
def get_job_store(request: Request) -> JobStore:
    return request.app.state.job_store

JobStoreDep = Annotated[JobStore, Depends(get_job_store)]

async def valid_job_id(job_id: UUID, store: JobStoreDep) -> Job:
    job = await store.get(job_id)
    if job is None:
        raise JobNotFoundError(job_id)
    return job

JobDep = Annotated[Job, Depends(valid_job_id)]
```

The endpoint is then literally just:

```python
@router.get("/{job_id}", response_model=Job)
async def get_job(job: JobDep) -> Job:
    return job
```

Path-parameter validation, 404 translation, and store plumbing are all
hidden behind one type.

### 7.9 Background task execution path

`router.py::create_analysis` does:

```python
background.add_task(
    _run_analysis_job,
    store=store,
    preview_store=preview_store,
    job_id=job.id,
    preview_id=config.preview_id,
    file_path=file_path,
    filename=preview.filename,
    sheet_filter=list(config.sheets),
    detector_ids=list(config.detectors),
    settings=settings,
)
```

FastAPI's `BackgroundTasks` are executed **after** the response is sent,
on the same event loop. `_run_analysis_job` then uses
`run_in_threadpool(analyze, …)` to move the CPU-heavy work to a worker
thread. The `finally` block guarantees that:
1. The preview is discarded (cannot be reused).
2. The temp file is unlinked.

So each preview has an **exactly-once** lifecycle: create → consume → delete.

---

## 8. The Five Detectors

Every detector class has **two members:**
- `name: str` — the display label shown in the UI and CSV export.
- `run(doc: ExcelDocument) -> list[Finding]` — the work function.

`Finding(detector, severity, sheet, message, column, rows, suggested_fix,
metadata)` is frozen (`ConfigDict(frozen=True)`) with a `row_count`
computed field.

### 8.1 Structural Detector (`detectors/structural.py`)

**What it catches:** Excel-specific integrity issues pandas can't even see.

| Check | Severity | Example trigger |
|---|---|---|
| Hidden sheets | WARNING | `sheet_state != "visible"` → privacy risk |
| Pre-header rows (header at row > 1) | WARNING | Title/notes rows above the table |
| Merged cells in data region | CRITICAL | `min_row > header_row` in `merged_cells.ranges` |
| Formula errors (`#DIV/0!`, `#REF!`, …) | CRITICAL | Grouped by error literal so 50 `#DIV/0!`s become 1 finding |
| Fully empty columns | INFO | Cosmetic, but worth trimming |

**How it works:** iterates over `ExcelDocument.sheets` and uses the parsed
`SheetView.merged_ranges`, `error_cells`, and `is_hidden`. Uses
`openpyxl.utils.range_boundaries()` to parse `"A1:C3"` into numeric
bounds so "is this merge inside the data region?" is decidable.

### 8.2 Statistical Detector (`detectors/statistical.py`)

**What it catches:** the "mostly one type, except for a few rows" pattern.

Three sub-checks per column:

**1. Type purity.** Classifies each non-null cell into
`{null, int, float, bool, datetime, string}`. If a single type dominates
≥85% of non-null values and other types appear → flag the off-type rows.
Severity is `CRITICAL` when the dominant type is numeric (real bug),
`WARNING` otherwise.

**2. Regex pattern coverage.** For string columns with ≥10 values, tries
each regex in the `PATTERN_DETECTORS` list:
- email, US phone, US zip, SSN, ISO date, US date, currency.

If a pattern matches 80–98% of values, the off-format rows are flagged as
WARNING. The 98% ceiling filters "looks fine" columns; the 80% floor
filters free-text columns.

**3. Null density.** If 20% < null fraction < 95%, emits INFO:
*"Column X is N% empty — decide if intentional."*

### 8.3 Duplicates Detector (`detectors/duplicates.py`)

Two sub-checks:

**1. Exact duplicates.** `df.duplicated(keep=False)` → one finding for the
entire duplicate set.

**2. Fuzzy near-duplicates.** For each column with 5–500 unique values
(filters out both lookup columns and free-text), runs a
`_fuzzy_cluster` pass using `rapidfuzz.process.extract` with
`scorer=fuzz.ratio` and `score_cutoff=88`. Each cluster's canonical form
is the variant with the highest count; all other variants in the cluster
are flagged as WARNING with the suggested_fix `"Normalize all variants to
'<canonical>'"`.

Catches `"California"` vs `"Californa"`, `"N.Y."` vs `"NY"`, etc.

### 8.4 Time-series Detector (`detectors/timeseries.py`)

**Two methods ensembled:**

**1. Rolling z-score on residuals (`_rolling_zscore`).**
- `median = s.rolling(7, center=True, min_periods=1).median()`
- `mad = (s - median).abs().rolling(7, center=True, min_periods=1).median()`
- `z = 0.6745 * (s - median) / mad`
- Flagged indices: `|z| > 3.0`.
- Division-by-zero guarded by replacing 0 MAD with the global positive
  MAD median.

**2. STUMPY matrix profile discords (`_stumpy_discords`).**
- Needs ≥50 points; falls back to z-score only below that.
- `window = max(7, len(values) // 20)`.
- Calls `stumpy.stump(values.astype(float), m=window)` → column 0 is the
  bidirectional matrix profile.
- Top-K discords: `np.argpartition(-profile, k-1)[:k]` with `k=3`.
- Shifts each index to the centre of its subsequence for nicer
  highlighting on the chart.

**Detection surface:**
- `run(doc)` returns `Finding`s for any series with flagged indices.
- `analyze(doc)` returns `AnomalyResult`s with the full series, the dates,
  the values, `z_flagged`, and `mp_flagged` — the chart layer reads these.

**Why STUMPY + z-score together:** z-score catches single-point spikes;
STUMPY catches *shape* anomalies (e.g. an inverted-V pattern in an
otherwise flat series). Presenting the union means the user sees
"two techniques both flagged this — high confidence."

### 8.5 AI Detector (`detectors/ai.py`)

**What it catches:** semantic mismatches regex can't see.

For each column (capped at 25 per sheet), sends Claude:
- The column header.
- A deterministic first-N sample (N=20).

Asks three questions in a system prompt:
1. Does the header match the content?
2. Which specific sample values don't fit?
3. What entity type does the column actually hold?

**Implementation details that matter for the presentation:**

```python
response = client.messages.parse(
    model="claude-opus-4-7",
    max_tokens=2048,
    thinking={"type": "adaptive"},          # ← Extended thinking, model-paced
    system=[{
        "type": "text",
        "text": SYSTEM_PROMPT,
        "cache_control": {"type": "ephemeral"},  # ← Prompt caching
    }],
    messages=[{"role": "user", "content": user_message}],
    output_format=ColumnAssessment,         # ← Pydantic schema = structured output
)
assessment: ColumnAssessment = response.parsed_output
```

Four important techniques at once:

| Technique | Why |
|---|---|
| `messages.parse()` + `output_format=ColumnAssessment` | Claude's response is validated against the Pydantic schema. You get typed objects, not JSON strings you have to clean up. |
| `thinking={"type": "adaptive"}` | Lets the model think as long as it needs; cheap on simple columns, deeper on ambiguous ones. |
| `cache_control: {"type": "ephemeral"}` on the system prompt | The ~500-token system prompt is **cached across columns** — subsequent calls pay cache-read rates, not full input rates. |
| Deterministic sample (first N rows, not random) | Preserves the cache prefix across re-runs. Random sampling would defeat caching. |

**Failure modes:**
- Missing API key → detector silently no-ops (returns `[]`).
- `anthropic` package not installed → same.
- Any exception per column → logged, next column continues.

**`ColumnAssessment`** (Pydantic model = structured output schema):
```python
class ColumnAssessment(BaseModel):
    name_matches_content: bool
    inferred_entity_type: str
    has_issues: bool
    issue_summary: str
    suspect_value_indices: list[int]  # 0-indexed positions in the sample
```

The detector emits two kinds of findings:
- `CRITICAL` when `name_matches_content == False`.
- `WARNING` when `has_issues and suspect_value_indices` — the sample
  indices are mapped back to real DataFrame rows.

### 8.6 The Detector Registry (`detectors/__init__.py`)

```python
_FACTORIES: dict[DetectorId, Callable[..., Detector]] = {
    DetectorId.STRUCTURAL:  lambda **_:      StructuralDetector(),
    DetectorId.STATISTICAL: lambda **_:      StatisticalDetector(),
    DetectorId.DUPLICATES:  lambda **_:      DuplicatesDetector(),
    DetectorId.TIMESERIES:  lambda **_:      TimeSeriesDetector(),
    DetectorId.AI:          lambda **kwargs: AIDetector(api_key=kwargs.get("api_key")),
}

def build_detectors(ids, *, api_key=None) -> list[Detector]:
    return [_FACTORIES[d](api_key=api_key) for d in ids]
```

**Adding a new detector is four steps:**
1. Write the class in `detectors/<name>.py` with `name` + `run`.
2. Add a `DetectorId` entry to `analysis/schemas.py`.
3. Register its factory in `_FACTORIES`.
4. Add a trigger to `samples/generate_sample.py` so the demo shows it off.

Zero UI changes. Zero router changes. Zero schema changes. That is the
Protocol pattern paying off.

---

## 9. The Trust Score

`compute_trust_score(findings: list[Finding]) -> TrustScore`:

- Start at 100.
- For each finding:
  - `row_multiplier = 1.0 + min(row_count / 200, 1.0)` → capped at 2×.
  - `deduction = severity.weight × row_multiplier`.
  - `severity.weight`: **CRITICAL=20, WARNING=5, INFO=1**.
- Score = `max(0, 100 - sum(deductions))`.

**Grade thresholds** (`_GRADE_THRESHOLDS`):

| Grade | Score |
|---|---|
| A+ | ≥95 |
| A | ≥85 |
| B | ≥75 |
| C | ≥60 |
| D | ≥40 |
| F | < 40 |

The `TrustScore` also carries:
- `breakdown: dict[str, float]` — deduction sum per detector (the
  "points deducted by detector" bar list in the Overview page).
- `by_severity: dict[str, int]` — count map (the three KPI cards).

This is **the single number the domain worker reads**. The breakdown is
what the engineer reads.

---

## 10. Frontend Deep Dive

### 10.1 Project layout

```
frontend/
├── package.json                    ← Next 16.2.4, React 19.2.4, Zod 4
├── next.config.ts
├── tsconfig.json                   ← strict, @/* → project root
├── app/
│   ├── layout.tsx                  ← fonts + TopBar + <Providers>
│   ├── providers.tsx               ← QueryClientProvider + <Toaster />
│   ├── globals.css                 ← OKLCH tokens + @theme inline
│   ├── page.tsx                    ← / (upload)
│   ├── configure/[previewId]/page.tsx
│   └── analysis/[jobId]/
│       ├── layout.tsx              ← polls job, header + tabs
│       ├── page.tsx                ← Overview
│       ├── issues/page.tsx
│       └── time-series/page.tsx
├── components/                     ← 25+ presentational components
├── hooks/
│   ├── use-create-preview.ts
│   ├── use-preview.ts
│   ├── use-submit-analysis.ts
│   ├── use-job.ts
│   └── use-scan-log.ts             ← scripted log simulator
└── lib/
    ├── env.ts                      ← Zod-validated NEXT_PUBLIC_*
    ├── schemas.ts                  ← Zod mirrors of backend Pydantic
    ├── api.ts                      ← fetch + .parse() at every boundary
    └── csv.ts                      ← browser-side CSV download
```

### 10.2 The network boundary: Zod + `lib/api.ts`

Every HTTP call lives in `lib/api.ts`. Every response is piped through
`.parse()` on the relevant Zod schema before returning. If the backend
ever breaks the contract, the error surfaces here — not ten components
deep.

```ts
export async function getJob(jobId: string): Promise<Job> {
  const response = await fetch(`${API_BASE}/api/v1/jobs/${jobId}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new ApiError(response.status, await readErrorDetail(response));
  return jobSchema.parse(await response.json());
}
```

**Custom `ApiError`** carries the HTTP status so hooks can branch on 404
(halt retries) vs anything else (retry twice).

### 10.3 `lib/schemas.ts` — the Zod mirror

Every Pydantic model in `src/sheetlint/{analysis,jobs}/schemas.py` has a
1:1 Zod equivalent:

```ts
export const severitySchema = z.enum(["critical", "warning", "info"]);
export const detectorIdSchema = z.enum([
  "structural", "statistical", "duplicates", "timeseries", "ai",
]);
export const findingSchema = z.object({
  detector: z.string(),
  severity: severitySchema,
  sheet: z.string(),
  message: z.string(),
  column: z.string().nullable(),
  rows: z.array(z.number()),
  suggested_fix: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  row_count: z.number(),
});
// … analysisResultSchema, jobSchema, analysisPreviewSchema, etc.

export type Finding = z.infer<typeof findingSchema>;
```

TypeScript types are **derived from the Zod schemas** via `z.infer` — no
duplicate definitions to drift out of sync.

### 10.4 Hooks & caching behaviour

| Hook | Type | Behaviour |
|---|---|---|
| `useCreatePreview` | `useMutation` | On success: `router.push("/configure/{id}")`. On error: `sonner.toast.error`. |
| `usePreview(id)` | `useQuery` | `staleTime: Infinity` (previews never mutate), `refetchOnWindowFocus: false`, retry halts on 404. |
| `useSubmitAnalysis` | `useMutation` | On 202: `router.push("/analysis/{job_id}")`. |
| `useJob(id)` | `useQuery` | `refetchInterval` **dynamically returns `false`** once status ∈ {succeeded, failed}, else 500 ms. Retry halts on 404, otherwise retries twice. |
| `useScanLog(done)` | Custom React hook | Scripted simulator — see §10.7. |

TanStack Query's key-based cache means every page that calls `useJob(id)`
**shares the same poll loop**. The layout and three children read from a
single source without duplicating fetches.

### 10.5 Pages

#### `/` — Upload (`app/page.tsx` + `UploadZone`)

- Hero: Instrument Serif headline ("Catch Excel issues *before*…").
- `<UploadZone>` — drag-drop **and** click-to-browse, accepts `.xlsx` up
  to 50 MB (validated client-side too).
- `<FeaturesStrip>` — five numbered feature cards (structural, statistical,
  duplicates, time-series, semantic).
- TopBar crumb: **`Sheetlint › Upload`**.

#### `/configure/[previewId]`

- Reads the preview via `usePreview()`.
- **SheetPicker** — grid of cards (one per sheet):
  - Row/col counts.
  - Visual flag chips (`"merged cells"`, `"pre-header rows"`,
    `"formula errors"`, `"hidden"`, `"looks clean"` with check icon, etc.).
  - Select/deselect on click.
- Controls: `Show hidden worksheets` checkbox, `Select all visible`,
  `Clear`.
- **PreviewStrip** — when exactly one sheet is selected, shows the first 5
  rows as a read-only table.
- **DetectorPicker** — five cards (one per detector) with:
  - Icon + title (+ "AI" badge on Claude semantic).
  - Description aligned with the real implementation.
  - Mini-chips showing the sub-checks (`type_purity`, `regex_coverage`,
    `matrix_profile`, `header_content_match`, …).
- **AI callout** — only visible when the AI detector is selected, warns
  that it calls the Claude API.
- **ConfigureFooter** — counts + Cancel + Run inspection (submits
  `AnalysisConfig` and pushes to `/analysis/{job_id}`).

#### `/analysis/[jobId]` (layout)

- Polls via `useJob(id)`.
- While pending/running → `<ScanningView>` (see §10.7).
- On failure → empty-state with `job.error`.
- On success → renders:
  - `<ReportHeader>` (eyebrow, title, filename + grade + meta,
    "Download CSV" + "New inspection" buttons).
  - `<ReportTabs>` (Link-based tabs: Overview / Issues / Time-series).
  - `{children}` — the current tab's page.

Report tabs use `Link` (client-side nav) and the pages share the same
job cache. `scanSeconds = updated_at - created_at`.

#### `/analysis/[jobId]` (Overview)

- **Overview grid:** `<TrustScoreCard>` + right column with
  `<SeverityKpis>` and `<Deductions>`.
- **`<TrustScoreCard>`** — giant number in Instrument Serif, italic
  "Grade X" in accent colour, progress-bar track with colour variant
  by grade (A/B → accent, C → warn, D/F → critical), thresholds footer.
- **`<SeverityKpis>`** — three cards (Critical / Warning / Info counts).
- **`<Deductions>`** — list of per-detector points deducted, with
  horizontal bars sized proportionally.
- **Critical section** — every critical finding rendered as a
  `<Callout>`.
- **Notable section** — first 3 warnings (`MAX_WARNING_PREVIEW`).

#### `/analysis/[jobId]/issues`

- Filter bar: search input, `Severity` select, `Detector` select, a counter
  ("N of M"), and a CSV download button (exports **filtered** findings).
- Sortable table with columns: severity / detector / sheet / column /
  rows / message. Clicking headers toggles `SortState { key, dir }`.
- Row click expands an `<IssueDetail>` card showing:
  - Left: KV grid (detector, sheet, column, row count, rows up to 12 then "+N more").
  - Right: `suggested_fix` + a detector-specific
    "Detection technique" blurb (keyed off the detector name prefix).
- Empty state for zero matches.

#### `/analysis/[jobId]/time-series`

- `<TsCard>` per `AnomalyResult`.
- Inside: `timeSeriesMetadataSchema.safeParse(metadata)` narrows the
  generic dict into `TimeSeriesMetadata`.
- **`<TimeSeriesChart>`** is **~150 lines of hand-written inline SVG:**
  - Y gridlines + dashed ticks.
  - X date ticks at 7 positions.
  - Filled area under the polyline at 7% opacity in accent colour.
  - Main polyline in accent colour.
  - Orange **warn rings** at each `z_flagged` index.
  - Red **critical X-markers** at each `mp_flagged` index.
  - Stretches to container via `preserveAspectRatio="none"`.
- Empty state if the workbook has no detectable time-series columns.

### 10.6 Shared components

| Component | Purpose |
|---|---|
| `TopBar` | Brand + breadcrumbs (derived from `usePathname()`) + `"LOCAL · NO UPLOAD"` badge. |
| `Brand` | Logo + wordmark. |
| `Crumbs` | Renders the breadcrumb array with separators. |
| `Callout` | Single finding card used in Overview. |
| `SeverityBadge` | Colored pill for `critical` / `warning` / `info`. |
| `ReportHeader` / `ReportTabs` | Report chrome. |
| `SheetPicker` / `DetectorPicker` / `PreviewStrip` / `ConfigureFooter` | Configure-page building blocks. |
| `ScanningView` | Polling UI (spinner + progress bar + scripted log). |
| `icons.tsx` | Pure-SVG icons (no `lucide-react` — tree-shaking-safe). |
| `ui/sonner.tsx` | `<Toaster>` wrapper. |

### 10.7 The scripted scan log

`useScanLog(done)` is an intentional fake. The backend runs detectors as a
batch (no SSE, no streaming), but waiting in silence feels broken. So the
hook cycles through a 12-line script at 900 ms per step, capping tick
progress at 95% until the real job is done (then snaps to 100%).

```ts
const LOG_SCRIPT = [
  ["parse", "parse workbook — scanning sheets"],
  ["struct", "sweeping merged cells and hidden sheets"],
  ["stats", "profiling columns — type purity, regex coverage"],
  ["dup", "hashing rows for exact duplicates"],
  ["ts", "matrix-profile over (date, numeric) pairs"],
  ["ai", "claude review — per-column header/content match"],
  ["score", "scoring and bucketing findings"],
  ["done", "finalizing report"],
  // … 12 lines total
];
```

`progress = done ? 100 : tickProgress` — derived, not set from an effect.
(Keeps React lint happy and avoids double-render artefacts.)

Upgrade path: when the backend grows an SSE endpoint, swap this for an
`EventSource` hook.

---

## 11. API Contract

| Method | URL | Status | Request | Response |
|---|---|---|---|---|
| GET | `/health` | 200 | — | `{status, version, environment}` |
| POST | `/api/v1/analysis/preview` | 201 | `multipart/form-data` file | `AnalysisPreview` |
| GET | `/api/v1/analysis/preview/{preview_id}` | 200 / 404 | — | `AnalysisPreview` |
| POST | `/api/v1/analysis` | 202 / 400 / 404 | `AnalysisConfig` JSON | `JobCreated` (+ `Location` header) |
| GET | `/api/v1/jobs/{job_id}` | 200 / 404 | — | `Job` |

**Error shapes:**
- 400 `InvalidExcelFileError` / `InvalidAnalysisConfigError` → `{detail}`.
- 413 `FileTooLargeError` → `{detail, size_bytes, limit_bytes}`.
- 404 `*NotFoundError` → `{detail, preview_id|job_id}`.

**Payloads in full (Pydantic v2):**

```python
class AnalysisPreview(BaseModel):
    preview_id: UUID
    filename: str
    created_at: datetime
    expires_at: datetime
    sheets: list[SheetMetadata]

class SheetMetadata(BaseModel):
    name: str
    row_count: int
    col_count: int
    hidden: bool
    header_row: int          # 1-indexed
    flags: list[str]          # display-ready labels
    preview: SheetPreview     # first 5 data rows, stringified

class AnalysisConfig(BaseModel):
    preview_id: UUID
    sheets:    list[str]       = Field(min_length=1)
    detectors: list[DetectorId] = Field(min_length=1)   # StrEnum

class AnalysisResult(BaseModel):
    filename: str
    trust_score: TrustScore
    findings: list[Finding]
    anomalies: list[AnomalyResult]
    inferred_schemas: dict[str, str]

class Finding(BaseModel):
    # frozen=True
    detector: str
    severity: Severity
    sheet: str
    message: str
    column: str | None = None
    rows: list[int] = []
    suggested_fix: str | None = None
    metadata: dict[str, Any] = {}
    @computed_field
    def row_count(self) -> int: return len(self.rows)

class Job(BaseModel):
    id: UUID
    status: JobStatus     # pending / running / succeeded / failed
    filename: str
    created_at: datetime
    updated_at: datetime
    result: AnalysisResult | None = None
    error: str | None = None
```

---

## 12. Feature Catalogue

### User-facing features

1. **Drag-and-drop or click-to-browse upload** with client-side
   extension + size validation + toast errors.
2. **Two-step flow** — preview worksheets before paying the detector cost.
3. **Sheet picker** with flag chips (`merged cells`, `formula errors`,
   `pre-header rows`, `hidden`, `looks clean`, `wide`, `empty`).
4. **Detector picker** — toggle any subset of the five detectors.
5. **Per-sheet preview strip** — first 5 data rows, stringified.
6. **AI-cost warning callout** when `ai` detector is selected.
7. **Scanning view** — spinner + progress bar + streaming-style log
   while the job runs.
8. **Overview page** — trust score card, per-severity KPIs, per-detector
   deductions bar list, critical callouts, notable-warnings preview.
9. **Issues page** — sortable table, text search, severity filter,
   detector filter, filtered CSV export, expandable row detail with
   detection-technique explainer.
10. **Time-series page** — one hand-written SVG chart per detected series,
    with orange warn rings (z-score) and red X markers (STUMPY discords).
11. **CSV export** — Blob-based download, filename derives from the source
    filename.
12. **404 handling** — distinct empty states for expired previews and
    unknown jobs, each with an "Upload again" CTA.
13. **Failed-job UI** — empty state with the backend error string.

### Developer-facing features

14. **Pluggable detector Protocol** — drop a file, register it, it shows up.
15. **Framework-free detector library** — importable from scripts,
    notebooks, tests, future worker queues.
16. **OpenAPI schema** at `/docs` (LOCAL + STAGING only).
17. **Lifespan-managed stores** + periodic TTL cleanup.
18. **Pydantic v2 everywhere** — one schema file per domain; Zod mirrors on
    the frontend; `z.infer` gives you TypeScript types for free.
19. **Async from day one** — `BackgroundTasks` + `run_in_threadpool` + poll.
20. **Domain exceptions → HTTP codes** via `@app.exception_handler`.
21. **Pydantic-settings** with `.env` loading + `@lru_cache` singleton.
22. **Test suite** — `httpx.AsyncClient` + `ASGITransport` + manual
    lifespan context → 11 tests, <0.5 s.
23. **`samples/generate_sample.py`** seeds one of every issue type so the
    demo always shows the full detector surface.
24. **Build-time env validation** on the frontend — missing
    `NEXT_PUBLIC_*` fails the build, not first request.

---

## 13. Design System

### Palette (OKLCH, "forest")

| Token | Role |
|---|---|
| `--paper`, `--paper-2` | Background layers |
| `--ink`, `--ink-2`, `--ink-3`, `--ink-4` | Text, 4 emphasis levels |
| `--rule`, `--rule-2` | Borders |
| `--accent`, `--accent-soft`, `--accent-ink` | Brand green + tints |
| `--critical`, `--critical-soft` | Red for critical severity |
| `--warn`, `--warn-ink`, `--warn-soft` | Amber for warnings |
| `--info`, `--info-soft` | Blue for info |
| `--ok` | Clean-state green |

### Typography

- **`Instrument Serif`** — editorial headlines and the trust-score number
  (`"Catch Excel issues *before*…"`).
- **`Inter`** — body text, UI chrome.
- **`JetBrains Mono`** — any `<span className="mono">`: filenames, IDs,
  timestamps in the scan log, chart tick labels.

All three are loaded via `next/font/google` and exposed as CSS variables
(`--font-inter`, `--font-instrument-serif`, `--font-jetbrains-mono`).

### Component classes

Named classes over utility soup for anything that repeats: `.btn`,
`.btn--primary`, `.btn--ghost`, `.btn--sm`, `.score-card`,
`.score-bar-track`, `.score-bar-fill`, `.callout`, `.issues-table`,
`.ts-card`, `.ts-chart`, `.sheet-card`, `.detector`, `.toggle`,
`.ai-callout`, `.preview-strip`, `.filters`, `.filter-count`, etc. Tokens
are also exposed to Tailwind via `@theme inline` so utilities like
`bg-accent-soft` work alongside the named classes.

---

## 14. Testing, Linting, Tooling

### Backend

- **`uv run pytest`** — `tests/test_analysis_flow.py` covers the whole
  two-step flow: preview round-trip, refetch, unknown preview 404,
  end-to-end analysis, detector filter honored, consumed-on-submit,
  unknown-sheet 400, unknown-job 404, invalid extension 400,
  unparseable xlsx 400, `/health`.
- Test client uses `httpx.AsyncClient` with `ASGITransport` — but
  `ASGITransport` does **not** propagate lifespan events, so the
  `conftest.py` manually enters `app.router.lifespan_context()` to warm
  the stores.
- **`uv run ruff check src tests`** — `E F W I UP B SIM ASYNC` with
  `E501` ignored.
- **`uv run mypy`** — non-strict, `ignore_missing_imports`.
- `pyproject.toml` targets `py311`.

### Frontend

- **`npm run lint`** — `eslint-config-next`.
- **`npm run build`** — Next 16's `next build` (Turbopack) serves as a
  full type-check of every route.

No frontend tests yet — explicit scope decision for the demo.

---

## 15. Known Limitations & Roadmap

### Current Tier 1 limitations (from CLAUDE.md + project-context.md)

- **In-memory `JobStore` + `PreviewStore`** — die with the worker,
  single-process only. Interfaces shaped to swap to Redis together.
- **`BackgroundTasks`** — if the worker crashes mid-analysis, the job is
  lost. Upgrade to Celery / Taskiq alongside Redis.
- **AI detector is sequential** — 30 columns = 30 round-trips. Could be
  `asyncio.gather`'d.
- **No persistence of past runs** — every analysis is fresh; no history,
  no share links, no auth.
- **Only `.xlsx`** — `.xls`, `.csv`, `.xlsm` would extend `parser.py`.
- **Preview causes 2× parse cost** — once in `/preview`, once in the
  background task. Optimize only if parse time becomes a visible
  bottleneck.
- **Scanning log is a scripted simulator** — not a real stream.

### Roadmap (short list)

1. **Real streaming scan log** — SSE endpoint streaming
   `detector_started` / `finding_added` / `detector_finished` events.
2. **Redis-backed stores** — swap `JobStore` + `PreviewStore` together.
3. **Async AI detector** — `asyncio.gather` the per-column Claude calls.
4. **Persistence + auth** — Postgres + Clerk for run history + share links.
5. **Domain rule packs** — e.g. `InsuranceDetector` with state-code
   validation, premium > 0, policy ID prefix.
6. **Multi-file diff mode** — "compare this month's submission against
   last month's" (keeps coming up in the user's mental model).

---

## 16. Key Design Decisions (with "why")

| Decision | Why |
|---|---|
| **Detector Protocol with `name` + `run`** | Pluggability with zero UI/router coupling. Adding a detector is one file + one registry entry. |
| **Dual openpyxl load** | Only way to see merged cells, formulas, and Excel error literals. Pandas alone is blind. |
| **Sheetlint parses once during preview, again in the job** | Keeps the preview endpoint cheap and self-contained; trade-off documented. |
| **`run_in_threadpool` for `analyze()`** | STUMPY + openpyxl are CPU-bound; keeping them off the event loop is required for concurrency. |
| **Preview is consumed on submit** | Exactly-once lifecycle guarantees the temp file is cleaned up regardless of success/failure path. |
| **Pydantic v2 schemas cross the API boundary** | Single source of truth: detectors construct them, routers return them, Zod mirrors them. |
| **`claude-opus-4-7` + adaptive thinking + prompt caching + structured outputs** | Best reasoning + cheapest repeat-call path + typed results. Deterministic sample preserves cache prefix. |
| **Named CSS classes over Tailwind utilities** | The design has a strong visual identity; named classes ("forest palette" tokens) read better than inline utility soup. Tailwind still available for spacing. |
| **Inline-SVG chart over Plotly** | ~1 MB of client bundle saved; the design needed warn rings + X markers + polyline — trivial in SVG. |
| **Zod at every fetch boundary** | Backend drift becomes a typed parse error in one place, not a runtime crash ten components deep. |
| **Severity weights CRITICAL=20, WARNING=5, INFO=1 with a row multiplier** | One critical affecting 200 rows is worse than one affecting 1; capped at 2× so a single finding can't tank the score. |
| **TanStack Query `refetchInterval` returning `false` once terminal** | The poll auto-stops without the hook having to imperatively cancel it. Component unmount is the only other exit. |
| **`usePreview` with `staleTime: Infinity`** | Previews are immutable for their 30-minute TTL — no reason to ever refetch in the background. |
| **Scripted scan log** | Honest UX shortcut. Zero backend complexity, feels live, swappable for SSE later. |
| **Two-step Configure flow** | Lets the user skip irrelevant sheets and opt out of the paid AI detector before committing. |

---

## 17. Presentation Cheat Sheet

**The 30-second pitch:**
> Sheetlint is a pre-handoff data-quality inspector for messy Excel files.
> You drop an .xlsx file in, pick what to scan, and get a 0-100 trust
> score with a ranked list of findings and a time-series anomaly chart.
> Under the hood it's FastAPI + Next.js 16, with a framework-free detector
> library that runs five kinds of checks: structural, statistical,
> duplicates, time-series (STUMPY + z-score), and Claude-driven semantic
> checks with prompt caching and structured outputs.

**The five detectors in one sentence each:**
- **Structural** — openpyxl-driven; catches merged cells in the data
  region, formula errors, hidden sheets, pre-header title rows.
- **Statistical** — pandas type profiling + regex pattern coverage +
  null density; catches "mostly numeric except these 10 rows are
  strings" and "looks like an email column except two rows."
- **Duplicates** — `df.duplicated` for exact matches + rapidfuzz
  clustering at threshold 88 for typos like `"Californa"` vs
  `"California"`.
- **Time-series** — rolling z-score on residuals ensembled with STUMPY
  matrix-profile discords; catches single-point spikes **and** shape
  anomalies.
- **AI semantic** — per-column Claude review (`claude-opus-4-7`,
  adaptive thinking, prompt-cached system prompt, Pydantic-typed
  structured output via `messages.parse()`) asking whether the header
  matches the content.

**The three things to point at in the code:**
1. `src/sheetlint/analysis/detectors/base.py` — the Protocol that makes
   the rest of the architecture work.
2. `src/sheetlint/analysis/parser.py::parse_excel` — the dual openpyxl
   load.
3. `frontend/lib/schemas.ts` + `frontend/lib/api.ts` — the network
   boundary where every response is Zod-validated before becoming a
   typed value.

**If someone asks "why this and not X":**
- *"Why not just pandas?"* — pandas hides merged cells, formulas,
  and Excel error literals. You can't detect them without openpyxl.
- *"Why STUMPY instead of Prophet or an LSTM?"* — matrix profile catches
  shape anomalies, not just spikes. Zero training. Works on any ≥50-point
  series. One-line API.
- *"Why framework-free detectors?"* — the same library needs to run
  inside FastAPI today, inside a Celery/Taskiq worker tomorrow, and
  inside CI notebooks forever. Web-framework imports in the detector
  layer would lock that door.
- *"Why two HTTP steps instead of one?"* — the user gets to see the
  worksheet list and opt out of the paid AI detector before committing.
- *"Why a scripted scan log?"* — the backend batches, not streams.
  We could wire SSE, but a 12-line script at 900 ms/step delivered the
  UX in a day and can be swapped later without any frontend surgery.
- *"Why Zod on top of TypeScript?"* — TS types disappear at runtime;
  Zod keeps the contract alive at the network boundary so a backend
  change surfaces as one typed error, not ten silent bugs.
