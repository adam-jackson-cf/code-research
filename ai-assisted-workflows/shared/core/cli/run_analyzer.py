#!/usr/bin/env python3
"""
Registry-Driven Analyzer Runner (CLI).

Single entrypoint to run any registered analyzer by registry key.

Usage examples (ensure PYTHONPATH points to the scripts root):
  python -m core.cli.run_analyzer --analyzer quality:lizard --target . --output-format json
  python -m core.cli.run_analyzer --analyzer security:semgrep --target . --output-format json --min-severity medium
"""

from __future__ import annotations

import argparse
import contextlib
import sys

# Python version check
import core.base.registry_bootstrap  # noqa: F401 - registers analyzers via side effects
from core.base import AnalyzerRegistry, create_analyzer_config
from core.utils.output_formatter import ResultFormatter


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run a registered analyzer by key")
    parser.add_argument(
        "--analyzer",
        required=True,
        help="Registry key of analyzer to run (e.g., quality:lizard)",
    )
    parser.add_argument(
        "--target",
        default=".",
        help="Path to analyze (file or directory)",
    )
    parser.add_argument(
        "--output-format",
        choices=["json", "console"],
        default="json",
        help="Output format",
    )
    parser.add_argument(
        "--min-severity",
        choices=["critical", "high", "medium", "low", "info"],
        default="low",
        help="Minimum severity level to include",
    )
    parser.add_argument(
        "--max-files",
        type=int,
        help="Maximum number of files to analyze",
    )
    parser.add_argument(
        "--summary",
        action="store_true",
        help="Summary mode (limit output to most important findings)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose analyzer logging (if supported)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)

    try:
        cfg = create_analyzer_config(
            target_path=args.target,
            max_files=args.max_files,
            min_severity=args.min_severity,
            summary_mode=args.summary,
            output_format=args.output_format,
        )

        analyzer = AnalyzerRegistry.create(args.analyzer, config=cfg)

        # Some analyzers may honor a verbose attribute
        if hasattr(analyzer, "verbose"):
            with contextlib.suppress(Exception):
                analyzer.verbose = bool(args.verbose)

        result = analyzer.analyze(args.target)

        if args.output_format == "console":
            print(ResultFormatter.format_console_output(result))
        else:
            print(
                result.to_json(
                    indent=2, summary_mode=args.summary, min_severity=args.min_severity
                )
            )
        sys.stdout.flush()

        return 0 if result.success else 1

    except KeyError as e:
        print(f"Analyzer not found: {e}", file=sys.stderr)
        return 2
    except Exception as e:
        print(f"Analyzer run failed: {e}", file=sys.stderr)
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
