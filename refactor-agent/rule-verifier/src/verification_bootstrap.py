"""Bootstrap missing verification gates and generate failure manifests."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Dict, List


class VerificationBootstrap:
    def bootstrap(self, target_project_path: Path, discovery_report: Dict) -> Dict:
        created_files: List[str] = []
        local = set(discovery_report.get("local_gates", []))

        if "precommit" not in local:
            config = target_project_path / ".pre-commit-config.yaml"
            config.write_text(
                "repos:\n- repo: local\n  hooks:\n  - id: lint\n    name: lint\n    entry: python3 -m ruff check .\n    language: system\n",
                encoding="utf-8",
            )
            created_files.append(str(config))

        if not (target_project_path / "mypy.ini").exists():
            mypy_ini = target_project_path / "mypy.ini"
            mypy_ini.write_text("[mypy]\npython_version = 3.11\nignore_missing_imports = True\n", encoding="utf-8")
            created_files.append(str(mypy_ini))

        if not (target_project_path / "pyproject.toml").exists():
            pyproject = target_project_path / "pyproject.toml"
            pyproject.write_text("[tool.ruff]\nline-length = 100\n", encoding="utf-8")
            created_files.append(str(pyproject))

        failures = self._run_gates(target_project_path)
        manifest = {
            "target_project_path": str(target_project_path),
            "created_files": sorted(created_files),
            "failures": failures,
        }
        out = self._artifact_dir(target_project_path) / "verification-failure-manifest.json"
        out.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        return manifest

    def _run_gates(self, root: Path) -> List[Dict]:
        commands = [
            ("lint", ["python3", "-m", "ruff", "check", str(root)]),
            ("type", ["python3", "-m", "mypy", str(root)]),
            ("unit", ["python3", "-m", "pytest", "-q", str(root)]),
        ]
        failures: List[Dict] = []
        for gate, cmd in commands:
            try:
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
                if result.returncode != 0:
                    failures.append({"gate": gate, "command": " ".join(cmd), "stderr": result.stderr[:500]})
            except Exception as exc:
                failures.append({"gate": gate, "command": " ".join(cmd), "stderr": str(exc)})
        return failures

    def _artifact_dir(self, target_project_path: Path) -> Path:
        path = target_project_path / ".rule-verifier-artifacts"
        path.mkdir(parents=True, exist_ok=True)
        return path
