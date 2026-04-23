"""Detector registry.

Every detector has a stable `DetectorId` and a factory. `build_detectors`
instantiates an arbitrary subset — the mechanism the API uses to honor a
client's selection in `AnalysisConfig`. `default_detectors` is the shortcut
for callers (scripts, tests, the initial sample generator) that want the
whole stack.

Add a new detector by:
    1. Creating its class under `detectors/` with `name` + `run`.
    2. Adding a `DetectorId` entry in `analysis/schemas.py`.
    3. Registering its factory below.
    4. Seeding a trigger in `samples/generate_sample.py`.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable

from sheetlint.analysis.detectors.ai import AIDetector
from sheetlint.analysis.detectors.base import Detector
from sheetlint.analysis.detectors.duplicates import DuplicatesDetector
from sheetlint.analysis.detectors.statistical import StatisticalDetector
from sheetlint.analysis.detectors.structural import StructuralDetector
from sheetlint.analysis.detectors.timeseries import TimeSeriesDetector
from sheetlint.analysis.schemas import DetectorId

# Detector ids whose factories don't need the Anthropic key — used by
# `default_detectors` when `enable_ai=False`.
_NON_AI_IDS: tuple[DetectorId, ...] = (
    DetectorId.STRUCTURAL,
    DetectorId.STATISTICAL,
    DetectorId.DUPLICATES,
    DetectorId.TIMESERIES,
)

_FACTORIES: dict[DetectorId, Callable[..., Detector]] = {
    DetectorId.STRUCTURAL: lambda **_: StructuralDetector(),
    DetectorId.STATISTICAL: lambda **_: StatisticalDetector(),
    DetectorId.DUPLICATES: lambda **_: DuplicatesDetector(),
    DetectorId.TIMESERIES: lambda **_: TimeSeriesDetector(),
    DetectorId.AI: lambda **kwargs: AIDetector(api_key=kwargs.get("api_key")),
}


def build_detectors(
    ids: Iterable[DetectorId],
    *,
    api_key: str | None = None,
) -> list[Detector]:
    """Instantiate the detectors corresponding to `ids`, in the given order.

    Unknown ids are rejected by Pydantic before this runs (DetectorId is a
    StrEnum in the request schema), so a KeyError here would indicate a
    registry that's out of sync with the enum — treat it as a bug.
    """
    return [_FACTORIES[detector_id](api_key=api_key) for detector_id in ids]


def default_detectors(
    *,
    enable_ai: bool = True,
    api_key: str | None = None,
) -> list[Detector]:
    """The full detector stack in display order.

    The AI detector is optional. If `enable_ai` is True but `api_key` is
    None, the AI detector is still appended but becomes a no-op at run time.
    """
    ids: list[DetectorId] = list(_NON_AI_IDS)
    if enable_ai:
        ids.append(DetectorId.AI)
    return build_detectors(ids, api_key=api_key)


__all__ = [
    "AIDetector",
    "Detector",
    "DuplicatesDetector",
    "StatisticalDetector",
    "StructuralDetector",
    "TimeSeriesDetector",
    "build_detectors",
    "default_detectors",
]
