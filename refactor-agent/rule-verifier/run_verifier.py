#!/usr/bin/env python3
"""Verification-first refactor harness entrypoint."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).parent / "src"))

from failure_impact_mapper import FailureImpactMapper
from gate_discovery import GateDiscovery
from parser import build_capability_inventory, parse_agents_file
from pi_adapter import PiAdapter
from refactor_iteration_loop import RefactorIterationLoop
from reporter import Reporter
from rule_extractor import RuleExtractor
from scenario_generator import ScenarioGenerator
from strongdm_loop_policy import StrongDMLoopPolicy
from test_runner import TestExecutor, TestRunner
from verification_bootstrap import VerificationBootstrap


def load_config(config_path: Path) -> dict:
    if not config_path.exists():
        return {}
    with config_path.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle) or {}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verification-first refactor harness")
    parser.add_argument("file", nargs="?", help="Rules file path or target project path")
    parser.add_argument("--config", default="config.yaml")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--target-matrix")
    parser.add_argument("--iterations", type=int, default=2)

    parser.add_argument("--harness-init-pi-foundation", action="store_true")
    parser.add_argument("--harness-discover-gates", action="store_true")
    parser.add_argument("--harness-bootstrap-verification", action="store_true")
    parser.add_argument("--harness-map-failure-impact", action="store_true")
    parser.add_argument("--harness-generate-scenario-regression", action="store_true")
    parser.add_argument("--harness-iterate-refactor", action="store_true")
    parser.add_argument("--harness-matrix-acceptance", action="store_true")
    return parser.parse_args()


def _artifact_dir(target: Path) -> Path:
    path = target / ".rule-verifier-artifacts"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _write(target: Path, name: str, payload: dict) -> Path:
    path = _artifact_dir(target) / name
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return path


def _load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def run_harness_phase(args: argparse.Namespace, config: dict, harness_root: Path, target: Path) -> int:
    reporter = Reporter(config)

    if args.harness_init_pi_foundation:
        policy = StrongDMLoopPolicy().validate_sequence(["init_pi_foundation"])
        prompt = harness_root / "templates" / "strongdm_system_prompt.md"
        adapter = PiAdapter(harness_root, config)
        result = adapter.initialize(target, prompt)
        payload = {
            "settings_path": str(result.settings_path),
            "trace_path": str(result.trace_path),
            "policy_status": "pass" if policy.passed else "fail",
            "policy_details": policy.details,
            "pi_status": result.policy_status,
        }
        _write(target, "pi-foundation-status.json", payload)
        print("pi foundation initialized")
        return 0

    if args.harness_discover_gates:
        discovery = GateDiscovery().discover(target)
        GateDiscovery().write_report(target, discovery)
        print("gate discovery complete")
        return 0 if not discovery["parity_drift"] else 2

    if args.harness_bootstrap_verification:
        discovery = _load_json(_artifact_dir(target) / "gate-parity-report.json") or GateDiscovery().discover(target)
        VerificationBootstrap().bootstrap(target, discovery)
        print("verification bootstrap complete")
        return 0

    if args.harness_map_failure_impact:
        capabilities = build_capability_inventory(str(target))
        manifest = _load_json(_artifact_dir(target) / "verification-failure-manifest.json")
        mapper = FailureImpactMapper()
        risk_map = mapper.map_failures(target, manifest, capabilities)
        print(f"failure impact mapped: {len(risk_map.get('mappings', []))} entries")
        return 0 if not risk_map.get("unmapped_failures") else 2

    if args.harness_generate_scenario_regression:
        risk_map = _load_json(_artifact_dir(target) / "feature-risk-map.json")
        suite = ScenarioGenerator([], config).generate_from_risk_map(risk_map, target)
        run = TestRunner(config).run_scenario_suite(target, suite, seed=11)
        print(f"scenario suite complete: {run['total']} scenarios")
        return 0

    if args.harness_iterate_refactor:
        manifest = _load_json(_artifact_dir(target) / "verification-failure-manifest.json")
        scenario = _load_json(_artifact_dir(target) / "scenario-run-manifest.json")
        loop = RefactorIterationLoop(max_iterations=config.get("refactor_loop", {}).get("max_iterations", 4))
        status = loop.iterate(target, manifest, scenario)
        print("refactor convergence achieved" if status["all_green"] else "refactor convergence pending")
        return 0 if status["all_green"] else 2

    if args.harness_matrix_acceptance:
        if not args.target_matrix:
            raise ValueError("--target-matrix is required for matrix acceptance")
        matrix = yaml.safe_load(Path(args.target_matrix).read_text(encoding="utf-8")) or {}
        targets = matrix.get("targets", [])
        summary = {"targets": [], "all_green": True}
        for entry in targets:
            target_path = Path(entry["snapshot_path"])
            status = _load_json(_artifact_dir(target_path) / "refactor-iteration-status.json")
            all_green = bool(status.get("all_green", False))
            summary["targets"].append({"name": entry["name"], "all_green": all_green})
            if not all_green:
                summary["all_green"] = False
        reporter.write_matrix_acceptance(harness_root, summary)
        print("matrix acceptance complete")
        return 0 if summary["all_green"] else 2

    return 1


def run_legacy_flow(args: argparse.Namespace, config: dict) -> int:
    if not args.file:
        raise ValueError("file path is required")
    candidate = Path(args.file)
    if candidate.is_dir():
        for name in ("AGENTS.md", "CLAUDE.md"):
            probe = candidate / name
            if probe.exists():
                candidate = probe
                break
        else:
            raise ValueError("directory input must contain AGENTS.md or CLAUDE.md")
    parsed = parse_agents_file(str(candidate))
    rules = RuleExtractor(parsed).extract_rules()
    scenarios = ScenarioGenerator(rules, config).generate_scenarios()
    if args.dry_run:
        print("Dry run complete!")
        return 0
    execution = TestExecutor(config).execute_all(scenarios)
    print(f"Executed {execution['total_tests']} tests")
    return 0


def main() -> int:
    args = parse_args()
    harness_root = Path(__file__).resolve().parent
    config = load_config(harness_root / args.config)

    harness_flags = [
        args.harness_init_pi_foundation,
        args.harness_discover_gates,
        args.harness_bootstrap_verification,
        args.harness_map_failure_impact,
        args.harness_generate_scenario_regression,
        args.harness_iterate_refactor,
        args.harness_matrix_acceptance,
    ]

    if any(harness_flags):
        target = Path(args.file).resolve() if args.file else None
        if args.harness_matrix_acceptance:
            return run_harness_phase(args, config, harness_root, target or harness_root)
        if target is None:
            raise ValueError("Target project path is required")
        return run_harness_phase(args, config, harness_root, target)

    return run_legacy_flow(args, config)


if __name__ == "__main__":
    raise SystemExit(main())
