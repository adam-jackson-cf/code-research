from __future__ import annotations

import json

from context import context_capture_utils as utils


def test_load_config_with_defaults_uses_defaults_when_file_missing(monkeypatch):
    defaults = {"key": "value"}
    monkeypatch.setattr(utils, "CONFIG_FILENAME", "nonexistent_config_for_test.json")

    cfg = utils.load_config_with_defaults(defaults)

    assert cfg == defaults


def test_should_exclude_helpers():
    config = {
        "excluded_operations": ["session_meta"],
        "excluded_bash_commands": ["git status"],
        "excluded_prompt_patterns": ["skip me"],
        "excluded_string_patterns": ["node_modules"],
    }

    assert utils.should_exclude_operation("session_meta", config) is True
    assert utils.should_exclude_operation("other", config) is False

    assert utils.should_exclude_bash_command("git status -sb", config) is True
    assert utils.should_exclude_bash_command("ls", config) is False

    assert utils.should_exclude_prompt("Please skip me now", config) is True
    assert utils.should_exclude_prompt("keep", config) is False

    assert (
        utils.should_exclude_by_string_pattern("src/node_modules/file", config) is True
    )
    assert utils.should_exclude_by_string_pattern("src/app", config) is False


def test_semantic_match_variations():
    variations = {"auth": ["authenticate", "login"]}

    assert utils.semantic_match("Fix login flow", "auth", variations) is True
    assert (
        utils.semantic_match("Update authentication logic", "auth", variations) is True
    )
    assert utils.semantic_match("Refactor payment flow", "auth", variations) is False
    assert utils.semantic_match("Improve auth flow", "auth bug", variations) is False


def test_build_result_payload_computes_metadata():
    operations = [
        {"timestamp": "2025-01-01T00:00:01Z"},
        {"timestamp": "2025-01-02T00:00:01Z"},
        {"timestamp": None},
    ]
    sessions = ["abc", "def", None]

    result = utils.build_result_payload(sessions, operations, "abc", "search")

    assert result["sessions_found"] == 2
    assert result["date_range"] == {
        "earliest": "2025-01-01T00:00:01Z",
        "latest": "2025-01-02T00:00:01Z",
    }
    assert result["filter"] == "UUID: abc"
    assert result["search_term"] == "search"
    assert result["operations"] == operations


def test_emit_result_json(capsys):
    result = {
        "sessions_found": 1,
        "date_range": {"earliest": None, "latest": None},
        "filter": "All recent sessions",
        "search_term": None,
        "operations": [],
    }

    utils.emit_result(result, "json")
    captured = capsys.readouterr().out

    parsed = json.loads(captured)
    assert parsed == result


def test_emit_result_text(capsys):
    result = {
        "sessions_found": 2,
        "date_range": {"earliest": "2025-01-01", "latest": "2025-01-02"},
        "filter": "UUID: test",
        "search_term": "auth",
        "operations": [{}, {}],
    }

    utils.emit_result(result, "text")
    captured = capsys.readouterr().out

    assert "Sessions Found: 2" in captured
    assert "Date Range: 2025-01-01 to 2025-01-02" in captured
    assert "Filter: UUID: test" in captured
    assert "Search Term: auth" in captured
    assert "Operations: 2" in captured
