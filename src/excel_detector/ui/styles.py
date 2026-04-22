"""Global CSS. Import `inject_css()` once at the top of every page."""

from __future__ import annotations

import streamlit as st

_CSS = """
<style>
/* Tighten the default Streamlit spacing */
.block-container { padding-top: 2rem; padding-bottom: 3rem; }

/* Severity badges */
.ed-badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: white;
    text-transform: uppercase;
}
.ed-badge-critical { background-color: #DC2626; }
.ed-badge-warning  { background-color: #F59E0B; }
.ed-badge-info     { background-color: #0EA5E9; }

/* Finding card */
.ed-finding {
    border: 1px solid #E2E8F0;
    border-left-width: 4px;
    border-radius: 8px;
    padding: 14px 18px;
    margin-bottom: 12px;
    background: #FFFFFF;
}
.ed-finding-critical { border-left-color: #DC2626; }
.ed-finding-warning  { border-left-color: #F59E0B; }
.ed-finding-info     { border-left-color: #0EA5E9; }
.ed-finding h4 { margin: 0 0 6px 0; font-size: 0.95rem; font-weight: 600; color: #0F172A; }
.ed-finding p  { margin: 4px 0; color: #334155; font-size: 0.9rem; }
.ed-finding .ed-meta { color: #64748B; font-size: 0.8rem; }
.ed-finding .ed-fix  { color: #065F46; font-size: 0.85rem; font-style: italic; }

/* Trust-score hero */
.ed-trust-hero {
    text-align: center;
    padding: 28px;
    border-radius: 14px;
    background: linear-gradient(135deg, #EFF6FF 0%, #F1F5F9 100%);
    border: 1px solid #DBEAFE;
}
.ed-trust-hero .score { font-size: 4.5rem; font-weight: 700; line-height: 1; color: #1E40AF; }
.ed-trust-hero .grade { font-size: 1.5rem; font-weight: 600; color: #475569; margin-top: 4px; }
.ed-trust-hero .label { font-size: 0.85rem; color: #64748B; text-transform: uppercase; letter-spacing: 0.08em; }

/* Landing hero */
.ed-hero {
    text-align: center;
    padding: 24px 16px 8px;
}
.ed-hero h1 { font-size: 2.4rem; margin-bottom: 6px; color: #0F172A; }
.ed-hero .tagline { color: #475569; font-size: 1.05rem; }

/* Sample card row */
.ed-sample-card {
    border: 1px solid #E2E8F0;
    border-radius: 10px;
    padding: 14px 16px;
    background: #FFFFFF;
    height: 100%;
}
.ed-sample-card h4 { margin: 0 0 6px 0; font-size: 1rem; }
.ed-sample-card p  { color: #475569; font-size: 0.85rem; margin: 0 0 8px 0; }
</style>
"""


def inject_css() -> None:
    st.markdown(_CSS, unsafe_allow_html=True)
