"""AI insights page — Claude-driven semantic findings."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

import streamlit as st

from excel_detector.detectors.ai import _get_api_key
from excel_detector.ui.components import finding_card, require_analysis
from excel_detector.ui.styles import inject_css

inject_css()
st.title("AI insights")
st.caption("Semantic checks performed by Claude on column headers and sample contents.")

result = require_analysis()
if result is None:
    st.stop()

ai_findings = [f for f in result.findings if f.detector == "AI"]

if not _get_api_key():
    st.warning(
        "No Anthropic API key configured. Add one to `.streamlit/secrets.toml`:\n\n"
        '```toml\nANTHROPIC_API_KEY = "sk-ant-..."\n```\n\n'
        "Then re-run the analysis from the Home page."
    )
    st.stop()

if not ai_findings:
    st.success("Claude found no semantic issues with column names or contents.")
    st.stop()

st.markdown(f"**{len(ai_findings)} semantic finding(s)** from Claude:")
for f in ai_findings:
    finding_card(f)

st.divider()
st.caption(
    "Note: each column was sent independently with a cached system prompt. "
    "Cache hits (visible in finding metadata) reflect cost savings on repeat columns."
)
