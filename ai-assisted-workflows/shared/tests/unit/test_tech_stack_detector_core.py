#!/usr/bin/env python3

from pathlib import Path

import pytest
from core.utils.tech_stack_detector import TechStackDetector


def test_detect_node_stack_with_package_json(tmp_path: Path):
    (tmp_path / "package.json").write_text("{}", encoding="utf-8")
    detector = TechStackDetector.from_config(
        Path("shared/config/tech_stacks/tech_stacks.json").resolve()
    )
    detected = detector.detect_tech_stack(str(tmp_path))
    assert "node_js" in detected
    exclusions = detector.get_simple_exclusions(str(tmp_path))
    assert "node_modules" in exclusions["directories"] or any(
        "node_modules" in d for d in exclusions["directories"]
    )


def test_detect_multiple_stacks_and_exclusions(
    tmp_path: Path, tech_stacks_config_path: Path
):
    # Create config files to trigger many stacks at once
    (tmp_path / "package.json").write_text("{}", encoding="utf-8")
    (tmp_path / "app.json").write_text("{}", encoding="utf-8")
    (tmp_path / "pyproject.toml").write_text("[tool.poetry]", encoding="utf-8")
    (tmp_path / "pom.xml").write_text("<project/>", encoding="utf-8")
    (tmp_path / "build.gradle").write_text("plugins{}", encoding="utf-8")
    (tmp_path / "proj.csproj").write_text("<Project/>", encoding="utf-8")
    (tmp_path / "go.mod").write_text("module x", encoding="utf-8")
    (tmp_path / "Cargo.toml").write_text("[package]", encoding="utf-8")
    (tmp_path / "composer.json").write_text("{}", encoding="utf-8")
    (tmp_path / "Gemfile").write_text("source 'https://rubygems.org'", encoding="utf-8")
    (tmp_path / "CMakeLists.txt").write_text("project(X)", encoding="utf-8")
    (tmp_path / "Package.swift").write_text("// swift-package", encoding="utf-8")
    (tmp_path / "build.gradle.kts").write_text("plugins{}", encoding="utf-8")

    detector = TechStackDetector.from_config(tech_stacks_config_path)
    stacks = set(detector.detect_tech_stack(str(tmp_path)))
    for key in [
        "node_js",
        "react_native_expo",
        "python",
        "java_maven",
        "java_gradle",
        "dotnet",
        "go",
        "rust",
        "php",
        "ruby",
        "cpp",
        "swift",
        "kotlin",
    ]:
        assert key in stacks

    excl = detector.get_simple_exclusions(str(tmp_path))
    assert "node_modules" in excl["directories"]
    assert "target" in excl["directories"] or "build" in excl["directories"]
    assert ".dll" in excl["extensions"] or ".class" in excl["extensions"]


def test_file_exists_pattern_glob_match(tmp_path: Path, tech_stacks_config_path: Path):
    (tmp_path / "src").mkdir(parents=True, exist_ok=True)
    (tmp_path / "src" / "a.py").write_text("print('x')\n", encoding="utf-8")
    det = TechStackDetector.from_config(tech_stacks_config_path)
    assert det._file_exists_pattern(tmp_path, "src/*.py") is True  # type: ignore[attr-defined]


def test_exclusions_extensions_per_stack_java_and_dotnet(
    tmp_path: Path, tech_stacks_config_path: Path
):
    (tmp_path / "pom.xml").write_text("<project/>", encoding="utf-8")
    (tmp_path / "proj.csproj").write_text("<Project/>", encoding="utf-8")
    det = TechStackDetector.from_config(tech_stacks_config_path)
    excl = det.get_simple_exclusions(str(tmp_path))
    assert any(ext in excl["extensions"] for ext in [".class", ".jar"])  # Java
    assert any(ext in excl["extensions"] for ext in [".dll", ".exe"])  # .NET


def test_is_generated_or_vendor_code_copyright(
    tmp_path: Path, tech_stacks_config_path: Path
):
    f = tmp_path / "vendor.js"
    f.write_text("/* Copyright 2024 */\n", encoding="utf-8")
    det = TechStackDetector.from_config(tech_stacks_config_path)
    assert det._is_generated_or_vendor_code(str(f)) is True  # type: ignore[attr-defined]


def test_should_analyze_vendor_marker_inside_src_is_allowed(
    tmp_path: Path, tech_stacks_config_path: Path
):
    f = tmp_path / "src" / "app.js"
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text("// jquery component\n", encoding="utf-8")
    det = TechStackDetector.from_config(tech_stacks_config_path)
    assert det.should_analyze_file(str(f), str(tmp_path)) is True


def test_get_simple_exclusions_swift_kotlin_cpp(
    tmp_path: Path, tech_stacks_config_path: Path
):
    (tmp_path / "Package.swift").write_text("// swift\n", encoding="utf-8")
    (tmp_path / "build.gradle.kts").write_text("plugins{}\n", encoding="utf-8")
    (tmp_path / "CMakeLists.txt").write_text("project(X)\n", encoding="utf-8")
    det = TechStackDetector.from_config(tech_stacks_config_path)
    excl = det.get_simple_exclusions(str(tmp_path))
    assert any(
        d in excl["directories"] for d in [".build", "build", "DerivedData"]
    )  # swift
    assert any(
        d in excl["directories"] for d in ["build", ".gradle", ".idea"]
    )  # kotlin
    assert any(
        d in excl["directories"]
        for d in ["cmake-build-debug", "cmake-build-release", "build"]
    )


def test_detector_init_bad_config_raises(tmp_path: Path):
    bad = tmp_path / "bad.json"
    bad.write_text('{\n  "schema_version": 1\n}\n', encoding="utf-8")
    with pytest.raises(RuntimeError):
        TechStackDetector.from_config(bad)


def test_should_analyze_file_excluded_filename_and_extension(
    tmp_path: Path, tech_stacks_config_path: Path
):
    det = TechStackDetector.from_config(tech_stacks_config_path)
    envf = tmp_path / ".env"
    envf.write_text("A=1\n", encoding="utf-8")
    assert det.should_analyze_file(str(envf), str(tmp_path)) is False
    logf = tmp_path / "a.log"
    logf.write_text("x\n", encoding="utf-8")
    assert det.should_analyze_file(str(logf), str(tmp_path)) is False


def test_is_generated_and_minified_detection(
    tmp_path: Path, tech_stacks_config_path: Path
):
    det = TechStackDetector.from_config(tech_stacks_config_path)
    gen = tmp_path / "gen.js"
    gen.write_text("/* This file is auto-generated */\n", encoding="utf-8")
    assert det._is_generated_or_vendor_code(str(gen)) is True  # type: ignore[attr-defined]
    mini = tmp_path / "min.js"
    mini.write_text("x" * 600 + "\n", encoding="utf-8")
    assert det._is_generated_or_vendor_code(str(mini)) is True  # type: ignore[attr-defined]


def test_is_generated_or_vendor_code_missing_file(
    tmp_path: Path, tech_stacks_config_path: Path
):
    det = TechStackDetector.from_config(tech_stacks_config_path)
    assert det._is_generated_or_vendor_code(str(tmp_path / "nope.js")) is False  # type: ignore[attr-defined]
