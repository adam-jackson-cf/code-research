#!/usr/bin/env python3
"""Deterministic contracts and validation helpers for deep-research-agent."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "1.0.0"

ROLE_LOCK_REQUIRED_FIELDS: tuple[str, ...] = (
    "schemaVersion",
    "workerId",
    "role",
    "objective",
    "assignedQuestions",
    "constraints",
    "deliverables",
    "budgetTokens",
    "escalationThreshold",
    "lockHash",
)

WRITER_INPUT_REQUIRED_FIELDS: tuple[str, ...] = (
    "schemaVersion",
    "eventId",
    "eventType",
    "workerId",
    "claimId",
    "claimText",
    "sourceId",
    "evidence",
    "counterpoint",
    "implication",
    "actionability",
    "confidence",
    "occurredAt",
)

WORKER_EVENT_REQUIRED_FIELDS: tuple[str, ...] = WRITER_INPUT_REQUIRED_FIELDS + (
    "sequence",
    "previousEventHash",
    "eventHash",
)

RESERVED_WRITER_FIELDS: tuple[str, ...] = ("sequence", "previousEventHash", "eventHash")


def stable_json_dumps(value: Any) -> str:
    """Return canonical JSON text for stable hashing and stable line writes."""
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def load_json(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"Expected JSON object in {path}")
    return data


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def require_fields(data: dict[str, Any], required_fields: tuple[str, ...], context: str) -> None:
    missing = [field for field in required_fields if field not in data]
    if missing:
        raise ValueError(f"{context}: missing required fields: {', '.join(missing)}")


def require_string(value: Any, field_name: str, context: str) -> None:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{context}: field '{field_name}' must be a non-empty string")


def require_string_list(value: Any, field_name: str, context: str) -> None:
    if not isinstance(value, list) or not value:
        raise ValueError(f"{context}: field '{field_name}' must be a non-empty list")
    for index, entry in enumerate(value):
        if not isinstance(entry, str) or not entry.strip():
            raise ValueError(
                f"{context}: field '{field_name}[{index}]' must be a non-empty string"
            )


def _coerce_confidence(value: Any, context: str) -> float:
    if isinstance(value, bool):
        raise ValueError(f"{context}: confidence must be a float between 0 and 1")
    if not isinstance(value, (int, float)):
        raise ValueError(f"{context}: confidence must be a float between 0 and 1")
    numeric = float(value)
    if numeric < 0.0 or numeric > 1.0:
        raise ValueError(f"{context}: confidence must be a float between 0 and 1")
    return numeric


def _coerce_positive_int(value: Any, field_name: str, context: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ValueError(f"{context}: field '{field_name}' must be an integer > 0")
    return value


def _coerce_ratio(value: Any, field_name: str, context: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{context}: field '{field_name}' must be a number in range (0,1]")
    numeric = float(value)
    if numeric <= 0.0 or numeric > 1.0:
        raise ValueError(f"{context}: field '{field_name}' must be a number in range (0,1]")
    return numeric


def compute_role_lock_hash(lock_payload: dict[str, Any]) -> str:
    hashable = {key: value for key, value in lock_payload.items() if key != "lockHash"}
    return sha256_hex(stable_json_dumps(hashable))


def validate_role_lock(lock_payload: dict[str, Any]) -> str:
    context = "role-lock"
    require_fields(lock_payload, ROLE_LOCK_REQUIRED_FIELDS, context)
    require_string(lock_payload["schemaVersion"], "schemaVersion", context)
    require_string(lock_payload["workerId"], "workerId", context)
    require_string(lock_payload["role"], "role", context)
    require_string(lock_payload["objective"], "objective", context)
    require_string_list(lock_payload["assignedQuestions"], "assignedQuestions", context)
    require_string_list(lock_payload["constraints"], "constraints", context)
    require_string_list(lock_payload["deliverables"], "deliverables", context)
    _coerce_positive_int(lock_payload["budgetTokens"], "budgetTokens", context)
    _coerce_ratio(lock_payload["escalationThreshold"], "escalationThreshold", context)
    require_string(lock_payload["lockHash"], "lockHash", context)

    computed = compute_role_lock_hash(lock_payload)
    provided = lock_payload["lockHash"]
    if provided != computed:
        raise ValueError(
            "role-lock: lockHash mismatch; expected deterministic hash "
            f"{computed} but received {provided}"
        )
    return computed


def _validate_writer_input(payload: dict[str, Any]) -> float:
    context = "worker-journal-write"
    require_fields(payload, WRITER_INPUT_REQUIRED_FIELDS, context)

    for field in WRITER_INPUT_REQUIRED_FIELDS:
        if field == "confidence":
            continue
        require_string(payload[field], field, context)

    for reserved in RESERVED_WRITER_FIELDS:
        if reserved in payload:
            raise ValueError(
                f"{context}: field '{reserved}' is reserved and must not be provided"
            )

    return _coerce_confidence(payload["confidence"], context)


def _hash_worker_event(event_payload: dict[str, Any]) -> str:
    hashable = {key: value for key, value in event_payload.items() if key != "eventHash"}
    return sha256_hex(stable_json_dumps(hashable))


def validate_worker_event(event_payload: dict[str, Any]) -> str:
    context = "worker-journal-event"
    require_fields(event_payload, WORKER_EVENT_REQUIRED_FIELDS, context)

    for field in WORKER_EVENT_REQUIRED_FIELDS:
        if field in {"sequence", "confidence", "previousEventHash"}:
            continue
        require_string(event_payload[field], field, context)

    previous_hash = event_payload["previousEventHash"]
    if not isinstance(previous_hash, str):
        raise ValueError(
            f"{context}: field 'previousEventHash' must be a string (empty allowed for first event)"
        )

    sequence = event_payload["sequence"]
    if not isinstance(sequence, int) or sequence < 1:
        raise ValueError(f"{context}: sequence must be an integer >= 1")

    _coerce_confidence(event_payload["confidence"], context)

    expected_hash = _hash_worker_event(event_payload)
    if event_payload["eventHash"] != expected_hash:
        raise ValueError(
            "worker-journal-event: eventHash mismatch; expected deterministic hash "
            f"{expected_hash} but received {event_payload['eventHash']}"
        )
    return expected_hash


def validate_event_chain(events: list[dict[str, Any]]) -> str:
    previous_hash = ""
    expected_sequence = 1
    for event in events:
        validate_worker_event(event)
        if event["sequence"] != expected_sequence:
            raise ValueError(
                "worker-journal-event: non-contiguous sequence; "
                f"expected {expected_sequence} but received {event['sequence']}"
            )
        if event["previousEventHash"] != previous_hash:
            raise ValueError(
                "worker-journal-event: previousEventHash mismatch at sequence "
                f"{event['sequence']}"
            )
        previous_hash = event["eventHash"]
        expected_sequence += 1
    return previous_hash


def build_next_worker_event(
    payload: dict[str, Any],
    prior_events: list[dict[str, Any]],
) -> dict[str, Any]:
    confidence = _validate_writer_input(payload)

    previous_hash = validate_event_chain(prior_events)
    next_sequence = len(prior_events) + 1

    event = {
        "schemaVersion": payload["schemaVersion"],
        "sequence": next_sequence,
        "eventId": payload["eventId"],
        "eventType": payload["eventType"],
        "workerId": payload["workerId"],
        "claimId": payload["claimId"],
        "claimText": payload["claimText"],
        "sourceId": payload["sourceId"],
        "evidence": payload["evidence"],
        "counterpoint": payload["counterpoint"],
        "implication": payload["implication"],
        "actionability": payload["actionability"],
        "confidence": confidence,
        "occurredAt": payload["occurredAt"],
        "previousEventHash": previous_hash,
    }
    event["eventHash"] = _hash_worker_event(event)
    return event


def load_jsonl_events(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    events: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, raw_line in enumerate(handle, start=1):
            line = raw_line.strip()
            if not line:
                continue
            try:
                payload = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(
                    f"worker-journal-event: invalid JSON at line {line_number} in {path}"
                ) from exc
            if not isinstance(payload, dict):
                raise ValueError(
                    f"worker-journal-event: line {line_number} in {path} is not a JSON object"
                )
            events.append(payload)
    return events


def append_jsonl_event(path: Path, event_payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(stable_json_dumps(event_payload))
        handle.write("\n")
