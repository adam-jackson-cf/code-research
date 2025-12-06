#!/usr/bin/env python3
"""
Simple Path Resolution System.

Lightweight helpers to work with paths relative to the package root.
Works across all deployment scenarios without mutating sys.path:
- Development environment (shared/)
- Local deployment (.claude/scripts/)
- Global deployment (~/.claude/scripts/)
- Custom deployment (anywhere)

The PACKAGE_ROOT is computed from this file location (parent of utils/).
"""

import sys
from pathlib import Path


def setup_import_paths() -> Path:
    """
    Return the resolved package root (parent of utils/).

    Note: This function does not modify sys.path. Runners must ensure the
    package root is on PYTHONPATH or be the current working directory.
    """
    return Path(__file__).resolve().parent.parent


def get_package_root() -> Path:
    """Get the current package root directory."""
    return PACKAGE_ROOT


def get_project_root() -> Path:
    """Get the project root directory (parent of package root)."""
    return PACKAGE_ROOT.parent


def get_analyzers_dir(category: str | None = None) -> Path:
    """
    Get the path to analyzers directory or a specific category.

    Args:
        category: Optional category name (e.g., 'security', 'performance', 'root_cause')

    Returns
    -------
        Path to the analyzers directory or specific category
    """
    analyzers_path = PACKAGE_ROOT / "analyzers"
    if category:
        return analyzers_path / category
    return analyzers_path


def get_ci_dir(subdir: str | None = None) -> Path:
    """
    Get the path to CI directory or a specific subdirectory.

    Args:
        subdir: Optional subdirectory name (e.g., 'core', 'integration', 'workflows')

    Returns
    -------
        Path to the CI directory or specific subdirectory
    """
    ci_path = PACKAGE_ROOT / "ci"
    if subdir:
        return ci_path / subdir
    return ci_path


def get_analyzer_script_path(category: str, script_name: str) -> Path:
    """
    Get the full path to a specific analyzer script.

    Args:
        category: Category name (e.g., 'security', 'performance')
        script_name: Script filename (e.g., 'detect_secrets_analyzer.py')

    Returns
    -------
        Full path to the analyzer script
    """
    return get_analyzers_dir(category) / script_name


def get_test_codebase_dir(subdir: str | None = None) -> Path:
    """
    Get the test codebase directory.

    Args:
        subdir: Optional subdirectory (e.g., 'vulnerable-apps', 'clean-apps')

    Returns
    -------
        Path to the test codebase or specific subdirectory
    """
    test_dir = get_project_root() / "test_codebase"
    if subdir:
        return test_dir / subdir
    return test_dir


# Initialize the package root once at module import
PACKAGE_ROOT = setup_import_paths()

# For direct module execution (testing)
if __name__ == "__main__":
    print("Simple Path Resolution System")
    print("=" * 40)
    print(f"Package Root: {PACKAGE_ROOT}")
    print(f"Project Root: {get_project_root()}")
    print(f"Python Path: {sys.path[:3]}...")  # Show first 3 entries

    # Test directory access
    print("\nDirectory Structure Test:")
    for indicator in ["analyzers", "core", "ci"]:
        path = PACKAGE_ROOT / indicator
        exists = "✓" if path.exists() else "✗"
        print(f"  {exists} {path}")
