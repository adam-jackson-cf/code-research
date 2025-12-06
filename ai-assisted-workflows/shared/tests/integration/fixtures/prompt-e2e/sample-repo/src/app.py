"""Minimal module used for prompt automation tests."""

from __future__ import annotations


def greet(name: str) -> str:
    """Return a simple greeting for the provided name."""
    return f"Hello, {name}!"


if __name__ == "__main__":  # pragma: no cover - manual invocation helper
    print(greet("World"))
