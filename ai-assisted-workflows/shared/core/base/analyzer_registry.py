#!/usr/bin/env python3
"""
Lightweight analyzer registry to map names to analyzer classes.

Purpose: Allow orchestration to construct analyzers by name without tight coupling.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from .analyzer_base import AnalyzerConfig, BaseAnalyzer


class AnalyzerRegistry:
    """In-memory registry of analyzer classes keyed by a unique name."""

    _registry: dict[str, type] = {}

    @classmethod
    def register(cls, name: str, analyzer_cls: type) -> None:
        if not name or not isinstance(name, str):
            raise ValueError("Analyzer name must be a non-empty string")
        # Idempotent registration: allow same class to be registered multiple times
        # within the same process (e.g., when packages import submodules and modules
        # are also executed via `python -m package.module`). If a different class is
        # already registered under the same name, raise an error.
        existing = cls._registry.get(name)
        if existing is not None:
            if existing is analyzer_cls:
                return
            raise ValueError(f"Analyzer already registered: {name}")
        cls._registry[name] = analyzer_cls

    @classmethod
    def get(cls, name: str) -> type:
        try:
            return cls._registry[name]
        except KeyError:
            raise KeyError(f"Analyzer not registered: {name}") from None

    @classmethod
    def create(
        cls, name: str, config: AnalyzerConfig | None = None, **kwargs: Any
    ) -> BaseAnalyzer:
        analyzer_cls = cls.get(name)
        # Analyzer classes in this project accept (config: Optional[AnalyzerConfig]) and may take extra kwargs
        return analyzer_cls(config=config, **kwargs)  # type: ignore[call-arg]


def register_analyzer(name: str) -> Callable[[Any], Any]:
    """Class decorator to register an analyzer under a unique name."""

    def _decorator(analyzer_cls: Any) -> Any:
        AnalyzerRegistry.register(name, analyzer_cls)
        return analyzer_cls

    return _decorator
