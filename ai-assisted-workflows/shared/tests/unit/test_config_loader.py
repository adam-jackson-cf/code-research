#!/usr/bin/env python3

import json
from pathlib import Path

import pytest
from core.config.loader import (
    ConfigError,
    load_architectural_pattern_sets,
    load_json_config,
    load_tech_stacks,
)


def test_load_architectural_pattern_sets_success():
    config_dir = Path("shared/config/patterns").resolve()
    cfg = load_architectural_pattern_sets(config_dir)
    assert "architectural_patterns" in cfg
    assert "antipatterns" in cfg
    assert "language_features" in cfg
    assert isinstance(cfg["architectural_patterns"], dict)
    assert isinstance(cfg["antipatterns"], dict)
    assert isinstance(cfg["language_features"], dict)


def test_load_architectural_pattern_sets_missing_files_raises(tmp_path: Path):
    # Create only one required file with minimal valid content; others missing
    (tmp_path / "architectural_patterns.json").write_text(
        json.dumps({"schema_version": 1, "patterns": {}}), encoding="utf-8"
    )
    with pytest.raises(ConfigError):
        load_architectural_pattern_sets(tmp_path)


def test_load_json_config_missing_and_invalid(tmp_path: Path):
    missing = tmp_path / "nope.json"
    with pytest.raises(ConfigError):
        load_json_config(missing, ["x"])  # type: ignore[arg-type]

    bad = tmp_path / "bad.json"
    bad.write_text("{not-json}", encoding="utf-8")
    with pytest.raises(ConfigError):
        load_json_config(bad, ["x"])  # type: ignore[arg-type]


def test_load_tech_stacks_shape_errors(tmp_path: Path):
    f = tmp_path / "stacks.json"
    f.write_text(json.dumps({"schema_version": 1}), encoding="utf-8")
    with pytest.raises(ConfigError):
        load_tech_stacks(f)

    f.write_text(json.dumps({"schema_version": 1, "stacks": []}), encoding="utf-8")
    with pytest.raises(ConfigError):
        load_tech_stacks(f)

    f.write_text(
        json.dumps({"schema_version": 1, "stacks": {"py": {"name": "x"}}}),
        encoding="utf-8",
    )
    with pytest.raises(ConfigError):
        load_tech_stacks(f)

    f.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "stacks": {
                    "py": {
                        "name": "Python",
                        "primary_languages": "python",
                        "exclude_patterns": [],
                        "dependency_dirs": [],
                        "config_files": [],
                        "source_patterns": [],
                        "build_artifacts": [],
                    }
                },
            }
        ),
        encoding="utf-8",
    )
    with pytest.raises(ConfigError):
        load_tech_stacks(f)


def test_load_arch_patterns_happy_path(patterns_config_dir: Path):
    data = load_architectural_pattern_sets(patterns_config_dir)
    assert set(data.keys()) == {
        "architectural_patterns",
        "antipatterns",
        "language_features",
    }
    assert "singleton" in data["architectural_patterns"]
    assert "god_class" in data["antipatterns"]
    assert "decorators" in data["language_features"]


def test_load_tech_stacks_happy_path(tech_stacks_config_path: Path):
    stacks = load_tech_stacks(tech_stacks_config_path)
    for key in ["python", "node_js", "java_maven"]:
        assert key in stacks
        spec = stacks[key]
        for req in [
            "name",
            "primary_languages",
            "exclude_patterns",
            "dependency_dirs",
            "config_files",
            "source_patterns",
            "build_artifacts",
        ]:
            assert req in spec
