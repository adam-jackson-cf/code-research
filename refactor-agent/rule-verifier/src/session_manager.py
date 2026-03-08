"""Session manager with deterministic naming and bounded concurrency settings."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SessionPolicy:
    max_parallel_sessions: int


class SessionManager:
    def __init__(self, config):
        loop_cfg = config.get("refactor_loop", {}) if config else {}
        self.policy = SessionPolicy(max_parallel_sessions=int(loop_cfg.get("max_parallel_sessions", 2)))

    def stable_name(self, scenario_id: str, index: int) -> str:
        safe = scenario_id.replace("/", "_").replace(" ", "_")
        return f"rv_{safe}_{index:03d}"

    def max_parallel(self) -> int:
        return self.policy.max_parallel_sessions
