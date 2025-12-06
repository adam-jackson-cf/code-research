"""Shared utilities for context bundle capture scripts."""

from __future__ import annotations

import json
from collections.abc import Iterable
from pathlib import Path
from typing import Any

try:  # Optional dependency; scripts should degrade gracefully.
    from sensitive_data_redactor import (
        redact_sensitive_data,  # type: ignore[import-not-found]
    )
except Exception:  # pragma: no cover - defensive import guard
    redact_sensitive_data = None


CONFIG_FILENAME = "context_capture_config.json"


def load_config_with_defaults(defaults: dict[str, Any]) -> dict[str, Any]:
    """Load config from disk if present, otherwise return provided defaults."""
    cfg_path = Path(__file__).parent / CONFIG_FILENAME
    try:
        if cfg_path.exists():
            return json.loads(cfg_path.read_text())
    except Exception:
        pass
    return defaults


def should_exclude_operation(operation: str | None, config: dict[str, Any]) -> bool:
    return operation in config.get("excluded_operations", [])


def should_exclude_bash_command(command: str | None, config: dict[str, Any]) -> bool:
    if not command:
        return False
    excluded = config.get("excluded_bash_commands", [])
    low = command.lower().strip()
    return any(low.startswith(item.lower()) for item in excluded)


def should_exclude_prompt(prompt: str | None, config: dict[str, Any]) -> bool:
    if not prompt:
        return False
    patterns = config.get("excluded_prompt_patterns", [])
    text = prompt.strip().lower()
    return any(pattern.lower() in text for pattern in patterns)


def should_exclude_by_string_pattern(value: str | None, config: dict[str, Any]) -> bool:
    if not value or not isinstance(value, str):
        return False
    patterns = config.get("excluded_string_patterns", [])
    lowered = value.lower()
    return any(pattern.lower() in lowered for pattern in patterns)


def redact_if_available(value: Any, config: dict[str, Any]) -> Any:
    if not isinstance(value, str):
        return value
    redaction_cfg = config.get("redaction", {})
    if not redaction_cfg.get("enabled", True):
        return value
    if redact_sensitive_data is None:
        return value
    try:
        return redact_sensitive_data(value, redaction_cfg)
    except Exception:
        return value


def semantic_match(
    text: str | None, term: str | None, variations: dict[str, list[str]] | None = None
) -> bool:
    if not term or not text:
        return False
    text_lower = text.lower()
    term_lower = term.lower()
    if term_lower in text_lower:
        return True
    words = term_lower.split()
    if all(word in text_lower for word in words):
        return True
    if variations:
        for word in words:
            for variant in variations.get(word, []):
                if variant in text_lower:
                    return True
    return False


def parse_semantic_variations(raw: str | None) -> dict[str, list[str]] | None:
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return {str(k): list(v) for k, v in parsed.items() if isinstance(v, list)}
    except json.JSONDecodeError as exc:
        raise ValueError(f"Error parsing semantic variations JSON: {exc}") from exc
    return None


def normalize_path(path_str: str | None) -> Path | None:
    if not path_str:
        return None
    try:
        return Path(path_str).expanduser().resolve()
    except Exception:
        return None


def resolve_project_root(project_root: str | None) -> Path:
    try:
        return (
            Path(project_root).expanduser().resolve()
            if project_root
            else Path.cwd().resolve()
        )
    except FileNotFoundError as exc:
        raise ValueError(f"Invalid project root: {exc}") from exc


def build_result_payload(
    session_ids: Iterable[str | None],
    operations: list[dict[str, Any]],
    uuid_filter: str | None,
    search_term: str | None,
) -> dict[str, Any]:
    timestamps = [op.get("timestamp") for op in operations if op.get("timestamp")]
    date_range = {
        "earliest": min(timestamps) if timestamps else None,
        "latest": max(timestamps) if timestamps else None,
    }
    session_set = {sid for sid in session_ids if sid}
    return {
        "sessions_found": len(session_set),
        "date_range": date_range,
        "filter": f"UUID: {uuid_filter}" if uuid_filter else "All recent sessions",
        "search_term": search_term,
        "operations": operations,
    }


def emit_result(result: dict[str, Any], output_format: str) -> None:
    if output_format == "json":
        print(json.dumps(result, indent=2))
        return

    sessions = result.get("sessions_found", 0)
    date_range = result.get("date_range") or {}
    print(f"Sessions Found: {sessions}")
    earliest = date_range.get("earliest")
    latest = date_range.get("latest")
    if earliest:
        print(f"Date Range: {earliest} to {latest}")
    print(f"Filter: {result.get('filter')}")
    search_term = result.get("search_term")
    if search_term:
        print(f"Search Term: {search_term}")
    print(f"Operations: {len(result.get('operations', []))}")
