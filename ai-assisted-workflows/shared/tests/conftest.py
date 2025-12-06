#!/usr/bin/env python3
"""Pytest configuration: ensure 'shared' is on sys.path for imports like 'from core...'."""

import sys
from pathlib import Path

import pytest

# Ensure imports like 'from core...' resolve when running from repo root
_shared_dir = Path(__file__).resolve().parents[1]
if str(_shared_dir) not in sys.path:
    sys.path.insert(0, str(_shared_dir))


@pytest.fixture(scope="session")
def patterns_config_dir() -> Path:
    return Path(__file__).resolve().parents[1] / "config" / "patterns"


@pytest.fixture(scope="session")
def tech_stacks_config_path() -> Path:
    return (
        Path(__file__).resolve().parents[1]
        / "config"
        / "tech_stacks"
        / "tech_stacks.json"
    )
