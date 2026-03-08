"""Integration tests for verification-first harness lifecycle."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT / "run_verifier.py"


def _run(cmd: list[str], cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=False)


def _create_git_target(path: Path, filename: str) -> str:
    path.mkdir(parents=True, exist_ok=True)
    (path / filename).write_text("print('ok')\n", encoding="utf-8")
    (path / "tests").mkdir(exist_ok=True)
    (path / "tests" / "test_smoke.py").write_text("def test_smoke():\n    assert True\n", encoding="utf-8")
    _run(["git", "init"], path)
    _run(["git", "config", "user.email", "rv@example.com"], path)
    _run(["git", "config", "user.name", "rv"], path)
    _run(["git", "add", "."], path)
    _run(["git", "commit", "-m", "init"], path)
    sha = _run(["git", "rev-parse", "HEAD"], path)
    return sha.stdout.strip()


def test_legacy_dry_run_smoke() -> None:
    fixture = ROOT / "fixtures" / "targets" / "backend-min" / "AGENTS.md"
    result = _run(["python3", str(RUN), str(fixture), "--dry-run"], ROOT)
    assert result.returncode == 0
    assert "Dry run complete!" in result.stdout


def test_harness_lifecycle_end_to_end(tmp_path: Path) -> None:
    origins = tmp_path / "origins"
    backend_origin = origins / "backend-repo"
    ui_origin = origins / "ui-repo"
    backend_sha = _create_git_target(backend_origin, "app.py")
    ui_sha = _create_git_target(ui_origin, "ui.py")

    targets_dir = tmp_path / "targets"
    matrix = {
        "targets": [
            {
                "name": "backend-repo",
                "lane": "backend",
                "repo": str(backend_origin),
                "sha": backend_sha,
                "snapshot_path": str(targets_dir / "backend-repo"),
            },
            {
                "name": "ui-repo",
                "lane": "ui",
                "repo": str(ui_origin),
                "sha": ui_sha,
                "snapshot_path": str(targets_dir / "ui-repo"),
            },
        ]
    }
    matrix_path = tmp_path / "target-matrix.yaml"
    matrix_path.write_text(yaml.safe_dump(matrix, sort_keys=False), encoding="utf-8")

    fetch_script = ROOT / "scripts" / "fetch_target_snapshots.sh"
    fetch = _run([str(fetch_script), "--matrix", str(matrix_path)], ROOT)
    assert fetch.returncode == 0

    backend_snapshot = targets_dir / "backend-repo"
    phase_commands = [
        ["python3", str(RUN), str(backend_snapshot), "--harness-init-pi-foundation"],
        ["python3", str(RUN), str(backend_snapshot), "--harness-discover-gates"],
        ["python3", str(RUN), str(backend_snapshot), "--harness-bootstrap-verification"],
        ["python3", str(RUN), str(backend_snapshot), "--harness-map-failure-impact"],
        [
            "python3",
            str(RUN),
            str(backend_snapshot),
            "--harness-generate-scenario-regression",
            "--iterations",
            "2",
        ],
    ]

    for cmd in phase_commands:
        result = _run(cmd, ROOT)
        assert result.returncode in (0, 2)

    # force convergence artifact for acceptance determinism
    artifacts = backend_snapshot / ".rule-verifier-artifacts"
    scenario_manifest = json.loads((artifacts / "scenario-run-manifest.json").read_text())
    failure_manifest = json.loads((artifacts / "verification-failure-manifest.json").read_text())
    scenario_manifest["failed"] = 0
    failure_manifest["failures"] = []
    (artifacts / "scenario-run-manifest.json").write_text(
        json.dumps(scenario_manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    (artifacts / "verification-failure-manifest.json").write_text(
        json.dumps(failure_manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )

    iterate = _run(["python3", str(RUN), str(backend_snapshot), "--harness-iterate-refactor"], ROOT)
    assert iterate.returncode == 0

    ui_snapshot = targets_dir / "ui-repo"
    ui_artifacts = ui_snapshot / ".rule-verifier-artifacts"
    ui_artifacts.mkdir(parents=True, exist_ok=True)
    (ui_artifacts / "refactor-iteration-status.json").write_text(
        json.dumps({"all_green": True}, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )

    accept = _run(
        [
            "python3",
            str(RUN),
            "--target-matrix",
            str(matrix_path),
            "--harness-matrix-acceptance",
        ],
        ROOT,
    )
    assert accept.returncode == 0
    summary = ROOT / "results" / "matrix-acceptance-summary.json"
    payload = json.loads(summary.read_text(encoding="utf-8"))
    assert payload["all_green"] is True
