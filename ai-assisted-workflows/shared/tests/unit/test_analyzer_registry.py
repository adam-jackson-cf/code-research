#!/usr/bin/env python3

from typing import Any

import pytest
from core.base.analyzer_base import AnalyzerConfig, BaseAnalyzer
from core.base.analyzer_registry import AnalyzerRegistry, register_analyzer


@register_analyzer("test:dummy")
class DummyAnalyzer(BaseAnalyzer):
    def __init__(self, config: AnalyzerConfig | None = None):
        super().__init__("test", config or AnalyzerConfig())

    def analyze_target(self, target_path: str) -> list[dict[str, Any]]:
        return []

    def get_analyzer_metadata(self) -> dict[str, Any]:
        return {"name": "Dummy"}


def test_registry_get_and_create():
    cls = AnalyzerRegistry.get("test:dummy")
    assert issubclass(cls, BaseAnalyzer)
    inst = AnalyzerRegistry.create("test:dummy")
    assert isinstance(inst, DummyAnalyzer)


# Additional coverage: duplicate handling, missing key, kwargs forwarding
class _DummyAnalyzerA(BaseAnalyzer):
    def __init__(self, config: AnalyzerConfig | None = None):
        super().__init__("dummy_a", config)

    def analyze_target(self, target_path: str):  # pragma: no cover - trivial
        return []

    def get_analyzer_metadata(self):  # pragma: no cover - trivial
        return {"name": "A"}


class _DummyAnalyzerB(BaseAnalyzer):
    def __init__(self, config: AnalyzerConfig | None = None):
        super().__init__("dummy_b", config)

    def analyze_target(self, target_path: str):  # pragma: no cover - trivial
        return []

    def get_analyzer_metadata(self):  # pragma: no cover - trivial
        return {"name": "B"}


def test_registry_duplicate_and_missing_handling():
    AnalyzerRegistry.register("test:dummy-a", _DummyAnalyzerA)
    AnalyzerRegistry.register("test:dummy-a", _DummyAnalyzerA)  # idempotent
    with pytest.raises(ValueError, match="Analyzer already registered"):
        AnalyzerRegistry.register("test:dummy-a", _DummyAnalyzerB)
    with pytest.raises(KeyError):
        AnalyzerRegistry.get("test:does-not-exist")
    inst = AnalyzerRegistry.create("test:dummy-a")
    assert isinstance(inst, _DummyAnalyzerA)
    with pytest.raises(ValueError, match="non-empty string"):
        AnalyzerRegistry.register("", _DummyAnalyzerA)


class _DummyAnalyzerExtra(BaseAnalyzer):
    def __init__(
        self, config: AnalyzerConfig | None = None, *, extra: str | None = None
    ):
        super().__init__("dummy_extra", config)
        self.extra = extra

    def analyze_target(self, target_path: str):  # pragma: no cover - trivial
        return []

    def get_analyzer_metadata(self):  # pragma: no cover - trivial
        return {"name": "dummy_extra", "extra": self.extra}


def test_create_passes_kwargs_through():
    name = "test:dummy-extra-kwargs"
    AnalyzerRegistry.register(name, _DummyAnalyzerExtra)
    inst = AnalyzerRegistry.create(name, extra="value42")
    assert isinstance(inst, _DummyAnalyzerExtra)
    assert inst.extra == "value42"
