"""Detector Protocol — the extension point.

Any class with `name: str` and `run(doc) -> list[Finding]` can be registered
in `detectors/__init__.py` and will appear in the report automatically.
Detectors must remain free of FastAPI / Streamlit / web-framework imports —
they should be drivable from a script, a worker, or a notebook.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol, runtime_checkable

if TYPE_CHECKING:
    from sheetlint.analysis.parser import ExcelDocument
    from sheetlint.analysis.schemas import Finding


@runtime_checkable
class Detector(Protocol):
    """Every detector implements this shape.

    Keep `run` synchronous and side-effect-free — the orchestrator runs them
    sequentially on a worker thread and expects the same ExcelDocument to be
    safe across calls.
    """

    name: str

    def run(self, doc: ExcelDocument) -> list[Finding]: ...
