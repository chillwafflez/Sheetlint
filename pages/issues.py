"""Issues page — full filterable list of every finding."""

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
from excel_detector.ui.components import finding_card, require_analysis
from excel_detector.ui.styles import inject_css

inject_css()
st.title("Issues")
st.caption("Filter and inspect every finding. Use the export below to share with your team.")

result = require_analysis()
if result is None:
    st.stop()

if not result.findings:
    st.success("No issues found.")
    st.stop()

# --- Filters
all_detectors = sorted({f.detector for f in result.findings})
all_sheets = sorted({f.sheet for f in result.findings})

with st.container():
    f_cols = st.columns([2, 2, 2, 1])
    sev_filter = f_cols[0].multiselect(
        "Severity", [s.label for s in Severity], default=[s.label for s in Severity]
    )
    det_filter = f_cols[1].multiselect("Detector", all_detectors, default=all_detectors)
    sheet_filter = f_cols[2].multiselect("Sheet", all_sheets, default=all_sheets)

filtered = [
    f for f in result.findings
    if f.severity.label in sev_filter
    and f.detector in det_filter
    and f.sheet in sheet_filter
]

st.caption(f"Showing {len(filtered)} of {len(result.findings)} findings")

# --- Export
export_df = pd.DataFrame(
    [
        {
            "severity": f.severity.label,
            "detector": f.detector,
            "sheet": f.sheet,
            "column": f.column or "",
            "rows_affected": f.row_count,
            "message": f.message,
            "suggested_fix": f.suggested_fix or "",
        }
        for f in filtered
    ]
)
csv_bytes = export_df.to_csv(index=False).encode("utf-8")
st.download_button(
    "Download as CSV",
    data=csv_bytes,
    file_name=f"{Path(result.filename).stem}_issues.csv",
    mime="text/csv",
)

st.divider()

# --- Render cards in severity order
order = {Severity.CRITICAL: 0, Severity.WARNING: 1, Severity.INFO: 2}
for f in sorted(filtered, key=lambda x: order[x.severity]):
    finding_card(f)
