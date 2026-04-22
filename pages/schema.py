"""Schema page — inferred Pandera schema as copy-paste-ready Python.

Useful for the data-engineer persona: take the schema, drop into a pipeline,
and get programmatic validation against future files of the same shape.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

import pandas as pd
import pandera.pandas as pa
import streamlit as st

from excel_detector.ui.components import require_analysis
from excel_detector.ui.styles import inject_css

inject_css()
st.title("Inferred schema")
st.caption(
    "A Pandera schema inferred per sheet. Drop into your pipeline to enforce the same "
    "structure on future files."
)

result = require_analysis()
if result is None:
    st.stop()

doc = st.session_state.get("doc")
if doc is None:
    st.info("Re-analyze the file to generate schemas.")
    st.stop()

for sheet in doc.sheets:
    if sheet.df.empty:
        continue
    st.subheader(f"Sheet: {sheet.name}")
    try:
        schema = pa.infer_schema(sheet.df)
        script = schema.to_script()
    except Exception as exc:
        st.error(f"Could not infer schema for '{sheet.name}': {exc}")
        continue

    st.code(script, language="python")
    st.download_button(
        f"Download schema_{sheet.name}.py",
        data=script,
        file_name=f"schema_{sheet.name}.py",
        mime="text/x-python",
        key=f"dl_{sheet.name}",
    )
    st.divider()
