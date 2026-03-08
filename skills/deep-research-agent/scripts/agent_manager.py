#!/usr/bin/env python3
"""Compile a manager role plan into deterministic per-worker lock files."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from deterministic_contracts import (
    compute_role_lock_hash,
    load_json,
    write_json,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Validate manager role plan and generate deterministic per-worker lock files."
        )
    )
    parser.add_argument("--manager-plan-path", required=True, help="Path to manager role plan JSON")
    parser.add_argument("--locks-dir", required=True, help="Output directory for worker lock files")
    parser.add_argument(
        "--manifest-path",
        help="Optional output path for manager lock manifest JSON",
    )
    return parser.parse_args()


def _require_non_empty_string(value: Any, field: str, context: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{context}: field '{field}' must be a non-empty string")
    return value


def _require_non_empty_string_list(value: Any, field: str, context: str) -> list[str]:
    if not isinstance(value, list) or not value:
        raise ValueError(f"{context}: field '{field}' must be a non-empty list")
    normalized: list[str] = []
    for index, entry in enumerate(value):
        if not isinstance(entry, str) or not entry.strip():
            raise ValueError(
                f"{context}: field '{field}[{index}]' must be a non-empty string"
            )
        normalized.append(entry)
    return normalized


def _require_positive_int(value: Any, field: str, context: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ValueError(f"{context}: field '{field}' must be an integer > 0")
    return value


def _require_ratio(value: Any, field: str, context: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{context}: field '{field}' must be a number in range (0,1]")
    ratio = float(value)
    if ratio <= 0.0 or ratio > 1.0:
        raise ValueError(f"{context}: field '{field}' must be a number in range (0,1]")
    return ratio


def _validate_plan_shape(plan: dict[str, Any]) -> list[dict[str, Any]]:
    context = "manager-role-plan"
    _require_non_empty_string(plan.get("run_id"), "run_id", context)
    _require_non_empty_string(plan.get("created_utc"), "created_utc", context)

    manager = plan.get("manager")
    if not isinstance(manager, dict):
        raise ValueError(f"{context}: field 'manager' must be an object")
    _require_non_empty_string(manager.get("name"), "manager.name", context)
    _require_non_empty_string(manager.get("objective"), "manager.objective", context)

    workers = plan.get("workers")
    if not isinstance(workers, list) or not workers:
        raise ValueError(f"{context}: field 'workers' must be a non-empty list")

    expected_ids = [f"W{index:02d}" for index in range(1, len(workers) + 1)]
    seen_questions: set[str] = set()
    for index, worker in enumerate(workers):
        worker_context = f"{context}.workers[{index}]"
        if not isinstance(worker, dict):
            raise ValueError(f"{worker_context}: worker entry must be an object")
        worker_id = _require_non_empty_string(worker.get("worker_id"), "worker_id", worker_context)
        if worker_id != expected_ids[index]:
            raise ValueError(
                f"{worker_context}: worker_id must be contiguous ({expected_ids[index]} expected)"
            )
        _require_non_empty_string(worker.get("role"), "role", worker_context)
        question_ids = _require_non_empty_string_list(
            worker.get("question_ids"), "question_ids", worker_context
        )
        allowed_domains = set(
            _require_non_empty_string_list(worker.get("allowed_domains"), "allowed_domains", worker_context)
        )
        blocked_domains = set(
            _require_non_empty_string_list(worker.get("blocked_domains"), "blocked_domains", worker_context)
        )
        if allowed_domains & blocked_domains:
            raise ValueError(f"{worker_context}: allowed_domains and blocked_domains overlap")
        _require_non_empty_string_list(worker.get("output_files"), "output_files", worker_context)
        _require_positive_int(worker.get("budget_tokens"), "budget_tokens", worker_context)
        _require_ratio(worker.get("escalation_threshold"), "escalation_threshold", worker_context)

        for question_id in question_ids:
            if question_id in seen_questions:
                raise ValueError(
                    f"{worker_context}: question_id '{question_id}' assigned more than once"
                )
            seen_questions.add(question_id)

    return workers


def _build_constraints(worker: dict[str, Any]) -> list[str]:
    constraints = [
        f"allowed_domains={','.join(worker['allowed_domains'])}",
        f"blocked_domains={','.join(worker['blocked_domains'])}",
    ]
    extra = worker.get("constraints", [])
    if isinstance(extra, list):
        constraints.extend(
            [entry for entry in extra if isinstance(entry, str) and entry.strip()]
        )
    return constraints


def _build_worker_lock(
    manager_objective: str,
    worker: dict[str, Any],
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "schemaVersion": "1.0.0",
        "workerId": worker["worker_id"],
        "role": worker["role"],
        "objective": manager_objective,
        "assignedQuestions": worker["question_ids"],
        "constraints": _build_constraints(worker),
        "deliverables": worker["output_files"],
        "budgetTokens": worker["budget_tokens"],
        "escalationThreshold": float(worker["escalation_threshold"]),
    }
    payload["lockHash"] = compute_role_lock_hash(payload)
    return payload


def compile_manager_plan(plan: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    workers = _validate_plan_shape(plan)
    manager = plan["manager"]
    manager_objective = manager["objective"]

    compiled_locks = [
        _build_worker_lock(manager_objective, worker) for worker in workers
    ]
    manifest = {
        "runId": plan["run_id"],
        "createdUtc": plan["created_utc"],
        "workerCount": len(compiled_locks),
        "workers": [
            {
                "workerId": lock["workerId"],
                "role": lock["role"],
                "lockFile": f"{lock['workerId']}.role-lock.json",
                "budgetTokens": lock["budgetTokens"],
                "escalationThreshold": lock["escalationThreshold"],
                "lockHash": lock["lockHash"],
            }
            for lock in compiled_locks
        ],
    }
    return compiled_locks, manifest


def main() -> int:
    args = parse_args()
    manager_plan_path = Path(args.manager_plan_path)
    locks_dir = Path(args.locks_dir)

    try:
        plan = load_json(manager_plan_path)
        locks, manifest = compile_manager_plan(plan)

        locks_dir.mkdir(parents=True, exist_ok=True)
        for lock in locks:
            lock_path = locks_dir / f"{lock['workerId']}.role-lock.json"
            write_json(lock_path, lock)

        if args.manifest_path:
            write_json(Path(args.manifest_path), manifest)
    except ValueError as exc:
        print(
            json.dumps(
                {
                    "status": "fail",
                    "reason": str(exc),
                    "managerPlanPath": str(manager_plan_path),
                    "locksDir": str(locks_dir),
                },
                sort_keys=True,
            )
        )
        return 1

    print(
        json.dumps(
            {
                "status": "pass",
                "managerPlanPath": str(manager_plan_path),
                "locksDir": str(locks_dir),
                "workerCount": len(locks),
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
