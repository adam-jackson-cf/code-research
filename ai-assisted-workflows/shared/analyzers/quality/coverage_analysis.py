#!/usr/bin/env python3
"""
Language-agnostic test coverage analysis script.

Analyzes test coverage across multiple programming languages and frameworks.

Converted to use BaseAnalyzer infrastructure for standardized CLI, file scanning,
error handling, and result formatting patterns.
"""

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

# Import base analyzer (package root must be on PYTHONPATH)
from core.base.analyzer_base import AnalyzerConfig, BaseAnalyzer
from core.base.analyzer_registry import register_analyzer

_COVERAGE_CONFIG_DIR = Path(__file__).resolve().parents[2] / "config" / "coverage"
_LANGUAGE_CONFIG_PATH = _COVERAGE_CONFIG_DIR / "languages.json"
_INDICATORS_PATH = _COVERAGE_CONFIG_DIR / "indicators.json"
_LANGUAGE_CONFIG_VERSION = 1
_INDICATOR_CONFIG_VERSION = 1
_REQUIRED_LANGUAGE_KEYS = {
    "extensions",
    "test_patterns",
    "source_patterns",
    "coverage_tools",
    "coverage_files",
    "exclude_dirs",
}


class CoverageConfigError(RuntimeError):
    """Raised when coverage analyzer configuration is invalid."""


@lru_cache(maxsize=1)
def _load_language_config_bundle() -> tuple[dict[str, dict[str, Any]], dict[str, str]]:
    """Load and validate coverage language configuration.

    Returns a tuple of (language_configs_without_extensions, extension_map).
    """
    try:
        raw_data = json.loads(_LANGUAGE_CONFIG_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:  # pragma: no cover - configuration must exist
        raise CoverageConfigError(
            f"Coverage language config not found: {_LANGUAGE_CONFIG_PATH}"
        ) from exc

    if not isinstance(raw_data, dict):
        raise CoverageConfigError("Coverage language config must be a JSON object")

    if raw_data.get("schema_version") != _LANGUAGE_CONFIG_VERSION:
        raise CoverageConfigError(
            "Unsupported coverage language config version:"
            f" {raw_data.get('schema_version')}"
        )

    languages = raw_data.get("languages")
    if not isinstance(languages, dict):
        raise CoverageConfigError(
            "Coverage language config must provide a 'languages' mapping"
        )

    normalized: dict[str, dict[str, Any]] = {}
    extension_map: dict[str, str] = {}

    for language, spec in languages.items():
        if not isinstance(language, str):
            raise CoverageConfigError("Language keys must be strings")
        if not isinstance(spec, dict):
            raise CoverageConfigError(f"Config for {language} must be a JSON object")

        missing = _REQUIRED_LANGUAGE_KEYS - set(spec)
        if missing:
            raise CoverageConfigError(
                f"Config for {language} missing keys: {', '.join(sorted(missing))}"
            )

        for key in _REQUIRED_LANGUAGE_KEYS:
            values = spec[key]
            if not isinstance(values, list) or not all(
                isinstance(item, str) for item in values
            ):
                raise CoverageConfigError(
                    f"Config list '{key}' for {language} must contain strings"
                )

        for extension in spec["extensions"]:
            ext_lower = extension.lower()
            if not ext_lower.startswith("."):
                raise CoverageConfigError(
                    f"Extension '{extension}' for {language} must start with '.'"
                )
            if ext_lower in extension_map and extension_map[ext_lower] != language:
                raise CoverageConfigError(
                    f"Extension '{extension}' mapped to multiple languages"
                )
            extension_map[ext_lower] = language

        normalized[language] = {
            key: list(spec[key]) for key in spec if key != "extensions"
        }

    return normalized, extension_map


@lru_cache(maxsize=1)
def _load_generic_indicators() -> list[str]:
    """Load generic coverage indicators as a list of strings."""
    try:
        indicators_raw = json.loads(_INDICATORS_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:  # pragma: no cover - configuration must exist
        raise CoverageConfigError(
            f"Coverage indicators config not found: {_INDICATORS_PATH}"
        ) from exc

    if not isinstance(indicators_raw, dict):
        raise CoverageConfigError("Coverage indicators config must be a JSON object")

    if indicators_raw.get("schema_version") != _INDICATOR_CONFIG_VERSION:
        raise CoverageConfigError(
            "Unsupported coverage indicator config version:"
            f" {indicators_raw.get('schema_version')}"
        )

    indicators = indicators_raw.get("indicators")
    if not isinstance(indicators, list) or not all(
        isinstance(item, str) for item in indicators
    ):
        raise CoverageConfigError("Indicators config must be a JSON array of strings")

    return list(indicators)


@register_analyzer("quality:coverage")
class TestCoverageAnalyzer(BaseAnalyzer):
    """Language-agnostic test coverage analyzer extending BaseAnalyzer infrastructure."""

    def __init__(self, config: AnalyzerConfig | None = None):
        super().__init__("test_coverage", config)

        language_configs, extension_map = _load_language_config_bundle()
        self.language_configs = language_configs
        self.extension_map = extension_map

        # Language-agnostic generic indicators
        self.generic_test_indicators = _load_generic_indicators()

    def analyze_target(self, target_path: str) -> list[dict[str, Any]]:
        """
        Analyze a single file for coverage patterns - called by BaseAnalyzer for each file.

        Args:
            target_path: Single file path to analyze

        Returns
        -------
            List of coverage analysis findings for this specific file
        """
        target = Path(target_path)

        if not target.is_file():
            return []

        # Since BaseAnalyzer calls this for individual files, we need to analyze
        # at the directory level to get meaningful coverage ratios
        # Check if this is a source or test file and categorize

        findings = []
        file_type = self.categorize_file(target)

        if file_type:
            # For each file, we generate a finding about its role in coverage
            finding = {
                "finding_id": f"FILE_CATEGORY_{file_type['language'].upper()}",
                "title": f"{file_type['language'].title()} {file_type['type'].title()} File",
                "description": f"File categorized as {file_type['type']} file for {file_type['language']}",
                "severity": "info",
                "file_path": str(target),
                "line_number": 1,
                "recommendation": f"Ensure {file_type['type']} files follow {file_type['language']} best practices for coverage analysis",
                "evidence": {
                    "file_type": file_type["type"],
                    "language": file_type["language"],
                    "patterns_matched": file_type.get("patterns_matched", []),
                },
            }
            findings.append(finding)

        return findings

    def categorize_file(self, file_path: Path) -> dict[str, Any] | None:
        """Categorize a file as test or source for a specific language."""
        suffix = file_path.suffix.lower()
        language = self.extension_map.get(suffix)

        if not language:
            return None

        config = self.language_configs.get(language, {})

        # Check test patterns first
        test_patterns = config.get("test_patterns", [])
        for pattern in test_patterns:
            if re.search(pattern, str(file_path)):
                return {
                    "language": language,
                    "type": "test",
                    "patterns_matched": [pattern],
                }

        # Check source patterns
        source_patterns = config.get("source_patterns", [])
        for pattern in source_patterns:
            if re.search(pattern, str(file_path)):
                return {
                    "language": language,
                    "type": "source",
                    "patterns_matched": [pattern],
                }

        return None

    def get_analyzer_metadata(self) -> dict[str, Any]:
        """Get coverage analyzer-specific metadata."""
        return {
            "analyzer_name": "TestCoverageAnalyzer",
            "analyzer_version": "2.0.0",
            "analysis_type": "test_coverage",
            "supported_languages": list(self.language_configs.keys()),
            "coverage_tools_supported": [
                tool
                for config in self.language_configs.values()
                for tool in config.get("coverage_tools", [])
            ],
            "description": "Language-agnostic test coverage analysis across multiple programming languages",
        }


if __name__ == "__main__":
    raise SystemExit(0)
