"""Reusable UI primitives.

All rendering helpers — nothing here computes. Business logic belongs in
detectors/ and scoring.py.
"""

from __future__ import annotations

import html

import streamlit as st

from excel_detector.detectors.base import AnalysisResult, Finding, Severity


def severity_badge(severity: Severity) -> str:
    """Return inline HTML for a severity pill — caller passes to st.markdown."""
    return (
        f'<span class="ed-badge ed-badge-{severity.value}">{severity.label}</span>'
    )


def trust_hero(result: AnalysisResult) -> None:
    """Big centered trust score + grade. Use on the Overview page."""
    grade = result.score_breakdown.get("_grade", "") if result.score_breakdown else ""
    st.markdown(
        f"""
        <div class="ed-trust-hero">
            <div class="label">Data Trust Score</div>
            <div class="score">{int(result.trust_score)}</div>
            <div class="grade">Grade {grade}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def severity_kpi_row(result: AnalysisResult) -> None:
    by_sev = result.score_breakdown.get("_by_severity", {}) if result.score_breakdown else {}
    if not isinstance(by_sev, dict):
        by_sev = {}
    cols = st.columns(3)
    cols[0].metric("Critical", by_sev.get("critical", 0))
    cols[1].metric("Warnings", by_sev.get("warning", 0))
    cols[2].metric("Info", by_sev.get("info", 0))


def finding_card(finding: Finding) -> None:
    """Render one finding as a styled card."""
    sev = finding.severity.value
    column_tag = f" · Column <code>{html.escape(str(finding.column))}</code>" if finding.column else ""
    rows_tag = f" · Rows affected: <b>{finding.row_count}</b>" if finding.rows else ""
    fix_html = (
        f'<p class="ed-fix">Fix: {html.escape(finding.suggested_fix)}</p>'
        if finding.suggested_fix else ""
    )
    st.markdown(
        f"""
        <div class="ed-finding ed-finding-{sev}">
            <h4>{severity_badge(finding.severity)} &nbsp; {html.escape(finding.message)}</h4>
            <p class="ed-meta">Detector: <b>{finding.detector}</b> · Sheet: <code>{html.escape(finding.sheet)}</code>{column_tag}{rows_tag}</p>
            {fix_html}
        </div>
        """,
        unsafe_allow_html=True,
    )


def landing_hero() -> None:
    st.markdown(
        """
        <div class="ed-hero">
            <h1>Excel Detector</h1>
            <p class="tagline">Catch data issues before they become pipeline failures, compliance risks, or bad decisions.</p>
        </div>
        """,
        unsafe_allow_html=True,
    )


def sample_card(title: str, description: str, button_key: str, on_click_label: str = "Load sample") -> bool:
    """Render a sample-file card. Returns True if the button was clicked."""
    st.markdown(
        f"""
        <div class="ed-sample-card">
            <h4>{html.escape(title)}</h4>
            <p>{html.escape(description)}</p>
        </div>
        """,
        unsafe_allow_html=True,
    )
    return st.button(on_click_label, key=button_key, width="stretch")


def require_analysis() -> AnalysisResult | None:
    """Pages call this first. If no file has been analyzed yet, shows a gate message."""
    result: AnalysisResult | None = st.session_state.get("analysis_result")
    if result is None:
        st.info("Upload a file on the Home page to see results here.")
        if st.button("Go to Home"):
            st.switch_page("app.py")
        return None
    return result
