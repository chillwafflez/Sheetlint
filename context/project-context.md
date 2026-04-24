# Excel Detector — Project Context

> **Living document.** Update the **Current status / where I left off** section at the end of every meaningful work session so the next Claude can pick up cold without re-deriving anything.

---

## 1. Origin and motivation

The user (a data engineer working in PySpark / Microsoft Fabric) was tasked by their tech lead with: *"Come up with an idea to automate processes in either one specific industry or across different industries."*

The user has direct, recurring pain ingesting messy human-entered Excel files from upstream business teams (insurance submissions, mortgage docs, finance reports). Files arrive with merged cells, mid-sheet headers, currency-as-text, fuzzy state typos, hidden sheets, formula errors, and time-series data with spikes that turn out to be data-entry mistakes. Each file requires manual triage before the pipeline can touch it.

**The product idea: Excel Detector.** A pre-handoff inspector that runs structural + statistical + ML + AI checks against an `.xlsx` file and produces a ranked, human-readable issue report plus a single 0–100 trust score and letter grade. Designed for two audiences from the same data:

- **Domain worker** (insurance agent, finance staff, mortgage processor) who fills out the file. Sees the trust score and finding cards. Cleans before handoff.
- **Data engineer / analyst** who receives the file. Sees the same findings plus an inferred **Pandera schema** they can drop straight into a pipeline.

The user explicitly chose:
- **Path B** (STUMPY matrix profile) for time-series detection over Prophet/LSTM, after being told they had more than the original 1-week budget.
- **Python 3.13** for the conda env (max version supported by the entire stack — `numba` 0.63 needed for 3.14 isn't out yet, and `ydata-profiling` requires <3.14).
- **Streamlit** for the prototype, with a planned migration to Next.js + FastAPI for production (see Section 6).

---

## 2. Personas in detail

### Domain worker
- Uses Excel daily, not a developer. Won't read tracebacks.
- Cares about: *"Is my file clean enough to send?"* — wants a single answer.
- Surface: the **trust score** (A+ to F), severity badges (color-coded, plain language), `suggested_fix` strings written in business voice, not engineering voice.

### Data engineer / analyst
- Reads the same report differently — wants the schema, the row indices, and the structural specifics so they can push back on the sender with concrete asks.
- Surface: the **Schema page** (Pandera script + download), the **Issues page** (filterable list + CSV export), the time-series chart with raw values.

The same `Finding` objects feed both — separation is purely UI presentation.

---

## 3. Architecture

### Layering

```
┌──────────────────────────────────────────────────────────┐
│ UI (Streamlit now → Next.js later)                       │
│   pages/*.py  +  src/excel_detector/ui/*                 │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│ Orchestration                                            │
│   analyzer.analyze() — runs the detector stack           │
│   scoring.TrustScore — rolls findings into 0–100 + grade │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│ Detector Protocol (pluggable)                            │
│   structural / statistical / duplicates / timeseries / ai│
└──────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│ Parser (openpyxl × 2 + pandas)                           │
│   ExcelDocument { sheets: list[SheetView] }              │
└──────────────────────────────────────────────────────────┘
```

### Why this layering

- **UI is the only Streamlit-coupled layer.** Everything below is pure Python — testable, scriptable, and ports verbatim to FastAPI.
- **Detector Protocol** keeps the surface honest: every detector is one file, one class, one method. New detectors (Prophet, LSTM autoencoder, Great Expectations rule packs) drop in without UI changes.
- **Dual openpyxl load** preserves the things pandas hides: merged cells, formulas, error literals, hidden state. This is the unsung hero of the parser — without it, structural detection is impossible.

### The data contract

```python
@dataclass(frozen=True)
class Finding:
    detector: str
    severity: Severity            # CRITICAL | WARNING | INFO
    sheet: str
    message: str
    column: str | None = None
    rows: list[int] = field(default_factory=list)
    suggested_fix: str | None = None
    metadata: dict = field(default_factory=dict)  # free-form, used by chart layer
```

`AnalysisResult` carries `findings: list[Finding]`, `anomalies: list[AnomalyResult]` (time-series only), `trust_score: float`, and `score_breakdown: dict`. Both classes will become **Pydantic v2 models** during the FastAPI migration so they serialize to JSON for free and generate OpenAPI schemas.

---

## 4. Detector inventory

| Detector | File | What it catches | How |
|---|---|---|---|
| **Structural** | `detectors/structural.py` | Hidden sheets, mid-sheet header shifts, merged cells in the data region, formula errors (`#REF!`, `#N/A`, `#DIV/0!`, etc.), fully empty columns | Uses openpyxl's `merged_cells.ranges` + the formula-preserving workbook view; `range_boundaries()` to filter merges in headers vs data |
| **Statistical** | `detectors/statistical.py` | Type purity (mixed currency-as-text in numeric column), regex pattern coverage (email/phone/ZIP/SSN/ISO date/US date/currency), null density | Per-column distribution checks; thresholds: type purity <85%, null density 20–95% |
| **Duplicates** | `detectors/duplicates.py` | Exact row duplicates, fuzzy near-duplicates (`"Californa"` vs `"California"`) | `df.duplicated(keep=False)` + `rapidfuzz.fuzz.ratio` clustering at threshold 88; limited to columns with 5–500 unique values |
| **Time-series** | `detectors/timeseries.py` | Spikes (z-score) and shape discords (matrix profile) in any (date, numeric) column pair | Auto-detects pairs; rolling z-score on residuals (median + MAD, ±3.0 threshold) **ensembled** with `stumpy.stump()` for top-3 discords. Needs ≥50 points for STUMPY; falls back to z-score below that |
| **AI semantic** | `detectors/ai.py` | Column-name-vs-content mismatch, entity-type drift, semantic issues regex can't catch | One Claude call per column, `claude-opus-4-7`, adaptive thinking, prompt-cached system prompt, structured output via `client.messages.parse(output_format=ColumnAssessment)`. Deterministic 25-row sample (first N) to preserve cache prefix |

### Adding a new detector — the recipe

1. Create `src/excel_detector/detectors/<name>.py` with a class implementing the `Detector` Protocol.
2. Register it in `detectors/__init__.py` inside `default_detectors()`.
3. Add a deliberate trigger to `samples/generate_sample.py` so the demo continues to surface every detector.
4. Don't touch the UI. The Issues page, Overview breakdown, and CSV export pick it up automatically.

---

## 5. Trust score

`scoring.TrustScore.from_findings()`:
- Starts at 100.
- Per finding: `deduction = severity.weight × row_multiplier`
  - `severity.weight`: CRITICAL=20, WARNING=5, INFO=1
  - `row_multiplier = 1.0 + min(rows / 200, 1.0)` — so a critical affecting 1 row hurts less than one affecting 200.
- Grade thresholds: A+ ≥95, A ≥85, B ≥75, C ≥60, D ≥40, F otherwise.
- Returns: `score`, `grade`, `breakdown` (per-detector deduction sum), `by_severity` (count map).

This is the single number the domain worker reads. The breakdown is what the engineer reads.

---

## 6. Production migration plan (agreed direction)

**Streamlit is the prototype, not the destination.** Re-renders the whole script on every interaction, owns its own state model, no real auth, awkward async, painful horizontal scaling. Once a real customer logs in, uploads a 50MB workbook, and expects history of past runs, Streamlit fights you. The Streamlit UI is the only thing being rewritten — every detector and the parser stay as-is.

### Target stack (from the conversation, agreed but not yet built)

**Backend — FastAPI**
- Python 3.13, FastAPI 0.122+, Pydantic v2, `uv` for deps.
- `POST /analyze` accepts `UploadFile` (spools to disk for large files), returns the `AnalysisResult` JSON.
- `BackgroundTasks` for files large enough that synchronous response would time out — return HTTP 202 + `job_id`, frontend polls `/jobs/{id}`.
- Migrate `Finding`, `AnalysisResult`, `AnomalyResult` from `@dataclass` to Pydantic models.
- OpenAPI docs auto-generated at `/docs`.
- CORS configured for the Next.js origin.

**Frontend — Next.js + TypeScript**
- Next.js 15 (App Router), TypeScript strict.
- **shadcn/ui** for components (Card → finding cards, Badge → severity, Table → issues, Tabs → page nav, Progress → trust score, Dialog → upload, Sonner → toasts). Theme via CSS variables; port the `#2563EB` blue-slate palette.
- **TanStack Table** for the Issues page — sortable, filterable, virtualizable.
- **Plotly.js** for the time-series chart (closest port from current `plotly.graph_objects` code) — alternative: Recharts for a more idiomatic React feel.
- **TanStack Query** for API call lifecycle (loading, retries, polling).
- **Zod** to runtime-validate API responses; share the schema with TypeScript types.

**Persistence + infra (when needed, not for the demo)**
- Postgres (Neon / Render Postgres) for run history + share links.
- S3 / Cloudflare R2 for file storage.
- Redis for cache and Celery / Taskiq queue when async grows up.
- Auth: Clerk (or Auth0). Don't roll your own.
- Secrets: Doppler / Vercel env vars / AWS Secrets Manager. Move off `.streamlit/secrets.toml`.

**Deploy tiers**
| Tier | Frontend | Backend | DB / storage | Cost |
|---|---|---|---|---|
| Demo / staging | Vercel | Render or Railway | Render Postgres + R2 | $0–$20/mo |
| Real prod (small) | Vercel | Fly.io multi-region | Neon + AWS S3 | $50–$200/mo |
| Enterprise | Vercel Enterprise / self-host | AWS ECS / EKS | RDS + S3 | varies |

**Observability**
- Sentry on both frontend and backend (5-minute integration).
- Logfire (Pydantic) or OpenTelemetry → Grafana Cloud for traces; particularly useful to see which detector is slow on which file shape.

### Phased roadmap
- **Tier 1 (DONE 2026-04-21):** FastAPI wrapper around the detector stack. Async-from-day-one: `POST /api/v1/analysis` returns 202 + job_id; `GET /api/v1/jobs/{id}` polls. Pydantic v2 schemas replaced the dataclasses. Streamlit layer removed entirely. *You now have a real API.*
- **Tier 2 (3–5 days):** Build Next.js + shadcn/ui frontend. Five pages mirror original Streamlit structure. Deploy Vercel + Render. *You now have a real product.*
- **Tier 3 (2–4 weeks):** Auth, Postgres, S3, Celery / Redis-backed JobStore, Sentry, Docker, CI/CD, RBAC for engineer vs domain-worker personas. *You now have a SaaS.*

---

## 7. Decision log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-21 | Python **3.13** for the conda env | Highest version supported by every dep. `ydata-profiling` requires <3.14; `numba` 0.63 (needed for 3.14 via stumpy) isn't released. Other libs are version-agile. |
| 2026-04-21 | **Path B** (STUMPY) for time-series | User chose matrix-profile over Prophet/LSTM after extra time was granted. Catches *shape* anomalies, not just spikes. |
| 2026-04-21 | **Streamlit** for the prototype, **Next.js + FastAPI** for production | Streamlit is right for 1-week velocity; will not survive real auth, multi-tenant, or large files. Detector code is intentionally framework-free so the migration is cheap. |
| 2026-04-21 | Detector **Protocol** with `name` + `run(doc) -> list[Finding]` | Pluggability without UI coupling. Adding a detector requires zero UI changes. |
| 2026-04-21 | **Dual openpyxl load** in parser | Only way to see formulas and merged cells; pandas hides them. |
| 2026-04-21 | Severity weights: CRITICAL=20, WARNING=5, INFO=1, with row-count multiplier | One critical affecting 200 rows is worse than one affecting 1; the multiplier (`1 + min(rows/200, 1.0)`) caps at 2× so a single critical doesn't tank the whole score. |
| 2026-04-21 | AI: **`claude-opus-4-7`** with adaptive thinking, prompt caching, structured output via `messages.parse()` | Best model + cheapest repeat-call path. Deterministic sample (first N rows) preserves cache prefix across re-runs. |
| 2026-04-21 | `samples/*.xlsx` gitignored, regenerate via `generate_sample.py` | Sample is a binary artifact; regenerable. The script is the source of truth. |
| 2026-04-21 | Added `black>=24.0` to `requirements.txt` | Pandera's `schema.to_script()` runs output through Black; without it the Schema page errors. |

---

## 8. Open questions / future work

- **Profiling tab**: `ydata-profiling` is in `requirements.txt` but no page renders a profile yet. Worth a 6th page, or a tab on Overview?
- **Great Expectations integration**: alternative or complement to Pandera schema export — would let engineers run the inferred expectations as a CI check on future files.
- **Multi-file mode**: a "diff this month's submission against last month" use case keeps coming up in the user's mental model. Would need `ExcelDocument` comparison, not just single-file analysis.
- **Domain rule packs**: insurance-specific (state code valid, premium > 0), mortgage-specific, finance-specific. Should these be detectors or a separate "rules" layer?
- **Async AI calls**: currently the AI detector is sequential per column — for a 30-column sheet that's 30 round-trips. `asyncio.gather` would parallelize.
- **Streaming API**: when migrating to FastAPI, consider Server-Sent Events for streaming findings as detectors complete, instead of waiting for the whole stack.
- **Auth-aware schema export**: data engineer can download the Pandera script; should domain workers also be able to, or is that role-gated?

---

## 9. Current status / where I left off

> **Update this section at the end of every working session.** Keep the prior entry as a short historical note above the latest one.

### 2026-04-23 (latest) — First production deployment: Render (backend) + Vercel (frontend)

**Done:**
- **Backend live on Render free tier.** Service `sheetlint-api` at `https://sheetlint-api.onrender.com`. Configured via the Render dashboard (not Blueprint). `/health` returns 200 with `environment=production`.
  - **Build command:** `pip install uv && uv sync --no-dev`
  - **Start command:** `uv run uvicorn sheetlint.main:app --host 0.0.0.0 --port $PORT --workers 1`
  - **Env vars set:** `ENVIRONMENT=production`, `LOG_LEVEL=INFO`, `CORS_ORIGINS=["https://sheetlint.vercel.app"]`, `ANTHROPIC_API_KEY=<set>`, `ENABLE_AI=true`, plus the TTL/cleanup knobs at defaults.
  - Auto-deploy on push to `main` is on.
- **Frontend live on Vercel.** Project `sheetlint` at `https://sheetlint.vercel.app`. Imported from GitHub with **Root Directory = `frontend`**. Framework preset auto-detected Next.js 16; build command, output dir, install command all defaults.
  - **One env var** `NEXT_PUBLIC_API_URL=https://sheetlint-api.onrender.com` (no trailing slash, no `/api/v1` — `lib/api.ts` appends that itself). Set before first build so it gets inlined into the bundle.
- **End-to-end smoke test passed** on the deployed pair: upload → preview → configure → analyze → poll → report, all working against the real Render backend from the real Vercel frontend.
- **Files added to repo:**
  - `.python-version` → pins `3.11.9` for local `uv` / pyenv consistency. Ignored by the dashboard-configured Render service but harmless and useful if we ever switch to Blueprint.
  - `frontend/.env.local.example` → documents `NEXT_PUBLIC_API_URL` for future local devs.
- **`render.yaml` created but NOT committed.** Documented as a Blueprint file for the record, but the live Render service was configured through the dashboard, so the YAML is a mismatched source of truth. Decision: keep it around locally as reference; commit only if we ever recreate the service via `New → Blueprint` (which would give a new URL and force a Vercel CORS re-config).
- **Deployment workflow established:** every push to `main` triggers independent rebuilds on both platforms. Vercel rebuilds only on `frontend/**` changes, Render only on backend changes. Rollbacks available on both dashboards (Vercel: Promote to Production on an old deployment; Render: Rollback on Deploys tab).

**Key config decisions and gotchas captured:**
- **`--workers 1` is load-bearing.** Both `JobStore` and `PreviewStore` are in-memory on `app.state`. Multi-worker = state splits across processes = preview POST lands on worker A, analyze POST hits worker B, preview not found. Single worker is a scalability ceiling, not a functionality ceiling — every detector runs correctly under one worker.
- **`CORS_ORIGINS` is an exact-string match with no trailing slash.** Browser sends `Origin: https://sheetlint.vercel.app`; the allowlist must match byte-for-byte. Got this right on the first try.
- **`NEXT_PUBLIC_*` env vars are baked at build time, not read at runtime.** Changing `NEXT_PUBLIC_API_URL` requires a Vercel redeploy, not just a restart. Set it before the first build to avoid a wasted deploy.
- **Render free-tier cold start** ≈ 30s after 15 min idle, because of spin-up + STUMPY's first-call JIT. Demo mitigation: hit `/health` once before opening slides.
- **Production URL is `sheetlint.vercel.app`**, not the long hashed deployment URL. The long URL is an immutable per-build snapshot kept around for rollback/QA; never put it in CORS or share it as "the site."

**Known deployment limitations (carried over, unchanged):**
- Single worker → no horizontal scale. Swap both stores to Redis to unlock multi-worker (Tier 1.5).
- Render free tier sleeps after 15 min idle. Paid tier or cron keepalive fixes this.
- No PR preview backends — Vercel previews all hit the production Render backend. Fine for a demo; not for team workflows.
- No custom domain yet. `.vercel.app` is good enough for the lead demo.

**Next session — pick whichever:**
1. **Warm-keepalive** — tiny cron (GitHub Actions or UptimeRobot) hitting `/health` every 10 min during business hours so the demo never hits a cold start.
2. **Redis-backed stores** — swap `JobStore` + `PreviewStore` together; unlocks multi-worker, PR preview backends, and persistence of in-flight previews across restarts.
3. **Custom domain** — point a real domain at Vercel + update `CORS_ORIGINS` on Render.
4. **Sentry on both sides** — 5-min integration; catches the cold-start timeout / 502 cases during the demo.
5. **CI** — GitHub Actions running `uv run pytest` + `npm run build` on PRs so a broken main never auto-deploys.

---

### 2026-04-22 — Configure flow: preview → config → run

**Done:**
- Converted the API from "POST file, run everything" to a two-step flow that honors the Configure screen from the design mock.
- **Backend:**
  - `POST /api/v1/analysis/preview` (multipart) → parses with openpyxl, stashes the temp file in a new `PreviewStore`, returns `AnalysisPreview` with per-sheet `{name, row_count, col_count, hidden, header_row, flags, preview.{headers,rows}}`.
  - `GET /api/v1/analysis/preview/{preview_id}` → refresh-safe read.
  - `POST /api/v1/analysis` now takes `AnalysisConfig` JSON (`{preview_id, sheets: [str], detectors: DetectorId[]}`), resolves preview → temp path, kicks the background job, then discards the preview in the task's `finally`. Missing/expired preview → 404; unknown sheet → 400.
  - New `DetectorId` StrEnum in `analysis/schemas.py` (structural / statistical / duplicates / timeseries / ai). Detector registry in `detectors/__init__.py` with `build_detectors(ids, *, api_key)`; `default_detectors` now routes through the registry.
  - `analyze()` in `service.py` gained `sheet_filter: Iterable[str] | None` and `detector_ids: Iterable[DetectorId] | None`. Precedence: `detectors` > `detector_ids` > default.
  - `PreviewStore` in `analysis/preview.py` — same async-lock + TTL shape as `JobStore` so the Redis swap is mechanical. Defaults: `preview_ttl_minutes=30`, `preview_cleanup_interval_seconds=300` (both in `config.py`). `main.py` lifespan mounts it on `app.state` and runs a cleanup loop that unlinks expired temp files.
  - Sheet flag derivation (cheap — no detector run): `hidden`, `pre-header rows`, `merged cells` (only if inside the data region), `formula errors`, `empty`, `wide` (>20 cols), else `looks clean`.
  - New exceptions: `PreviewNotFoundError` → 404, `InvalidAnalysisConfigError` → 400. Handlers live in `main.py` alongside the existing ones.
  - **Tests:** rewrote `tests/test_analysis_flow.py` for the two-step flow. 11 tests cover: preview round-trip, refetch by id, unknown preview 404, end-to-end analysis, detector filter honored, preview cannot be reused (consumed on job completion), unknown sheet in config 400, unknown job 404, invalid extension 400, unparseable xlsx 400, health. `conftest.py` sets `preview_cleanup_interval_seconds=3600` so the reaper never fires mid-test. Suite still runs in <0.5s.
- **Frontend:**
  - `lib/schemas.ts` mirrors every new backend model (`detectorIdSchema`, `sheetPreviewSchema`, `sheetMetadataSchema`, `analysisPreviewSchema`, `analysisConfigSchema`).
  - `lib/api.ts` gained `createPreview`, `getPreview`, `submitAnalysis` (now JSON). `getJob` unchanged.
  - Hooks: new `use-create-preview.ts` (upload → navigate to `/configure/{id}`), new `use-preview.ts` (TanStack query, 404 halts retry, `staleTime: Infinity` since previews never mutate), `use-submit-analysis.ts` now takes `AnalysisConfig` and navigates to `/analysis/{job_id}`.
  - `upload-zone.tsx` rewired to `useCreatePreview`.
  - **New route** `app/configure/[previewId]/page.tsx` with `SheetPicker` (all visible sheets preselected, hidden-sheets toggle, select-all / clear shortcuts, flag chips including "looks clean"), `DetectorPicker` (4 non-AI detectors preselected, AI card warns about the Claude API spend), `PreviewStrip` (first N rows of a single selected sheet), `ConfigureFooter` (count summary + Cancel + "Run inspection"). Copy on the detector cards was rewritten to describe the real detectors (type purity / regex coverage / null density on Statistical; STUMPY + rolling z-score on Time-series; claude-opus-4-7 on Claude semantic) — the mock's copy was generic and some of it was wrong.
  - **Cross-reference detector dropped entirely** from the picker per product call. No backend plumbing either.
  - `TopBar` crumbs: `[Sheetlint, Configure]` on `/configure/*`.
  - Configure-specific classes (`.sheet-card`, `.detector`, `.toggle`, `.ai-callout`, `.preview-strip`, etc.) ported into `app/globals.css`.
- **Known trade-off:** the preview endpoint parses the file once; the /analysis background task parses it again. 2× parse cost. Fine for MVP — optimize if parse time becomes a visible bottleneck.

**How the flow works end-to-end now:**
1. User drops a file on `/` → `useCreatePreview` → `POST /analysis/preview` → server parses + stashes + returns `AnalysisPreview` → router.push(`/configure/{preview_id}`).
2. Configure page `usePreview(id)` → `GET /analysis/preview/{id}` → renders sheet and detector pickers with preselected defaults.
3. User clicks "Run inspection" → `useSubmitAnalysis` → `POST /analysis` with JSON config → server creates Job, kicks background task, returns 202 + `JobCreated`. Background task re-parses the temp file (by path), runs filtered detector stack, stores `AnalysisResult`, discards preview + unlinks temp file.
4. Router.push(`/analysis/{job_id}`) → scanning view polls → report.

**Known Tier 1 limitations (unchanged):**
- In-memory `JobStore` and `PreviewStore` die with the worker; single-process only. Both are shaped to swap to Redis together in Tier 1.5.
- `BackgroundTasks` — lost mid-crash. Upgrade to Celery/Taskiq alongside Redis.
- AI detector still sequential.

**Next session — pick whichever:**
1. **Real streaming scan log** — SSE endpoint that the scanning screen consumes instead of the scripted simulation in `useScanLog`.
2. **Redis-backed stores** — swap `JobStore` + `PreviewStore` together; the interfaces match.
3. **Async AI detector** — `asyncio.gather` the per-column Claude calls.
4. **Persistence + auth** — Postgres + Clerk for run history and share links.
5. **Domain rule packs** — e.g. an `InsuranceDetector` with state-code validation, premium > 0, policy ID prefix.

---

### 2026-04-22 — Frontend redesign from Claude Design bundle

**Done:**
- Replaced the shadcn/ui-based frontend with the Claude Design handoff from `sheetlint/project/` (Instrument Serif + Inter + JetBrains Mono, OKLCH "forest" palette, named component classes — `.btn`, `.score-card`, `.callout`, `.issues-table`, `.ts-card`, etc.).
- Design tokens live as CSS custom properties in `app/globals.css`. Palette (forest/ocean/slate) is switched via `[data-palette]` on `<html>`; density (comfortable/compact) via `[data-density]`. Tokens are also exposed to Tailwind v4 via `@theme inline` so utilities like `bg-accent-soft` work alongside the named classes.
- Fonts loaded via `next/font/google` (`Instrument_Serif`, `Inter`, `JetBrains_Mono`) and exposed as CSS variables consumed by globals.css.
- **Upload →** hero with italic "before" in accent, dashed drop zone with sketchy-icon, 5-column features strip.
- **Scanning →** `ScanningView` (spinner + progress bar + streaming log). Backend is batch, so `useScanLog` drives a scripted 12-line log at ~900 ms per step and caps at 95% until the job's status flips to `succeeded`. Progress is derived (`done ? 100 : tick`), no setState-in-effect.
- **Report layout →** `ReportHeader` (eyebrow + title + meta + CSV/new-inspection actions), `ReportTabs` (Overview / Issues / Time-series) using Link-based routing. Old `AnalysisNav`, `JobStatusBanner`, `FindingCard` gone.
- **Overview →** score-card dial (giant 0–100 in Instrument Serif + italic "Grade X" in accent + threshold footer + colored bar), 3 severity KPIs, points-deducted-by-detector bar list, callout list for criticals, 3-item callout for notable warnings.
- **Issues →** filter bar (search + severity + detector + count + CSV), sortable headers (severity / detector / sheet / column / row_count), expandable rows showing `IssueDetail` (kv-grid on the left + "why this matters" + per-detector "Detection technique" blurb on the right).
- **Time-series →** pure inline-SVG `TimeSeriesChart` replaces the 1 MB Plotly bundle. Renders polyline + fill-under-accent, warn rings at `z_flagged`, critical X-markers at `mp_flagged`. Stretches to container via `preserveAspectRatio="none"`.
- **Tweaks →** bottom-right panel toggled from the TopBar. Palette swatches + density segmented control. Persisted to `localStorage` via `useSyncExternalStore` (no hydration mismatch, no setState-in-effect lint errors).
- **Dep prune:** dropped `@base-ui/react`, `class-variance-authority`, `clsx`, `lucide-react`, `next-themes`, `plotly.js`, `react-plotly.js`, `shadcn`, `tailwind-merge`, `tw-animate-css`, `@types/plotly.js`, `@types/react-plotly.js`. Removed `lib/utils.ts` (the `cn` helper had no remaining callers). `components/ui/` now contains only a simplified `sonner.tsx`.
- Backend unchanged. `lib/schemas.ts`, `lib/api.ts`, `lib/env.ts`, `hooks/use-job.ts`, `hooks/use-submit-analysis.ts` all carry over untouched — the redesign is purely presentational.
- `npm run lint` and `npm run build` both clean; all 4 routes (`/`, `/analysis/[jobId]`, `/analysis/[jobId]/issues`, `/analysis/[jobId]/time-series`) type-check.

**Intentionally not implemented (scoped out until backend supports it):**
- The design's **Configure** screen (pick worksheets + detectors before submit). The backend currently runs every detector against every sheet — implementing Configure as a client-only filter would be a decorative no-op. When backend gains per-request filtering (probably via query params or a POST body), wire Configure in between upload and scanning.
- **Sample files** on the upload screen. The mock lists three; without a way to ship a real `.xlsx` payload from the browser, it'd be a dead button.
- Streaming the real detector log. `useScanLog` is a scripted simulation. An SSE endpoint on the API (open question in §8) would turn the log real.

**Next session — pick whichever:**
1. **Configure screen** — needs backend: either a `sheets` listing endpoint (`POST /api/v1/analysis/preview` → returns sheet metadata) or accepting a `config` field on the submit form. Then port `sheetlint/project/src/screen_configure.jsx` using the same token-driven CSS.
2. **Real scan log** — add SSE to the FastAPI worker. Stream `detector_started` / `finding_added` / `detector_finished` events. Replace `useScanLog` with an `EventSource` hook.
3. **Persistence** — Postgres run history + share links (Tier 3 from §6).
4. **Redis-backed JobStore** — multi-worker deploy prerequisite.
5. **Async AI detector** — `asyncio.gather` the per-column Claude calls.

---

### 2026-04-21 — Tier 2 Next.js frontend complete

**Done:**
- Scaffolded Next.js 16.2 in `frontend/` with App Router, TypeScript strict, Tailwind v4, Turbopack, `@/*` import alias, no src-dir. React 19.2.
- Installed shadcn/ui (base-nova preset, neutral palette, lucide icons): button, card, badge, table, tabs, progress, input, dialog, sonner, skeleton, select, separator, tooltip.
- Extra runtime deps: `@tanstack/react-query` v5, `zod` v4, `react-plotly.js` + `plotly.js`, `lucide-react`. Types: `@types/react-plotly.js`, `@types/plotly.js`.
- **API contract at the network boundary:** `frontend/lib/schemas.ts` mirrors the backend Pydantic models 1:1 (`Severity`, `Finding`, `AnomalyResult`, `TrustScore`, `AnalysisResult`, `Job`, `JobStatus`, `JobCreated`, plus a narrowed `TimeSeriesMetadata`). Every `fetch().json()` in `lib/api.ts` is piped through `.parse()` before typed values leave the module.
- **Env validation:** `lib/env.ts` runs Zod against `NEXT_PUBLIC_*` at import time — missing/misshapen values fail the build, not first request.
- **Hooks:** `use-submit-analysis` (TanStack `useMutation` → `router.push(/analysis/{id})` on 202), `use-job` (TanStack `useQuery` with `refetchInterval` that halts once status is terminal; disables retry on 404).
- **Pages:**
  - `/` — upload zone (drag-drop + click), feature teaser.
  - `/analysis/[jobId]` — shared `layout.tsx` polls job + renders header with filename/grade + status banner + nav tabs (only when succeeded). Children read from the same TanStack cache key so they share the one poll loop.
  - `/analysis/[jobId]/page.tsx` — Overview: `TrustScoreCard` hero + `SeverityKpis` + per-detector breakdown (HTML bars, no chart lib) + top 5 critical findings + collapsible AI insights.
  - `/analysis/[jobId]/issues/page.tsx` — filterable shadcn Table: text search + severity/detector/sheet dropdowns. Client-side CSV export via Blob.
  - `/analysis/[jobId]/time-series/page.tsx` — Plotly chart per anomaly (dynamic-imported with `ssr: false`). `timeSeriesMetadataSchema.safeParse(metadata)` narrows the generic `dict[str, Any]` the backend ships through `AnomalyResult.metadata`.
- **Shared components:** `UploadZone`, `TrustScoreCard`, `SeverityKpis`, `FindingCard`, `SeverityBadge`, `JobStatusBanner`, `AnalysisNav` — all tuned to the #2563EB blue-slate palette that carried over from the Streamlit design.
- Updated root `layout.tsx` to mount a `Providers` client component wrapping `QueryClientProvider` + `TooltipProvider` + `Toaster`.
- `npm run build` clean (all 4 routes compile, types pass, eslint clean). Static `/`, dynamic `/analysis/...`.

**How to run (both services):**
```bash
# Terminal 1 — backend
uv sync && uv run uvicorn sheetlint.main:app --reload

# Terminal 2 — frontend
cd frontend && npm install && npm run dev
```
Open http://localhost:3000, upload a workbook generated via `python samples/generate_sample.py`, watch the polling → report flow.

**Next session — pick whichever:**
1. **Tier 3 infra** — Dockerfiles (FastAPI + Next.js), GitHub Actions CI, Sentry on both sides.
2. **Persistence** — Postgres for run history + share links. Pair with auth (Clerk/Auth0) so "my previous analyses" is a real view.
3. **Redis-backed JobStore** — needed before any multi-worker deploy. Interface in `jobs/service.py` is shaped to port.
4. **Celery / Taskiq** — so `BackgroundTasks` doesn't drop jobs when a worker crashes.
5. **Async AI detector** — `asyncio.gather` the per-column Claude calls.
6. **Frontend polish** — dark mode toggle (shadcn `next-themes` is already installed), keyboard accessibility audit, Suspense boundaries with granular skeletons.
7. **Domain rule packs** — e.g. `InsuranceDetector` with state-code validation, premium > 0, policy ID prefix.

**Known Tier 2 limitations:**
- No frontend tests (explicit scope decision for the demo).
- Single-select filters on the Issues page — multi-select would need a DropdownMenu + checkboxes (`npx shadcn add dropdown-menu`).
- No share URLs: the job_id IS the URL, but the job is gone after `JOB_RESULT_TTL_HOURS` (default 24) or a backend restart. Persistence lives in Tier 3.
- Plotly is heavy (~1MB gzipped). Fine behind a dynamic import for a demo; swap to Recharts or a trimmed Plotly bundle later if bundle size matters.

---

### 2026-04-21 (earlier) — Tier 1 FastAPI complete, Streamlit removed

**Done:**
- Repo restructured: `src/excel_detector/` → `src/sheetlint/`. Streamlit layer deleted (`app.py`, `pages/`, `src/excel_detector/ui/`, `.streamlit/`, `requirements.txt`).
- Dependencies migrated to **uv + pyproject.toml** with `uv.lock`. Dead deps pruned (streamlit, plotly, pyod, ydata-profiling, pandera, black, statsmodels, scipy, scikit-learn — none were actually imported anywhere).
- `Finding`, `AnalysisResult`, `AnomalyResult` converted from `@dataclass` to **Pydantic v2** models in `src/sheetlint/analysis/schemas.py`. `row_count` is now a `@computed_field`; `Severity` is `StrEnum`. `TrustScore` is a proper nested model — the `score_breakdown["_grade"]` / `["_by_severity"]` dict hack is gone.
- `Detector` Protocol stayed in `detectors/base.py`; everything else moved out of there.
- AI detector now takes `api_key` via constructor injection. `_get_api_key()` / Streamlit-secrets fallback removed. Settings layer (`sheetlint/config.py`, pydantic-settings) supplies the key at run time.
- FastAPI app under `src/sheetlint/main.py`: lifespan-managed `JobStore` on `app.state`, periodic TTL cleanup task, CORS middleware, versioned router mount at `/api/v1`, `/health` probe, `/docs` gated on environment.
- Two bounded contexts per the FastAPI best-practices guide: `analysis/` (router, schemas, service, parser, scoring, detectors, dependencies, exceptions) and `jobs/` (router, schemas, service, dependencies, exceptions).
- **Async-from-day-one:** `POST /api/v1/analysis` accepts multipart upload, validates extension + size, spools to a temp file, creates a Job, schedules `BackgroundTasks` + `run_in_threadpool`, returns `202` with `Location` header pointing at the polling URL. `GET /api/v1/jobs/{id}` returns the current state with the `AnalysisResult` once `status=succeeded`. Temp files are cleaned in the task's `finally`.
- Exception handlers translate `InvalidExcelFileError` → 400, `FileTooLargeError` → 413, `JobNotFoundError` → 404.
- Tests use `httpx.AsyncClient` + `ASGITransport` + manual `app.router.lifespan_context()` (ASGITransport doesn't propagate lifespan). 4 tests pass: health, end-to-end analysis flow, unknown-job 404, invalid-extension 400. Suite runs in ~0.1s.
- Ruff clean (`E F W I UP B SIM ASYNC`), mypy non-strict.
- README, CLAUDE.md updated for the new layout and run instructions.

**How to run:**
```bash
uv sync
cp .env.example .env    # optional
uv run uvicorn sheetlint.main:app --reload   # http://localhost:8000/docs
uv run pytest                                # suite
uv run ruff check src tests                  # lint
```

**Next session — pick whichever:**
1. **Tier 2 (Next.js + shadcn/ui)** — now that the API is stable, mirror the five old Streamlit pages as React routes. Use TanStack Query against `POST /api/v1/analysis` + polling on `GET /api/v1/jobs/{id}`. TanStack Table for the Issues page, Plotly.js for time-series.
2. **Async AI detector** — `asyncio.gather` the per-column Claude calls in `detectors/ai.py`. Big latency win for wide sheets.
3. **Redis-backed JobStore** — swap `jobs/service.py` in place; the interface is already the shape to port. Needed before multi-worker deploy.
4. **Celery / Taskiq worker** — graduate from `BackgroundTasks` so a worker crash doesn't lose jobs. Pairs with Redis.
5. **Profiling tab** — re-introduce via a new `/profile/{sheet}` endpoint instead of a Streamlit page.
6. **Domain rule packs** — insurance-specific (state code valid, premium > 0, valid policy ID prefix) as a new `InsuranceDetector`.

**Known Tier 1 limitations (documented but not blocking):**
- In-memory `JobStore` dies with the worker; single-process only.
- `BackgroundTasks` loses jobs if the worker crashes mid-analysis (matches the JobStore — upgrade them together).
- AI detector is sequential.
- No persistence of past runs.
- Only `.xlsx` supported.

---

### 2026-04-21 — Prototype complete, ready for demo

**Done:**
- Full Streamlit prototype runs end-to-end on Python 3.13.
- All 5 detectors wired and producing findings against the seeded sample (`samples/broken_insurance_submissions.xlsx`).
- 5-page UI: Home, Overview, Issues, Time-series, AI Insights, Schema.
- Trust score + grade + per-detector breakdown.
- Sample generator (`samples/generate_sample.py`) seeds one of every issue type.
- Fixed: `pd.to_datetime` warnings (suppressed in date-probing call), Streamlit `use_container_width` deprecation (→ `width="stretch"`), Pandera `to_script()` requires `black` (added to `requirements.txt`).
- `.gitignore` audited and extended (Excel lock files, Jupyter checkpoints, coverage). `.streamlit/secrets.toml` correctly excluded.
- `CLAUDE.md` and `context/project-context.md` (this file) created.

**Demo readiness:**
- Run with: `conda activate excel-detector` → `python samples/generate_sample.py` → `streamlit run app.py`.
- Open browser at `http://localhost:8501`, click "Try the broken sample" on Home.
- Expected: trust score in the 50–70 range, ~10 findings spanning every detector, time-series chart shows orange z-score marker around row 80 and red STUMPY markers at rows 125–135.

**Next session — pick whichever:**
1. **Production migration Tier 1** (FastAPI wrapper) — start with a single `POST /analyze` endpoint; convert `Finding` / `AnalysisResult` to Pydantic v2 models.
2. **Production migration Tier 2** (Next.js + shadcn/ui frontend) — only after Tier 1 is callable.
3. **Profiling tab** — wire `ydata-profiling` into a new `pages/profile.py`.
4. **Async AI** — `asyncio.gather` the per-column Claude calls in `detectors/ai.py`.
5. **Domain rule pack** — start with insurance: state code validation, premium > 0, valid policy ID prefix.

**Known limitations (documented but not blocking):**
- Only `.xlsx` supported — `.xls`, `.csv`, `.xlsm` would extend `parser.py`.
- AI detector is sequential, not parallelized.
- No multi-file diff mode.
- No persistence — every analysis runs fresh.
