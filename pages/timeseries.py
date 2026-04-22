"""Time-series page — Plotly chart per series with anomaly markers."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

import plotly.graph_objects as go
import streamlit as st

from excel_detector.ui.components import require_analysis
from excel_detector.ui.styles import inject_css

inject_css()
st.title("Time-series anomalies")
st.caption(
    "Each chart highlights points flagged by the matrix-profile (STUMPY) detector and the "
    "rolling z-score baseline. Hover for value details."
)

result = require_analysis()
if result is None:
    st.stop()

if not result.anomalies:
    st.info(
        "No time-series columns were detected in this file. Time-series detection requires "
        "a date column paired with a numeric column with at least 20 points."
    )
    st.stop()

for anomaly in result.anomalies:
    md = anomaly.metadata
    dates = md.get("dates", [])
    values = md.get("values", [])
    z_flagged = set(md.get("z_flagged", []))
    mp_flagged = set(md.get("mp_flagged", []))

    st.subheader(anomaly.series_name)
    st.caption(anomaly.explanation)

    fig = go.Figure()
    fig.add_trace(
        go.Scatter(x=dates, y=values, mode="lines", name="Value", line=dict(color="#2563EB", width=1.6))
    )
    if z_flagged:
        fig.add_trace(
            go.Scatter(
                x=[dates[i] for i in z_flagged if i < len(dates)],
                y=[values[i] for i in z_flagged if i < len(values)],
                mode="markers",
                name="Z-score spike",
                marker=dict(color="#F59E0B", size=10, symbol="circle-open", line=dict(width=2)),
            )
        )
    if mp_flagged:
        fig.add_trace(
            go.Scatter(
                x=[dates[i] for i in mp_flagged if i < len(dates)],
                y=[values[i] for i in mp_flagged if i < len(values)],
                mode="markers",
                name="Matrix-profile discord",
                marker=dict(color="#DC2626", size=12, symbol="x", line=dict(width=2)),
            )
        )
    fig.update_layout(
        height=360,
        margin=dict(l=10, r=10, t=10, b=30),
        legend=dict(orientation="h", y=-0.18),
        hovermode="x unified",
    )
    st.plotly_chart(fig, width="stretch", theme="streamlit")
    st.divider()
