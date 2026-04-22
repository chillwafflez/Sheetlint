# Excel Detector

Pre-handoff data quality inspector for messy, human-entered Excel files. Catches structural, statistical, semantic, and time-series anomalies before files reach an ingestion pipeline or a downstream consumer.

## Who it's for

- **Domain workers** (insurance agents, finance analysts, mortgage processors) who prepare Excel files and want to clean them before handing off.
- **Data engineers / analysts** who receive those files and need a schema + issue report so they can push back on specific problems.

## What it detects

| Category | Examples |
|---|---|
| **Structural** | Merged cells in data rows, mid-sheet header shifts, hidden sheets, formula errors (`#REF!`, `#N/A`), empty rows/cols |
| **Statistical** | Type purity (97% numeric, 3% strings in rows 103–200), regex pattern coverage, null density |
| **Duplicates** | Exact duplicate rows, fuzzy near-duplicates (`"Californa"` vs `"California"`) |
| **Time-series** | STUMPY matrix-profile discords + rolling z-score ensemble for spikes and unusual patterns |
| **Semantic (AI)** | Column-name-vs-content mismatch, entity-type drift, cross-column logical checks |

## Setup (Anaconda on Windows)

```powershell
# 1. Create and activate a conda env
conda create -n excel-detector python=3.13 -y
conda activate excel-detector

# 2. Install dependencies with pip
pip install -r requirements.txt

# 3. Add your Anthropic API key (optional — only needed for the AI layer)
copy .streamlit\secrets.toml.example .streamlit\secrets.toml
# edit .streamlit\secrets.toml and paste your key

# 4. Generate the broken sample file used by the demo landing screen
python samples\generate_sample.py

# 5. Run the app
streamlit run app.py
```

Then open the URL Streamlit prints (usually <http://localhost:8501>).

## Project structure

```
excel-detector/
├── app.py                        # Streamlit entry — st.navigation + landing screen
├── pages/                        # Multipage app (Overview / Issues / Time-series / AI / Schema)
├── src/excel_detector/
│   ├── parser.py                 # openpyxl + pandas wrapper
│   ├── detectors/
│   │   ├── base.py               # Detector Protocol, Finding, Severity
│   │   ├── structural.py
│   │   ├── statistical.py
│   │   ├── duplicates.py
│   │   ├── timeseries.py         # STUMPY + rolling z-score
│   │   └── ai.py                 # Claude semantic checks (prompt-cached)
│   ├── scoring.py                # Data trust score
│   └── ui/                       # Severity badges, KPI cards, finding cards
├── samples/generate_sample.py    # Builds the demo broken file
├── requirements.txt
└── .streamlit/config.toml        # Theme
```

## Extending with new detectors

Every detector implements the same protocol:

```python
class Detector(Protocol):
    name: str
    def run(self, doc: ExcelDocument) -> list[Finding]: ...
```

Drop a new file in `src/excel_detector/detectors/`, register it in `detectors/__init__.py`, and it shows up in the report automatically.

## Notes

- The AI detector uses `claude-opus-4-7` with adaptive thinking and prompt caching on the system prompt. One LLM call per column, with the system prompt cached across calls to keep costs predictable.
- STUMPY needs ≥ ~50 points in a time series to be meaningful. Shorter series fall back to rolling z-score.
- Only `.xlsx` is supported in the prototype. `.xls`, `.csv`, and `.xlsm` can be added by extending `parser.py`.
