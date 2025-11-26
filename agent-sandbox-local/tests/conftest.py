"""Pytest configuration and fixtures."""

import os
import sys
from pathlib import Path

import pytest

# Add sandbox_cli to path so we can import 'src' as a package
sandbox_cli_path = Path(__file__).parent.parent / "sandbox_cli"
sys.path.insert(0, str(sandbox_cli_path))


@pytest.fixture
def workspace_dir(tmp_path):
    """Create temporary workspace directory."""
    workspace = tmp_path / "workspaces"
    workspace.mkdir()
    return workspace


@pytest.fixture
def capture_dir(tmp_path):
    """Create temporary capture directory."""
    capture = tmp_path / "captures"
    capture.mkdir()
    return capture


@pytest.fixture
def orbstack_config(workspace_dir):
    """OrbStack backend configuration."""
    return {
        "image_prefix": "agent-sandbox",
        "workspace_dir": str(workspace_dir),
        "cleanup_workspace": True,
        "resource_limits": {
            "memory": "256m",
            "cpu_period": 100000,
            "cpu_quota": 50000,
        },
    }


@pytest.fixture
def tmux_config(workspace_dir, capture_dir):
    """Tmux backend configuration."""
    return {
        "workspace_dir": str(workspace_dir),
        "capture_dir": str(capture_dir),
        "cleanup_workspace": True,
    }
