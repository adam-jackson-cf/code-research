#!/usr/bin/env python3
"""Context bundle capture for Codex sessions.

Parses Codex JSONL session logs under ~/.codex/sessions/YYYY/MM/DD/*.jsonl
and correlates them with user prompts from ~/.codex/history.jsonl.

Defaults emphasize ways-of-working over tool noise:
- Includes recent user prompts mapped to sessions and filtered to the caller
  project by default (based on session_meta cwd).
- Keeps operations for compatibility, but trims low‑signal tool output.

Use --days (default 2), --uuid, --search-term, --project-root, and
--include-all-projects as before. No additional flags are required.
"""

import argparse
import json
import re
import sys
from collections.abc import Iterable
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from context.context_capture_utils import (
    build_result_payload,
    emit_result,
    load_config_with_defaults,
    normalize_path,
    parse_semantic_variations,
    redact_if_available,
    resolve_project_root,
    semantic_match,
    should_exclude_bash_command,
    should_exclude_operation,
    should_exclude_prompt,
)

DEFAULT_CONFIG: dict[str, Any] = {
    "excluded_operations": ["session_meta", "turn_context", "token_count"],
    "excluded_bash_commands": [
        "ls",
        "pwd",
        "cd",
        "git status",
        "git log",
        "git diff",
        "git show",
        "git branch",
    ],
    "excluded_prompt_patterns": [],
    "excluded_string_patterns": [
        "__pycache__",
        ".pyc",
        "node_modules/",
        ".git/objects/",
        "/tmp/",
        ".cache/",
    ],
    "redaction": {"enabled": True, "custom_patterns": []},
    "truncation_limits": {
        "prompt_max_length": 200,
        "edit_string_max_length": 2000,
    },
}


def load_config() -> dict[str, Any]:
    return load_config_with_defaults(DEFAULT_CONFIG)


def get_codex_sessions_root() -> Path:
    return Path.home() / ".codex" / "sessions"


def get_codex_history_path() -> Path:
    return Path.home() / ".codex" / "history.jsonl"


def parse_date_from_path(p: Path) -> datetime:
    return datetime.fromtimestamp(p.stat().st_mtime)


def iter_recent_jsonl_files(root: Path, days: int) -> Iterable[Path]:
    if not root.exists():
        return []
    cutoff = datetime.now() - timedelta(days=days)
    for p in root.rglob("*.jsonl"):
        try:
            if parse_date_from_path(p) >= cutoff:
                yield p
        except Exception:
            continue


_ERR_WARN_PAT = re.compile(r"\b(error|warning|failed|fatal|traceback)\b", re.IGNORECASE)


def _summarize_tool_output(text: str) -> str:
    """Reduce tool output noise: keep first 12 lines and any lines with error/warning signal.

    Caps to ~2000 characters to avoid oversized payloads.
    """
    try:
        lines = text.splitlines()
    except Exception:
        lines = [text]
    chosen: list[str] = []
    chosen.extend(lines[:12])
    for ln in lines[12:200]:
        if _ERR_WARN_PAT.search(ln):
            chosen.append(ln)
    short = "\n".join(chosen)
    if len(short) > 2000:
        short = short[:2000] + "..."
    return short


def _iter_user_prompts_recent(history_path: Path, days: int) -> list[dict[str, Any]]:
    """Return recent user prompts from ~/.codex/history.jsonl within the window.

    Each item: {"session_id": str, "timestamp": iso, "text": str}
    """
    if not history_path.exists():
        return []
    cutoff = datetime.now().timestamp() - days * 24 * 3600
    results: list[dict[str, Any]] = []
    try:
        with open(history_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except Exception:
                    continue
                ts = obj.get("ts")
                sid = obj.get("session_id")
                text = obj.get("text")
                if not (sid and text and isinstance(ts, int | float) and ts >= cutoff):
                    continue
                try:
                    iso = datetime.fromtimestamp(ts).isoformat() + "Z"
                except Exception:
                    iso = None
                results.append({"session_id": sid, "timestamp": iso, "text": text})
    except Exception:
        return []
    return results


def session_matches_project(session_cwd: str | None, project_root: Path) -> bool:
    session_path = normalize_path(session_cwd)
    if session_path is None:
        return False
    try:
        if session_path == project_root:
            return True
        if project_root in session_path.parents:
            return True
        return session_path in project_root.parents
    except Exception:
        return False


def build_operation(
    *,
    timestamp: str,
    operation: str,
    session_id: str | None,
    data: dict[str, Any],
    config: dict[str, Any],
    search_term: str | None,
    semantic_variations: dict[str, list[str]] | None,
) -> dict[str, Any] | None:
    if should_exclude_operation(operation, config):
        return None
    # Redact common string fields
    redact_fields = {"command", "file_path", "prompt", "output", "arguments", "text"}
    safe = {}
    for k, v in data.items():
        safe[k] = redact_if_available(v, config) if k in redact_fields else v
    if search_term and not semantic_match(
        json.dumps(safe, ensure_ascii=False), search_term, semantic_variations
    ):
        return None
    return {
        "timestamp": timestamp,
        "operation": operation,
        "session_id": session_id,
        **safe,
        "search_match": bool(search_term),
    }


def extract_jsonl_operations(
    jsonl_path: Path,
    *,
    config: dict[str, Any],
    search_term: str | None,
    semantic_variations: dict[str, list[str]] | None,
) -> tuple[str, str | None, list[dict[str, Any]]]:
    session_id: str | None = None
    session_cwd: str | None = None
    ops: list[dict[str, Any]] = []
    try:
        with open(jsonl_path, encoding="utf-8") as f:
            for raw in f:
                raw = raw.strip()
                if not raw:
                    continue
                try:
                    evt = json.loads(raw)
                except Exception:
                    continue
                ts = (
                    evt.get("timestamp")
                    or datetime.utcfromtimestamp(
                        parse_date_from_path(jsonl_path).timestamp()
                    ).isoformat()
                    + "Z"
                )
                etype = evt.get("type")
                payload = (
                    evt.get("payload") if isinstance(evt.get("payload"), dict) else {}
                )

                if etype == "session_meta":
                    session_id = (
                        payload.get("id") or payload.get("thread_id") or session_id
                    )
                    session_cwd = payload.get("cwd") or session_cwd
                    op = build_operation(
                        timestamp=ts,
                        operation="session_meta",
                        session_id=session_id,
                        data={
                            "cwd": payload.get("cwd"),
                            "cli_version": payload.get("cli_version"),
                            "originator": payload.get("originator"),
                        },
                        config=config,
                        search_term=search_term,
                        semantic_variations=semantic_variations,
                    )
                    if op:
                        ops.append(op)
                    continue

                # item.* events per docs
                if etype in {"item.started", "item.updated", "item.completed"}:
                    item = evt.get("item") or payload.get("item") or {}
                    itype = item.get("item_type") or item.get("type")
                    if itype == "file_change":
                        data = {
                            k: item.get(k)
                            for k in ("file_path", "diff", "change_type")
                            if k in item
                        }
                        op = build_operation(
                            timestamp=ts,
                            operation="file_change",
                            session_id=session_id,
                            data=data,
                            config=config,
                            search_term=search_term,
                            semantic_variations=semantic_variations,
                        )
                        if op:
                            ops.append(op)
                        continue
                    if itype == "assistant_message":
                        text = item.get("text") or item.get("content")
                        if text and not should_exclude_prompt(text, config):
                            short = text[:500] + ("..." if len(text) > 500 else "")
                            op = build_operation(
                                timestamp=ts,
                                operation="assistant_message",
                                session_id=session_id,
                                data={"text": short},
                                config=config,
                                search_term=search_term,
                                semantic_variations=semantic_variations,
                            )
                            if op:
                                ops.append(op)
                        continue

                # response_item events observed in local logs
                if etype == "response_item":
                    ptype = payload.get("type")
                    if ptype == "function_call":
                        name = payload.get("name")
                        args = payload.get("arguments")
                        cmd_str: str | None = None
                        try:
                            if isinstance(args, str):
                                args_json = json.loads(args)
                                cmd = args_json.get("command")
                                if isinstance(cmd, list):
                                    cmd_str = " ".join(str(x) for x in cmd)
                                elif isinstance(cmd, str):
                                    cmd_str = cmd
                        except Exception:
                            cmd_str = None

                        if (
                            name == "shell"
                            and cmd_str
                            and not should_exclude_bash_command(cmd_str, config)
                        ):
                            op = build_operation(
                                timestamp=ts,
                                operation="bash",
                                session_id=session_id,
                                data={"command": cmd_str},
                                config=config,
                                search_term=search_term,
                                semantic_variations=semantic_variations,
                            )
                            if op:
                                ops.append(op)
                        else:
                            op = build_operation(
                                timestamp=ts,
                                operation="tool_call",
                                session_id=session_id,
                                data={"tool": name, "arguments": args},
                                config=config,
                                search_term=search_term,
                                semantic_variations=semantic_variations,
                            )
                            if op:
                                ops.append(op)
                        continue
                    if ptype == "function_call_output":
                        out = payload.get("output")
                        if isinstance(out, str):
                            short = _summarize_tool_output(out)
                        else:
                            short = out
                        op = build_operation(
                            timestamp=ts,
                            operation="tool_output",
                            session_id=session_id,
                            data={"output": short},
                            config=config,
                            search_term=search_term,
                            semantic_variations=semantic_variations,
                        )
                        if op:
                            ops.append(op)
                        continue

                if etype in {"turn.started", "turn.completed", "turn.failed"}:
                    op = build_operation(
                        timestamp=ts,
                        operation=etype,
                        session_id=session_id,
                        data={},
                        config=config,
                        search_term=search_term,
                        semantic_variations=semantic_variations,
                    )
                    if op:
                        ops.append(op)
                    continue

    except Exception:
        # Skip unreadable files
        pass

    return (session_id or jsonl_path.stem, session_cwd, ops)


def capture_codex_context() -> None:
    parser = argparse.ArgumentParser(
        description="Extract context from Codex sessions (JSONL events)"
    )
    parser.add_argument(
        "--days", type=int, default=2, help="Number of days to search back"
    )
    parser.add_argument("--uuid", help="Filter to specific session UUID")
    parser.add_argument(
        "--search-term",
        help="Search for sessions containing semantically matching content",
    )
    parser.add_argument(
        "--semantic-variations",
        help="JSON string containing semantic variations dictionary",
    )
    parser.add_argument(
        "--output-format",
        choices=["json", "text"],
        default="json",
        help="Output format",
    )
    parser.add_argument(
        "--project-root",
        help="Absolute path to the project root. Defaults to current working directory.",
    )
    parser.add_argument(
        "--include-all-projects",
        action="store_true",
        help="Include sessions from all projects, ignoring project root filtering.",
    )
    args = parser.parse_args()

    # Parse semantic variations if provided
    try:
        semantic_variations = parse_semantic_variations(args.semantic_variations)
    except ValueError as exc:
        print(exc, file=sys.stderr)
        sys.exit(1)

    try:
        config = load_config()
        root = get_codex_sessions_root()
        files = list(iter_recent_jsonl_files(root, args.days))

        try:
            project_root = resolve_project_root(args.project_root)
        except ValueError as exc:
            print(str(exc), file=sys.stderr)
            sys.exit(1)

        if args.uuid:
            files = [p for p in files if args.uuid in p.name]

        all_ops: list[dict[str, Any]] = []
        session_ids: list[str] = []
        for fpath in sorted(files):
            sid, session_cwd, ops = extract_jsonl_operations(
                fpath,
                config=config,
                search_term=args.search_term,
                semantic_variations=semantic_variations,
            )
            if args.uuid and args.uuid not in (sid or ""):
                continue
            if not args.include_all_projects and not session_matches_project(
                session_cwd, project_root
            ):
                continue
            session_ids.append(sid)
            all_ops.extend(ops)

        # Build minimal result for backward compatibility
        base = build_result_payload(session_ids, all_ops, args.uuid, args.search_term)

        # Include user prompts per session by default (ways-of-working focus)
        prompts = _iter_user_prompts_recent(get_codex_history_path(), args.days)
        # Map session cwd by parsing operations once
        sid_to_cwd: dict[str, str | None] = {}
        for op in all_ops:
            if op.get("operation") == "session_meta":
                sid_to_cwd.setdefault(op.get("session_id"), op.get("cwd"))

        # Filter prompts to project (unless include-all-projects)
        sessions_out: list[dict[str, Any]] = []
        seen: set[str] = set()
        from collections import Counter

        for sid in session_ids:
            if sid in seen:
                continue
            seen.add(sid)
            cwd = sid_to_cwd.get(sid)
            if not args.include_all_projects and not session_matches_project(
                cwd, resolve_project_root(args.project_root)
            ):
                continue
            ops_for_sid = [o for o in all_ops if o.get("session_id") == sid]
            c = Counter(o.get("operation") for o in ops_for_sid)
            # attach user messages
            msgs = [
                {
                    "timestamp": p.get("timestamp"),
                    "text": redact_if_available(p.get("text"), config),
                }
                for p in prompts
                if p.get("session_id") == sid
            ]
            ts_values = [t for t in [o.get("timestamp") for o in ops_for_sid] if t]
            sdr = {
                "earliest": min(ts_values) if ts_values else None,
                "latest": max(ts_values) if ts_values else None,
            }
            sessions_out.append(
                {
                    "id": sid,
                    "cwd": cwd,
                    "date_range": sdr,
                    "counts": {
                        "user_messages": len(msgs),
                        "operations": len(ops_for_sid),
                        **dict(c),
                    },
                    "user_messages": msgs,
                }
            )

        # Merge enriched sessions into the result (JSON mode consumers can use it)
        base["sessions"] = sessions_out
        emit_result(base, args.output_format)

    except Exception as e:
        print(f"Error extracting Codex context: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    capture_codex_context()
