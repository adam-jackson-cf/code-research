#!/usr/bin/env python3
"""
Lightweight config loader utilities with strict schema checks.

Purpose: Centralize loading/validation of JSON configs for patterns and detectors.
"""

from __future__ import annotations

import json
from collections.abc import Iterable
from pathlib import Path
from typing import Any


class ConfigError(Exception):
    """Raised when configuration files are invalid."""


def _require_keys(obj: dict[str, Any], keys: Iterable[str], ctx: str) -> None:
    missing = [k for k in keys if k not in obj]
    if missing:
        raise ConfigError(f"Missing keys in {ctx}: {missing}")


def load_json_config(path: Path, required_top_keys: Iterable[str]) -> dict[str, Any]:
    """Load a JSON config and validate basic schema fields.

    Required top-level keys must exist. A `schema_version` field is also required.
    """
    if not path.exists():
        raise ConfigError(f"Config file not found: {path}")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise ConfigError(f"Invalid JSON in {path}: {e}") from e

    _require_keys(data, ["schema_version", *required_top_keys], f"{path}")
    return data


def load_architectural_pattern_sets(config_dir: Path) -> dict[str, Any]:
    """Load architectural patterns, antipatterns and language features from config directory.

    Expected files:
      - architectural_patterns.json
      - antipatterns.json
      - language_features.json
    """
    required_item_keys = {"indicators", "severity", "description"}
    required_feature_keys = {"patterns", "languages", "description"}

    arch = load_json_config(
        config_dir / "architectural_patterns.json", ["patterns"]
    )  # type: ignore[assignment]
    anti = load_json_config(config_dir / "antipatterns.json", ["patterns"])  # type: ignore[assignment]
    lang = load_json_config(
        config_dir / "language_features.json", ["features"]
    )  # type: ignore[assignment]

    # Validate item shapes (strict, no fallbacks)
    def _validate_map(map_obj: dict[str, Any], required: set, label: str) -> None:
        for name, spec in map_obj.items():
            if not isinstance(spec, dict):
                raise ConfigError(f"{label} '{name}' must be an object")
            missing = required - set(spec.keys())
            if missing:
                raise ConfigError(f"{label} '{name}' missing keys: {sorted(missing)}")

    _validate_map(arch["patterns"], required_item_keys, "architectural pattern")
    _validate_map(anti["patterns"], required_item_keys, "antipattern")
    _validate_map(lang["features"], required_feature_keys, "language feature")

    return {
        "architectural_patterns": arch["patterns"],
        "antipatterns": anti["patterns"],
        "language_features": lang["features"],
    }


def load_tech_stacks(config_path: Path) -> dict[str, Any]:
    """Load tech stack definitions from a single JSON file.

    Expected shape:
    {
      "schema_version": 1,
      "stacks": {
        "python": {"name": str, "primary_languages": [...], ...}
      }
    }
    """
    data = load_json_config(config_path, ["stacks"])  # type: ignore[assignment]
    stacks = data["stacks"]
    if not isinstance(stacks, dict):
        raise ConfigError("'stacks' must be an object map")
    # Basic shape validation per stack
    required = {
        "name",
        "primary_languages",
        "exclude_patterns",
        "dependency_dirs",
        "config_files",
        "source_patterns",
        "build_artifacts",
    }
    for key, spec in stacks.items():
        if not isinstance(spec, dict):
            raise ConfigError(f"Stack '{key}' must be an object")
        missing = required - set(spec.keys())
        if missing:
            raise ConfigError(f"Stack '{key}' missing keys: {sorted(missing)}")
        # Ensure list fields are lists of strings
        for list_key in [
            "primary_languages",
            "exclude_patterns",
            "dependency_dirs",
            "config_files",
            "source_patterns",
            "build_artifacts",
            "boilerplate_patterns",
        ]:
            if list_key in spec and not isinstance(spec[list_key], list):
                raise ConfigError(
                    f"Stack '{key}.{list_key}' must be a list (found {type(spec[list_key])})"
                )
    return stacks
