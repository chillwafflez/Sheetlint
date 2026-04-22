"""Overview page — trust score hero + KPIs + top critical findings."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

import pandas as pd
import streamlit as st

from excel_detector.detectors.base import Severity
from excel_detector.ui.components import (
    finding_card,
    require_analysis,
    severity_kpi_row,
    trust_hero,
)
from excel_detector.ui.styles import inject_css

inject_css()
st.title("Overview")
st.caption(st.session_state.get("filename", ""))

result = require_analysis()
if result is None:
    st.stop()

# --- Hero row: trust score + KPIs side-by-side
hero_col, kpi_col = st.columns([1, 2])
with hero_col:
    trust_hero(result)
with kpi_col:
    st.markdown("### Findings by severity")
    severity_kpi_row(result)
    st.markdown("### Findings by detector")
    breakdown_view = {
        k: v for k, v in result.score_breakdown.items()
        if not k.startswith("_")
    }
    if breakdown_view:
        st.bar_chart(pd.Series(breakdown_view, name="Points deducted"))
    else:
        st.success("Clean! No issues detected.")

st.divider()

# --- Top critical findings
critical = result.findings_by_severity(Severity.CRITICAL)
if critical:
    st.subheader(f":material/error: {len(critical)} critical issue(s)")
    for f in critical[:5]:
        finding_card(f)
    if len(critical) > 5:
        st.caption(f"+ {len(critical) - 5} more — see the Issues tab for the full list.")
else:
    st.info("No critical issues.")
