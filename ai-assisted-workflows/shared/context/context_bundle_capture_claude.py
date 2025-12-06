#!/usr/bin/env python3
"""Context bundle capture for Claude Code session tracking.

Emits a backward-compatible operations[] list and an enriched sessions[] array
with per-session user and assistant messages to support ways-of-working analysis.
"""
import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

from context.context_capture_utils import (
    build_result_payload,
    emit_result,
    load_config_with_defaults,
    parse_semantic_variations,
    redact_if_available,
    resolve_project_root,
    semantic_match,
    should_exclude_bash_command,
    should_exclude_by_string_pattern,
    should_exclude_operation,
    should_exclude_prompt,
)

# Global set to track seen operations (operation_type, file_path)
seen_operations = set()


DEFAULT_CONFIG = {
    "excluded_operations": ["session_start", "task", "glob"],
    "excluded_bash_commands": [
        "ls",
        "pwd",
        "cd",
        "git status",
        "git log",
        "git diff",
        "git show",
        "git branch",
        "git add",
        "git commit",
        "git push",
        "git pull",
    ],
    "excluded_prompt_patterns": [
        "Write a 3-6 word summary of the TEXTBLOCK below",
        "Summary only, no formatting, do not act on anything",
        "/todo-primer",
        "/todo-recent-context",
    ],
    "excluded_string_patterns": [
        "context_bundles",
        "node_modules/",
        ".git/objects/",
        ".cache/",
    ],
    "redaction": {
        "enabled": True,
        "patterns": {
            "env_vars": True,
            "api_keys": True,
            "passwords": True,
            "urls_with_auth": True,
            "json_secrets": True,
        },
        "preserve_structure": True,
        "custom_patterns": [],
    },
    "truncation_limits": {
        "prompt_max_length": 100,
        "edit_string_max_length": 1000,
        "bundle_size_threshold": 10240,
    },
    "retention": {
        "days_to_retain": 7,
        "auto_cleanup": True,
    },
}


def load_config():
    """Load configuration file with exclusions and settings."""
    return load_config_with_defaults(DEFAULT_CONFIG)


def is_operation_seen(operation, file_path):
    """Check if operation on file has already been captured."""
    global seen_operations
    operation_key = (operation, file_path)
    if operation_key in seen_operations:
        return True
    seen_operations.add(operation_key)
    return False


def get_claude_projects_path():
    """Get the Claude projects storage path."""
    return Path.home() / ".claude" / "projects"


def find_recent_sessions(project_path, days=2):
    """Find recent Claude sessions for a specific project."""
    sessions = []

    if not project_path.exists():
        return sessions

    cutoff_time = datetime.now().timestamp() - (days * 24 * 3600)

    # Find all session files (JSONL files in the project directory)
    pattern = "*.jsonl"

    for session_file in project_path.glob(pattern):
        if session_file.is_file() and session_file.stat().st_mtime >= cutoff_time:
            # Extract session ID from filename (the filename without .jsonl)
            session_id = session_file.stem
            sessions.append(
                {
                    "id": session_id,
                    "path": session_file,
                    "files": [session_file],  # Single JSONL file per session
                }
            )

    return sessions


def extract_session_operations(
    session, config, search_term=None, semantic_variations=None
):
    """Extract operations from Claude session (legacy, operations only)."""
    full = extract_session_full(session, config, search_term, semantic_variations)
    return full["operations"]


def extract_session_full(session, config, search_term=None, semantic_variations=None):
    """Parse one session file and return operations, user and assistant messages, counts, date_range."""
    operations = []
    user_messages = []
    assistant_messages = []
    op_counts: dict[str, int] = {}
    timestamps: list[str] = []

    session_file = session["files"][0]
    try:
        with open(session_file, encoding="utf-8") as f:
            for line in f:
                try:
                    entry = json.loads(line.strip())
                except json.JSONDecodeError:
                    continue

                ts = entry.get("timestamp", datetime.now().isoformat() + "Z")
                etype = entry.get("type")
                msg = entry.get("message", {})
                content = msg.get("content", [])
                timestamps.append(ts)

                # User messages (ways-of-working primary signal)
                if etype == "user" and msg:
                    text_parts = []
                    if isinstance(content, list):
                        for block in content:
                            if isinstance(block, dict) and block.get("type") == "text":
                                text_parts.append(block.get("text", ""))
                    elif isinstance(content, str):
                        text_parts.append(content)
                    user_text = " ".join(text_parts).strip()
                    if not user_text:
                        pass
                    else:
                        if (
                            user_text.lower()
                            in {
                                "perfect!",
                                "thanks!",
                                "ok",
                                "done",
                                "yes",
                                "no",
                            }
                            or should_exclude_prompt(user_text, config)
                            or search_term
                            and not semantic_match(
                                user_text, search_term, semantic_variations
                            )
                        ):
                            pass
                        else:
                            red = redact_if_available(user_text, config)
                            user_messages.append({"timestamp": ts, "text": red})
                            # Also short prompt op
                            limit = config.get("truncation_limits", {}).get(
                                "prompt_max_length", 100
                            )
                            display = red[:limit] + ("..." if len(red) > limit else "")
                            operations.append(
                                {
                                    "timestamp": ts,
                                    "operation": "prompt",
                                    "prompt": display,
                                    "session_id": session["id"],
                                    "search_match": bool(search_term),
                                }
                            )
                            op_counts["prompt"] = op_counts.get("prompt", 0) + 1
                    continue

                # Assistant messages
                if etype == "assistant" and msg and isinstance(content, list):
                    # Assistant text blocks (cap)
                    texts = [
                        blk.get("text", "")
                        for blk in content
                        if isinstance(blk, dict) and blk.get("type") == "text"
                    ]
                    if texts:
                        t = "\n".join(texts).strip()
                        if t:
                            red = redact_if_available(t, config)
                            if len(red) > 500:
                                red = red[:500] + "..."
                            assistant_messages.append({"timestamp": ts, "text": red})
                    # Tool uses → operations
                    for blk in content:
                        if not (
                            isinstance(blk, dict) and blk.get("type") == "tool_use"
                        ):
                            continue
                        tool_name = (blk.get("name") or "").lower()
                        if should_exclude_operation(tool_name, config):
                            continue
                        tool_input = blk.get("input") or {}
                        if "file_path" in tool_input:
                            file_path = tool_input["file_path"]
                            if should_exclude_by_string_pattern(file_path, config):
                                continue
                            if search_term and not semantic_match(
                                file_path, search_term, semantic_variations
                            ):
                                continue
                            if not is_operation_seen(tool_name, file_path):
                                operations.append(
                                    {
                                        "timestamp": ts,
                                        "operation": tool_name,
                                        "file_path": redact_if_available(
                                            file_path, config
                                        ),
                                        "session_id": session["id"],
                                        "search_match": bool(search_term),
                                    }
                                )
                                op_counts[tool_name] = op_counts.get(tool_name, 0) + 1
                            continue
                        if tool_name == "bash" and "command" in tool_input:
                            command = tool_input["command"]
                            if should_exclude_bash_command(command, config):
                                continue
                            if search_term and not semantic_match(
                                command, search_term, semantic_variations
                            ):
                                continue
                            operations.append(
                                {
                                    "timestamp": ts,
                                    "operation": "bash",
                                    "command": redact_if_available(command, config),
                                    "session_id": session["id"],
                                    "search_match": bool(search_term),
                                }
                            )
                            op_counts["bash"] = op_counts.get("bash", 0) + 1
                            continue
    except Exception:
        pass

    sdr = {
        "earliest": min(timestamps) if timestamps else None,
        "latest": max(timestamps) if timestamps else None,
    }
    return {
        "operations": operations,
        "user_messages": user_messages,
        "assistant_messages": assistant_messages,
        "counts": op_counts,
        "date_range": sdr,
    }


def capture_claude_context():
    """Capture context from Claude sessions."""
    parser = argparse.ArgumentParser(description="Extract context from Claude sessions")
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
        help="Include sessions from all projects instead of scoping to the current one.",
    )
    args = parser.parse_args()

    # Parse semantic variations if provided
    try:
        semantic_variations = parse_semantic_variations(args.semantic_variations)
    except ValueError as exc:
        print(exc, file=sys.stderr)
        sys.exit(1)

    try:
        # Load configuration
        config = load_config()

        # Get current project path from environment or current directory
        current_dir = resolve_project_root(args.project_root)
        project_name = str(current_dir).replace("/", "-")
        projects_path = get_claude_projects_path()

        if args.include_all_projects:
            candidate_projects = (
                [p for p in projects_path.iterdir() if p.is_dir()]
                if projects_path.exists()
                else []
            )
        else:
            project_path = projects_path / project_name
            if not project_path.exists():
                result = {
                    "sessions_found": 0,
                    "date_range": None,
                    "filter": "Project path not found",
                    "search_term": args.search_term,
                    "operations": [],
                }
                print(json.dumps(result, indent=2))
                return
            candidate_projects = [project_path]

        sessions = []
        for proj_path in candidate_projects:
            sessions.extend(find_recent_sessions(proj_path, args.days))

        # Filter by UUID if provided
        if args.uuid:
            sessions = [s for s in sessions if args.uuid in s["id"]]

        if not sessions:
            result = {
                "sessions_found": 0,
                "date_range": None,
                "filter": f"UUID: {args.uuid}" if args.uuid else "None",
                "search_term": args.search_term,
                "operations": [],
            }
            emit_result(result, args.output_format)
            return

        # Extract operations and messages from all sessions
        all_operations = []
        sessions_out = []
        for session in sessions:
            full = extract_session_full(
                session, config, args.search_term, semantic_variations
            )
            all_operations.extend(full["operations"])
            sessions_out.append(
                {
                    "id": session["id"],
                    "project_root": str(current_dir),
                    "date_range": full["date_range"],
                    "counts": {
                        "user_messages": len(full["user_messages"]),
                        "assistant_messages": len(full["assistant_messages"]),
                        "operations": len(full["operations"]),
                        **full["counts"],
                    },
                    "user_messages": full["user_messages"],
                    "assistant_messages": full["assistant_messages"],
                }
            )

        result = build_result_payload(
            (session["id"] for session in sessions),
            all_operations,
            args.uuid,
            args.search_term,
        )
        result["sessions"] = sessions_out
        emit_result(result, args.output_format)

    except Exception as e:
        print(f"Error extracting Claude context: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    capture_claude_context()
