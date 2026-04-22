# Excel Detector — Claude project context

## What this is

A pre-handoff data-quality inspector for messy human-entered `.xlsx` files. Catches structural, statistical, ML, and AI-driven semantic anomalies before files reach an ingestion pipeline or a downstream consumer. Two personas: **domain workers** (insurance, finance, mortgage) who clean files before handoff, and **data engineers / analysts** who receive those files.

The project started as a 1-week prototype assigned by the user's tech lead — "automate a process in some industry." Inspired by direct pain ingesting messy human-entered Excel files in PySpark / Microsoft Fabric pipelines.

## Stack

### Current (prototype)
- **Python 3.13** in a dedicated conda env named `excel-detector`
- **Streamlit ≥1.40** for the multipage UI (`st.navigation` + `st.Page`)
- **openpyxl** for parsing (dual load: `data_only=True` and `data_only=False`)
- **pandas, numpy, scipy, scikit-learn, statsmodels** for the data layer
- **STUMPY** for matrix-profile time-series anomaly detection
- **rapidfuzz** for fuzzy near-duplicate clustering
- **pandera** for schema inference (`infer_schema().to_script()` — requires `black`)
- **ydata-profiling** (planned for the profiling tab; pin reason for Python <3.14)
- **anthropic** SDK with `claude-opus-4-7`, adaptive thinking, prompt caching, structured outputs via `client.messages.parse()`
- **plotly** for charts

### Planned (production migration — agreed direction, not yet built)
- **Backend:** FastAPI (Python 3.13) + Pydantic v2, wraps the existing detector code as-is
- **Frontend:** Next.js 15 (App Router) + TypeScript + shadcn/ui + Tailwind + TanStack Query + TanStack Table + Zod + Plotly.js
- **Persistence:** Postgres (run history) + S3 / R2 (file storage) + Redis (cache / job queue)
- **Auth:** Clerk or Auth0
- **Async:** FastAPI `BackgroundTasks` initially, Celery / Taskiq when files get large
- **Deploy:** Vercel (frontend) + Render or Fly.io (backend)
- **Observability:** Sentry + Logfire / OpenTelemetry

## Architectural rules

1. **Detectors are framework-free.** Nothing under `src/excel_detector/detectors/` or `src/excel_detector/{parser,scoring,analyzer}.py` may import Streamlit. This is what makes the FastAPI migration cheap — only `app.py`, `pages/*`, and `ui/*` get rewritten.

2. **Detector Protocol is the contract.** Every detector implements:
   ```python
   class Detector(Protocol):
       name: str
       def run(self, doc: ExcelDocument) -> list[Finding]: ...
   ```
   Drop a new file in `src/excel_detector/detectors/`, register it in `detectors/__init__.py`, it shows up in every page automatically. No UI changes needed.

3. **Dual openpyxl load is non-negotiable.** `parser.py` loads each workbook twice — `data_only=True` for calculated values, `data_only=False` for formula strings. This is the only way to see merged cells, formulas, and Excel error literals. Pandas alone cannot.

4. **One broken detector can't kill the report.** `analyzer.py` wraps each detector in try/except and logs failures.

5. **Sample file mirrors detector surface.** `samples/generate_sample.py` seeds *one of every issue type*. When you add a new detector, add a deliberate trigger to the sample so the demo continues to showcase the full surface.

6. **Claude API defaults:** model `claude-opus-4-7`, `thinking={"type": "adaptive"}`, prompt caching on the stable system prompt, structured outputs via `messages.parse()` with a Pydantic `ColumnAssessment` model. Deterministic sampling (first N rows, not random) so cache prefix stays stable.

## File layout

```
excel-detector/
├── app.py                          # Streamlit entry — st.navigation + landing
├── pages/
│   ├── overview.py                 # Trust score + KPIs + top criticals
│   ├── issues.py                   # Filterable list + CSV export
│   ├── timeseries.py               # Plotly chart per series
│   ├── ai_insights.py              # Claude semantic findings
│   └── schema.py                   # Pandera schema script per sheet
├── src/excel_detector/
│   ├── parser.py                   # Dual openpyxl + header detection
│   ├── analyzer.py                 # Orchestrates the detector stack
│   ├── scoring.py                  # Trust score (0–100) + grade
│   ├── detectors/
│   │   ├── base.py                 # Severity, Finding, Detector Protocol
│   │   ├── structural.py           # Hidden sheets, merged cells, formula errors
│   │   ├── statistical.py          # Type purity, regex coverage, null density
│   │   ├── duplicates.py           # Exact + fuzzy (rapidfuzz)
│   │   ├── timeseries.py           # STUMPY + rolling z-score ensemble
│   │   └── ai.py                   # Claude semantic checks
│   └── ui/                         # Streamlit-only — discarded in production
├── samples/generate_sample.py      # Builds the broken demo file
├── context/                        # Deep project context (read for full history)
├── requirements.txt
├── .streamlit/{config.toml, secrets.toml.example}
└── CLAUDE.md                       # This file
```

## How to run

```powershell
conda activate excel-detector
python samples\generate_sample.py     # generates the demo workbook
streamlit run app.py                  # http://localhost:8501
```

## Conventions

- Follow existing module structure when adding detectors. Lift the same patterns: module-level constants for thresholds, `_helper` functions, one public class with `name` and `run()`.
- Severity policy: `CRITICAL` for breaks-the-pipeline issues, `WARNING` for likely-wrong-or-suspicious, `INFO` for FYI.
- Always populate `Finding.suggested_fix` — that's the difference between "report" and "useful report."
- For chart data the UI needs, stash it in `Finding.metadata` (used by the time-series detector to ship date/value arrays through to the page).

## Where to find more

`context/project-context.md` is the live, evolving document — read it for full history, decision log, current progress, and the production migration plan. Update it at the end of any non-trivial work session so the next Claude session can pick up cold.
