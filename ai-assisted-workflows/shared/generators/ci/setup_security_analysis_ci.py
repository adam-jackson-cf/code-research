#!/usr/bin/env python3
"""
Generate GitHub Actions workflow for Security Analysis using analyzers + renderer.

Outputs .github/workflows/codex-security-analysis.yml
 - Runs semgrep + detect-secrets via uv + Enaible project
 - Renders prioritized Markdown plan (security_priority.md) with strict markers
 - Uploads artifacts and applies fail gate (default: high)
 - Honors Semgrep config override via AAW_SEMGREP_CONFIGS env (dispatch input)
"""

from __future__ import annotations

import argparse
from pathlib import Path

DEFAULT_FAIL_ON = "high"
DEFAULT_MIN_SEVERITY = "low"


def _paths_block(includes: list[str]) -> str:
    base = [
        "'**/*.py'",
        "'**/*.js'",
        "'**/*.ts'",
        "'**/*.tsx'",
        "'**/*.jsx'",
        "'**/*.java'",
        "'**/*.go'",
        "'**/*.rs'",
        "'**/*.cpp'",
        "'**/*.c'",
        "'**/*.h'",
        "'**/*.hpp'",
        "'**/*.cs'",
        "'**/*.php'",
        "'**/*.rb'",
        "'**/*.json'",
        "'**/*.yml'",
        "'**/*.yaml'",
    ]
    merged = base + [
        f"'{g}'" if not (g.startswith("'") or g.startswith('"')) else g
        for g in includes
    ]
    return "\n      - ".join(dict.fromkeys(merged))


def _filters_yaml() -> str:
    return (
        "            code:\n"
        "              - '**/*.py'\n"
        "              - '**/*.js'\n"
        "              - '**/*.ts'\n"
        "              - '**/*.tsx'\n"
        "              - '**/*.jsx'\n"
        "              - '**/*.java'\n"
        "              - '**/*.go'\n"
        "              - '**/*.rs'\n"
        "              - '**/*.cpp'\n"
        "              - '**/*.c'\n"
        "              - '**/*.h'\n"
        "              - '**/*.hpp'\n"
        "              - '**/*.cs'\n"
        "              - '**/*.php'\n"
        "              - '**/*.rb'\n"
        "              - '**/*.json'\n"
        "              - '**/*.yml'\n"
        "              - '**/*.yaml'\n"
    )


def _generate_workflow(
    fail_on: str,
    min_sev: str,
    semgrep_default: str,
    paths_include: list[str],
    comment_on_pr: bool,
) -> str:
    paths_yaml = _paths_block(paths_include)
    comment_default = "true" if comment_on_pr else "false"
    semgrep_env = semgrep_default.strip()
    template = """name: Codex Security Analysis

on:
  pull_request:
    paths:
      - __PATHS__
  workflow_dispatch:
    inputs:
      fail-on:
        description: 'Severity that fails the job'
        required: false
        default: '__FAIL_ON__'
        type: choice
        options: [critical, high, medium, low]
      min-severity:
        description: 'Analyzer min severity to include'
        required: false
        default: '__MIN_SEV__'
        type: choice
        options: [critical, high, medium, low, info]
      semgrep-config:
        description: 'Comma/newline separated Semgrep configs (auto, p/*, r/*, path, or URL)'
        required: false
        default: '__SEMGREP_ENV__'
        type: string
      comment-on-pr:
        description: 'Post a PR summary comment'
        required: false
        default: __COMMENT_DEFAULT__
        type: boolean

jobs:
  security-analysis:
    runs-on: ubuntu-latest
    env:
      FAIL_ON_DEFAULT: '__FAIL_ON__'
      SEMGREP_DEFAULT_CONFIGS: '__SEMGREP_ENV__'
    steps:
      - name: Checkout
        uses: actions/checkout@8ade135a41bc03ea155e62e844d188df1ea18608 # v4.1.0

      - name: Setup uv
        uses: astral-sh/setup-uv@v2

      - name: Install tools in Enaible env
        run: |
          uv run --project tools/enaible python -m pip install --upgrade pip
          uv run --project tools/enaible python -m pip install semgrep detect-secrets

      - name: Detect changed code paths
        id: changes
        uses: dorny/paths-filter@de90cc6fb38fc0963ad72b210f1f284cd68cea36 # v3.0.2
        with:
          filters: |
{_filters_yaml()}

      - name: Prepare artifacts dir
        run: mkdir -p artifacts

      - name: Run security:semgrep
        if: steps.changes.outputs.code == 'true'
        env:
          AAW_SEMGREP_CONFIGS: ${{ inputs.semgrep-config || env.SEMGREP_DEFAULT_CONFIGS }}
        run: |
          PYTHONPATH=shared uv run --project tools/enaible \
            enaible analyzers run security:semgrep \
            --target . --min-severity ${{ inputs['min-severity'] || '__MIN_SEV__' }} \
            --out artifacts/security_semgrep.json

      - name: Run security:detect_secrets
        if: steps.changes.outputs.code == 'true'
        run: |
          PYTHONPATH=shared uv run --project tools/enaible \
            enaible analyzers run security:detect_secrets \
            --target . --min-severity ${{ inputs['min-severity'] || '__MIN_SEV__' }} \
            --out artifacts/security_secrets.json

      - name: Render prioritized Markdown plan
        if: steps.changes.outputs.code == 'true'
        run: |
          PYTHONPATH=shared uv run --project tools/enaible \
            enaible ci security-markdown artifacts --out security_priority.md

      - name: Upload artifacts
        if: steps.changes.outputs.code == 'true'
        uses: actions/upload-artifact@v4
        with:
          name: security-analysis-artifacts
          path: |
            artifacts/*.json
            security_priority.md

      - name: Gate on FAIL_ON
        if: steps.changes.outputs.code == 'true'
        env:
          FAIL_ON: ${{ inputs.fail-on || env.FAIL_ON_DEFAULT }}
        run: |
          sudo apt-get update && sudo apt-get install -y --no-install-recommends jq
          set -eo pipefail
          total_crit=0
          total_high=0
          for f in artifacts/*.json; do
            [ -f "$f" ] || continue
            crit=$(jq -r '.summary.critical // 0' "$f")
            high=$(jq -r '.summary.high // 0' "$f")
            total_crit=$((total_crit + crit))
            total_high=$((total_high + high))
          done
          echo "critical=$total_crit high=$total_high"
          case "$FAIL_ON" in
            critical) [ "$total_crit" -gt 0 ] && exit 1 || exit 0 ;;
            high)     [ $((total_crit+total_high)) -gt 0 ] && exit 1 || exit 0 ;;
            medium|low) exit 0 ;;
            *) echo "Unknown FAIL_ON: $FAIL_ON" >&2; exit 2 ;;
          esac

      - name: Comment summary on PR
        if: github.event_name == 'pull_request' && (inputs.comment-on-pr == true)
        uses: actions/github-script@60a0d83039c74a4aee543508d2ffcb1c3799cdea # v7.0.1
        env:
          FAIL_ON: ${{ inputs.fail-on || env.FAIL_ON_DEFAULT }}
        with:
          script: |
            const fs = require('fs');
            function readCount(p, key) {
              try { const j = JSON.parse(fs.readFileSync(p, 'utf8')); return (j.summary?.[key]) || 0; } catch { return 0; }
            }
            const files = ['artifacts/security_semgrep.json','artifacts/security_secrets.json'];
            let crit=0, high=0;
            for (const f of files) { if (fs.existsSync(f)) { crit += readCount(f,'critical'); high += readCount(f,'high'); } }
            const body = [
              '🔐 Security Analysis summary',
              '',
              `- Fail gate: ${process.env.FAIL_ON}`,
              `- Critical: ${crit}`,
              `- High: ${high}`,
              '',
              'Artifacts include security_priority.md with prioritized actions.'
            ].join('\n');
            await github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body
            });
"""

    replacements = {
        "__PATHS__": paths_yaml,
        "__FAIL_ON__": fail_on,
        "__MIN_SEV__": min_sev,
        "__SEMGREP_ENV__": semgrep_env,
        "__COMMENT_DEFAULT__": comment_default,
    }
    for placeholder, value in replacements.items():
        template = template.replace(placeholder, value)
    return template


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate Security Analysis GitHub Actions workflow"
    )
    parser.add_argument(
        "--fail-on",
        default=DEFAULT_FAIL_ON,
        choices=["critical", "high", "medium", "low"],
        help="Severity that fails the job",
    )
    parser.add_argument(
        "--min-severity",
        default=DEFAULT_MIN_SEVERITY,
        choices=["critical", "high", "medium", "low", "info"],
        help="Analyzer min severity filter",
    )
    parser.add_argument(
        "--semgrep-config",
        default="",
        help="Comma/newline separated Semgrep configs (auto, p/*, r/*, path, or URL)",
    )
    parser.add_argument(
        "--paths-include",
        action="append",
        default=[],
        help="Additional path globs to include in triggers",
    )
    parser.add_argument(
        "--exclude",
        action="append",
        default=[],
        help="(Reserved) Exclusions for future filtering",
    )
    parser.add_argument(
        "--comment-on-pr", default="true", help="Post summary PR comment (true/false)"
    )
    args = parser.parse_args()

    workflows = Path(".github/workflows")
    workflows.mkdir(parents=True, exist_ok=True)
    wf = workflows / "codex-security-analysis.yml"

    if wf.exists():
        backup = wf.with_suffix(".yml.bak")
        print(f"⚠️  Existing {wf} found. Backing up to {backup}")
        wf.rename(backup)

    comment_on_pr = str(args.comment_on_pr).lower() == "true"
    content = _generate_workflow(
        args.fail_on,
        args.min_severity,
        args.semgrep_config,
        args.paths_include,
        comment_on_pr,
    )
    wf.write_text(content, encoding="utf-8")

    print("✅ Created .github/workflows/codex-security-analysis.yml")
    print(f"   Fail-on: {args.fail_on}")
    print(f"   Min-severity: {args.min_severity}")
    print(f"   Semgrep default configs: {args.semgrep_config or 'auto'}")
    print(f"   Comment on PR: {comment_on_pr}")
    if args.paths_include:
        print(f"   Extra includes: {', '.join(args.paths_include)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
