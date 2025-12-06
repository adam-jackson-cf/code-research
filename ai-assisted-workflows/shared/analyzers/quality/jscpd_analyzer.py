#!/usr/bin/env python3
"""
JSCPD Duplication Analyzer - Universal copy/paste detection via jscpd.

Runs the Node-based `jscpd` CLI through npx (or a locally vendored binary)
and maps its JSON report into our standardized finding schema.

Base profile dependency: Node + ESLint workspace now also hosts jscpd.
"""

from __future__ import annotations

import fnmatch
import json
import os
import shlex
import shutil
import subprocess
import tempfile
from collections.abc import Iterable
from pathlib import Path
from typing import Any

from core.base.analyzer_base import AnalyzerConfig, BaseAnalyzer
from core.base.analyzer_registry import register_analyzer


def _find_jscpd_binary(install_dir: Path | None = None) -> str | None:
    """Return a path or command that can execute jscpd.

    Preference order:
    1) Local vendored binary in <install_dir>/node_modules/.bin/jscpd
    2) Global npx jscpd
    3) Direct `jscpd` on PATH
    """
    if install_dir:
        candidate = (
            install_dir
            / "node_modules"
            / ".bin"
            / ("jscpd.cmd" if os.name == "nt" else "jscpd")
        )
        if candidate.exists():
            return str(candidate)

    if shutil.which("jscpd"):
        return "jscpd"

    # Prefer npx invocation if available
    if shutil.which("npx"):
        return "npx jscpd"

    return None


@register_analyzer("quality:jscpd")
class JSCPDAnalyzer(BaseAnalyzer):
    """Analyzer that shells out to jscpd and converts results to findings."""

    def __init__(
        self,
        config: AnalyzerConfig | None = None,
        *,
        min_tokens: int = 60,
        mode: str = "mild",
    ):
        super().__init__("quality", config)
        self.min_tokens = min_tokens
        self.mode = mode
        self._pair_count = 0
        self._fragment_count = 0

        # Optionally let callers hint a local node tools directory
        self.node_tools_dir = Path(
            os.environ.get("AAW_NODE_TOOLS_DIR", "")
            or Path.cwd() / ".claude" / "eslint"
        )

    def get_analyzer_metadata(self) -> dict[str, Any]:
        return {
            "name": "JSCPD Duplication Analyzer",
            "version": "1.0.0",
            "description": "Universal copy/paste detection using jscpd",
            "category": "quality",
            "priority": "medium",
            "jscpd_min_tokens": self.min_tokens,
            "jscpd_mode": self.mode,
            "clone_pairs_last_run": self._pair_count,
            "clone_fragments_last_run": self._fragment_count,
        }

    def analyze(self, target_path: str | None = None):  # type: ignore[override]
        self.start_analysis()
        analyze_path = target_path or self.config.target_path
        result = self.create_result("analysis")

        if not Path(analyze_path).exists():
            result.set_error(f"Target path not found: {analyze_path}")
            return self.complete_analysis(result)

        jscpd_bin = _find_jscpd_binary(
            self.node_tools_dir if self.node_tools_dir.exists() else None
        )
        if not jscpd_bin:
            result.set_error(
                "jscpd is not available. Ensure Node is installed and ESLint workspace set up, or run: \n"
                "  npm install -g jscpd\n"
            )
            return self.complete_analysis(result)

        with tempfile.TemporaryDirectory(prefix="jscpd-") as tmp:
            output_dir = Path(tmp)
            report_path = output_dir / "jscpd-report.json"
            cmd = self._build_jscpd_command(jscpd_bin, analyze_path, output_dir)

            try:
                p = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=300,
                )
            except subprocess.TimeoutExpired as e:
                result.set_error(f"jscpd timed out: {e}")
                return self.complete_analysis(result)

            # jscpd exits with non-zero when duplicates exceed threshold; we still want the report
            if not report_path.exists():
                stderr = (p.stderr or "").strip()
                stdout = (p.stdout or "").strip()
                result.set_error(
                    f"jscpd did not produce a report. stdout={stdout[:2000]} stderr={stderr[:2000]}"
                )
                return self.complete_analysis(result)

            try:
                data = json.loads(report_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError as e:
                result.set_error(f"Failed to parse jscpd JSON report: {e}")
                return self.complete_analysis(result)

            findings = self._convert_jscpd_to_findings(data)
            self._fragment_count = len(findings)
            files = self.scan_directory(analyze_path)
            self._add_findings_to_result(result, findings)
            self._add_metadata_to_result(result, analyze_path, files, findings)
            return self.complete_analysis(result)

    # BaseAnalyzer contract (unused: jscpd runs once for the whole target)
    def analyze_target(self, target_path: str) -> list[dict[str, Any]]:  # type: ignore[override]
        return []

    def _convert_jscpd_to_findings(self, data: dict[str, Any]) -> list[dict[str, Any]]:
        findings: list[dict[str, Any]] = []
        duplicates = data.get("duplicates", []) or []
        clone_pairs: set[tuple[str, str]] = set()
        for dup in duplicates:
            fragment_a = dup.get("firstFile", {})
            fragment_b = dup.get("secondFile", {})
            tokens = dup.get("tokens", 0)
            format_name = dup.get("format", "unknown")
            lines = dup.get("lines", 0)

            a_path = fragment_a.get("name") or fragment_a.get("file") or "unknown"
            b_path = fragment_b.get("name") or fragment_b.get("file") or "unknown"
            a_start = int(fragment_a.get("start", 1))
            b_start = int(fragment_b.get("start", 1))
            a_end = int(fragment_a.get("end", a_start))
            b_end = int(fragment_b.get("end", b_start))

            if not self._should_include_duplicate_path(a_path):
                continue
            if not self._should_include_duplicate_path(b_path):
                continue

            key = tuple(
                sorted(
                    [
                        f"{a_path}:{a_start}-{a_end}",
                        f"{b_path}:{b_start}-{b_end}",
                    ]
                )
            )
            clone_pairs.add(key)

            title = "Duplicate Code Block"
            description = f"Code block duplicated between {a_path}:{a_start} and {b_path}:{b_start}"
            recommendation = "Consider extracting shared logic into a function/module to remove duplication."
            meta = {
                "tokens": tokens,
                "lines": lines,
                "format": format_name,
                "match": {
                    "a": {
                        "path": a_path,
                        "start": a_start,
                        "end": a_end,
                    },
                    "b": {
                        "path": b_path,
                        "start": b_start,
                        "end": b_end,
                    },
                },
            }

            findings.append(
                {
                    "title": title,
                    "description": description,
                    "severity": "low",
                    "file_path": a_path,
                    "line_number": a_start,
                    "recommendation": recommendation,
                    "metadata": meta,
                }
            )
            findings.append(
                {
                    "title": title,
                    "description": description,
                    "severity": "low",
                    "file_path": b_path,
                    "line_number": b_start,
                    "recommendation": recommendation,
                    "metadata": meta,
                }
            )
        self._pair_count = len(clone_pairs)
        return findings

    def _should_include_duplicate_path(self, raw_path: str) -> bool:
        """Determine whether a duplicate path should be retained."""
        path_obj = Path(raw_path)
        if not path_obj.is_absolute():
            candidate = (self.analysis_root / path_obj).resolve(strict=False)
        else:
            candidate = path_obj.resolve(strict=False)

        if candidate.exists():
            return self.should_scan_file(candidate)

        candidate_str = str(candidate)
        relative_str = self._relative_path_str(candidate)

        for skip in self.config.skip_patterns:
            if skip in candidate.parts or skip in relative_str or skip in candidate_str:
                return False

        if self._exclude_globs and any(
            fnmatch.fnmatch(candidate_str, pattern)
            or fnmatch.fnmatch(relative_str, pattern)
            for pattern in self._exclude_globs
        ):
            return False

        if self._gitignore_spec:
            return not (
                self._gitignore_spec.match_file(candidate_str)
                or self._gitignore_spec.match_file(relative_str)
            )

        return True

    def _iter_ignore_patterns(self) -> Iterable[str]:
        """Yield ignore glob patterns for the jscpd invocation."""
        seen: set[str] = set()

        for pattern in getattr(self.config, "exclude_globs", set()):
            if pattern and pattern not in seen:
                seen.add(pattern)
                yield pattern

        for skip in self.config.skip_patterns:
            sanitized = skip.strip("/")
            candidates = {
                sanitized,
                f"**/{sanitized}",
                f"**/{sanitized}/**",
            }
            for candidate in candidates:
                if candidate and candidate not in seen:
                    seen.add(candidate)
                    yield candidate

    def _build_jscpd_command(
        self, jscpd_bin: str, analyze_path: str, output_dir: Path
    ) -> list[str]:
        """Construct the jscpd command with ignore arguments."""
        cmd = shlex.split(jscpd_bin)
        cmd.extend(
            [
                "--reporters",
                "json",
                "--output",
                str(output_dir),
                "--min-tokens",
                str(self.min_tokens),
                "--mode",
                self.mode,
                "--gitignore",
            ]
        )

        for pattern in self._iter_ignore_patterns():
            cmd.extend(["--ignore", pattern])

        cmd.append(analyze_path)
        return cmd
