"""Streamlit entry point.

Run with: `streamlit run app.py`

Architecture:
- app.py owns the file uploader and runs the analysis. The result is stored in
  st.session_state["analysis_result"] (and the parsed doc in "doc").
- Pages under pages/ read from session state. Each page calls require_analysis()
  to gracefully handle the no-file-yet state.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Make `src` importable without requiring `pip install -e .`
ROOT = Path(__file__).parent
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

import streamlit as st

from excel_detector.analyzer import analyze
from excel_detector.ui.components import landing_hero, sample_card
from excel_detector.ui.styles import inject_css


def home_page() -> None:
    inject_css()
    landing_hero()

    with st.container():
        col_left, col_right = st.columns([3, 2], gap="large")

        with col_left:
            st.markdown("### Upload a file")
            uploaded = st.file_uploader(
                "Drop an .xlsx file to inspect",
                type=["xlsx"],
                accept_multiple_files=False,
                label_visibility="collapsed",
            )

            enable_ai = st.toggle(
                "Enable AI semantic checks (requires Anthropic API key)",
                value=True,
                help="Each column is sent to Claude for entity-type and naming checks. Disable to skip the API call.",
            )

            if uploaded is not None:
                _run_and_route(uploaded.read(), uploaded.name, enable_ai=enable_ai)

        with col_right:
            st.markdown("### Or try a sample")
            st.caption("Pre-built broken file demonstrating every detector.")
            sample_path = ROOT / "samples" / "broken_insurance_submissions.xlsx"
            if sample_path.exists():
                if sample_card(
                    "Insurance submissions (broken)",
                    "Mid-sheet header, currency-as-text, type drift, fuzzy duplicates, time-series spike, formula error, and a hidden sheet.",
                    button_key="sample_insurance",
                ):
                    _run_and_route(sample_path.read_bytes(), sample_path.name, enable_ai=enable_ai)
            else:
                st.warning(
                    "Sample not found. Generate it with:\n\n"
                    "`python samples/generate_sample.py`"
                )

    st.divider()
    with st.expander("What this catches", expanded=False):
        st.markdown(
            """
            - **Structural** — merged cells in data rows, formula errors, hidden sheets, mid-sheet headers
            - **Statistical** — type drift, regex pattern coverage, null density
            - **Duplicates** — exact + fuzzy near-duplicates (rapidfuzz)
            - **Time-series** — STUMPY matrix-profile discords + rolling z-score ensemble
            - **AI semantic** — column-name-vs-content mismatch via Claude
            """
        )


def _run_and_route(file_bytes: bytes, filename: str, *, enable_ai: bool) -> None:
    """Run analysis, stash in session state, route to Overview."""
    with st.spinner(f"Inspecting {filename}…"):
        try:
            doc, result = analyze(file_bytes, filename=filename, enable_ai=enable_ai)
        except Exception as exc:
            st.error(f"Failed to parse file: {exc}")
            return
    st.session_state["doc"] = doc
    st.session_state["analysis_result"] = result
    st.session_state["filename"] = filename
    st.success(f"Inspection complete. {len(result.findings)} findings — see the Overview tab.")
    st.balloons()


# --- Multipage navigation ---
home = st.Page(home_page, title="Home", icon=":material/home:", default=True)
overview = st.Page("pages/overview.py", title="Overview", icon=":material/dashboard:")
issues = st.Page("pages/issues.py", title="Issues", icon=":material/list_alt:")
timeseries = st.Page("pages/timeseries.py", title="Time-series", icon=":material/show_chart:")
ai_insights = st.Page("pages/ai_insights.py", title="AI insights", icon=":material/psychology:")
schema = st.Page("pages/schema.py", title="Schema", icon=":material/schema:")

st.set_page_config(
    page_title="Excel Detector",
    page_icon=":material/fact_check:",
    layout="wide",
    initial_sidebar_state="expanded",
)

pg = st.navigation(
    {
        "Start": [home],
        "Report": [overview, issues, timeseries, ai_insights, schema],
    }
)
pg.run()
