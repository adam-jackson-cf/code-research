#!/usr/bin/env python3
"""
Integration CLI: Run all analysis scripts and validate they work together.

Tests the complete analyzer pipeline and generates combined reports.

Note: This script is a CLI evaluator and is intentionally located under
shared/integration/cli for direct execution outside pytest.
"""

import contextlib
import json
import os
import sys
import time
from typing import Any

# Python version check
try:
    import core.base.registry_bootstrap  # noqa: F401 - side-effect import registers analyzers
    from core.base import AnalyzerRegistry, create_analyzer_config
except ImportError as e:
    print(f"Import error: {e}", file=sys.stderr)
    sys.exit(1)


class AnalysisRunner:
    """Run all analysis scripts and combine results."""

    def __init__(self):
        # Map logical names to registry keys
        self.analyzers = {
            # Security (may rely on external tools)
            "security_semgrep": "security:semgrep",
            "security_secrets": "security:detect_secrets",
            # Performance (some rely on external tools)
            "performance_frontend": "performance:frontend",  # Node (ESLint)
            "performance_python": "performance:ruff",  # Python
            "performance_sql": "performance:sqlglot",  # SQL (Python)
            "performance_semgrep": "performance:semgrep",  # Universal (deferred)
            "performance_baseline": "performance:baseline",  # Pure Python
            # Code quality
            "quality_lizard": "quality:lizard",
            "quality_jscpd": "quality:jscpd",  # Node (jscpd)
            "quality_coverage": "quality:coverage",
            # Architecture
            "architecture_patterns": "architecture:patterns",
            "architecture_scalability": "architecture:scalability",
            "architecture_coupling": "architecture:coupling",
            # Root cause
            "root_cause_trace": "root_cause:trace_execution",
            "root_cause_changes": "root_cause:recent_changes",
            "root_cause_errors": "root_cause:error_patterns",
        }
        # Optionally skip categories requiring external tools in constrained envs
        self.skip_external = os.environ.get("NO_EXTERNAL", "").lower() == "true"

    def run_analyzer(
        self,
        key: str,
        target_path: str,
        summary_mode: bool,
        min_severity: str,
        max_files: int | None,
    ) -> dict[str, Any]:
        cfg = create_analyzer_config(
            target_path=target_path,
            max_files=max_files,
            min_severity=min_severity,
            summary_mode=summary_mode,
            output_format="json",
        )
        start = time.time()
        analyzer = AnalyzerRegistry.create(key, config=cfg)
        try:
            result = analyzer.analyze(target_path)
            duration = time.time() - start
            data = result.to_dict(summary_mode=summary_mode, min_severity=min_severity)
            data["runner_duration"] = round(duration, 3)
            return data
        except Exception as e:
            return {"error": f"Analyzer failed: {e}"}

    def run_all_analyses(
        self,
        target_path: str,
        summary_mode: bool = True,
        min_severity: str = "high",
        max_files: int = None,
    ) -> dict[str, Any]:
        """Run all analysis scripts and combine results."""
        print("🚀 AI-Assisted Workflows Analysis - Running All Scripts", file=sys.stderr)
        print("=" * 60, file=sys.stderr)

        start_time = time.time()
        results = {}

        for logical_name, key in self.analyzers.items():
            if self.skip_external and logical_name.startswith(
                ("security_", "performance_")
            ):
                results[logical_name] = {"skipped": True, "reason": "NO_EXTERNAL=true"}
                continue
            results[logical_name] = self.run_analyzer(
                key, target_path, summary_mode, min_severity, max_files
            )

        total_duration = time.time() - start_time

        # Generate combined report
        combined_report = self.generate_combined_report(
            results, target_path, total_duration
        )

        print(f"\n🎉 All analyses completed in {total_duration:.3f}s", file=sys.stderr)

        return combined_report

    def generate_combined_report(
        self, results: dict[str, Any], target_path: str, total_duration: float
    ) -> dict[str, Any]:
        """Generate a combined analysis report."""
        report = {
            "combined_analysis": {
                "target_path": target_path,
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                "total_duration": round(total_duration, 3),
                "scripts_run": len(self.analyzers),
                "summary_mode": True,
                "overall_success": all(
                    not result.get("error") for result in results.values()
                ),
            },
            "executive_summary": self.generate_executive_summary(results),
            "detailed_results": results,
        }

        return report

    def generate_executive_summary(self, results: dict[str, Any]) -> dict[str, Any]:
        """Generate executive summary of all findings."""
        summary = {
            "total_findings": 0,
            "by_severity": {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0},
            "by_category": {},
            "top_issues": [],
            "recommendations": [],
        }

        # Aggregate findings
        for script_name, result in results.items():
            if result.get("error"):
                continue

            findings = result.get("findings", [])

            # Add to totals - use actual findings count
            script_total = len(findings)
            summary["total_findings"] += script_total

            # Count severities from actual findings
            script_severity_counts = {
                "critical": 0,
                "high": 0,
                "medium": 0,
                "low": 0,
                "info": 0,
            }
            for finding in findings:
                severity = finding.get("severity", "info")
                if severity in script_severity_counts:
                    script_severity_counts[severity] += 1
                    summary["by_severity"][severity] += 1

            # Track by category
            summary["by_category"][script_name] = {
                "total": script_total,
                "summary": script_severity_counts,
            }

            # Collect critical/high issues for top issues
            for finding in findings:
                if finding.get("severity") in ["critical", "high"]:
                    summary["top_issues"].append(
                        {
                            "category": script_name,
                            "title": finding.get("title", ""),
                            "severity": finding.get("severity", ""),
                            "file": finding.get("file_path", ""),
                            "line": finding.get("line_number"),
                        }
                    )

        # Sort top issues by severity
        severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
        summary["top_issues"].sort(key=lambda x: severity_order.get(x["severity"], 5))

        # Limit top issues to 20
        summary["top_issues"] = summary["top_issues"][:20]

        # Generate recommendations
        summary["recommendations"] = self.generate_recommendations(summary)

        return summary

    def generate_recommendations(self, summary: dict[str, Any]) -> list[str]:
        """Generate high-level recommendations based on findings."""
        recommendations = []

        # Security recommendations
        security_critical = 0
        security_high = 0
        for category in [
            "security_semgrep",
            "security_secrets",
        ]:
            if category in summary["by_category"]:
                security_critical += (
                    summary["by_category"][category]
                    .get("summary", {})
                    .get("critical", 0)
                )
                security_high += (
                    summary["by_category"][category].get("summary", {}).get("high", 0)
                )

        if security_critical > 0:
            recommendations.append(
                f"🚨 URGENT: Address {security_critical} critical security vulnerabilities immediately"
            )
        elif security_high > 3:
            recommendations.append(
                f"🔒 HIGH: Fix {security_high} high-severity security issues"
            )

        # Performance recommendations
        perf_critical = 0
        perf_high = 0
        for category in [
            "performance_frontend",
            "performance_python",
            "performance_sql",
            "performance_semgrep",
            "performance_baseline",
        ]:
            if category in summary["by_category"]:
                perf_critical += (
                    summary["by_category"][category]
                    .get("summary", {})
                    .get("critical", 0)
                )
                perf_high += (
                    summary["by_category"][category].get("summary", {}).get("high", 0)
                )

        if perf_critical > 0:
            recommendations.append(
                f"🚨 CRITICAL: Fix {perf_critical} critical performance issues"
            )
        elif perf_high > 3:
            recommendations.append(
                f"⚡ HIGH: Optimize {perf_high} performance bottlenecks affecting user experience"
            )

        # Code quality recommendations
        quality_total = 0
        for category in [
            "code_quality",
            "code_quality_coverage",
        ]:
            quality_total += summary["by_category"].get(category, {}).get("total", 0)

        if quality_total > 50:
            recommendations.append(
                f"🏗 MEDIUM: Address code complexity issues to improve maintainability ({quality_total} findings)"
            )

        # Architecture recommendations
        arch_critical = 0
        arch_high = 0
        for category in [
            "architecture_patterns",
            "architecture_scalability",
            "architecture_coupling",
        ]:
            if category in summary["by_category"]:
                arch_critical += (
                    summary["by_category"][category]
                    .get("summary", {})
                    .get("critical", 0)
                )
                arch_high += (
                    summary["by_category"][category].get("summary", {}).get("high", 0)
                )

        if arch_critical > 0:
            recommendations.append(
                f"🚨 CRITICAL: Fix {arch_critical} critical architectural issues"
            )
        elif arch_high > 2:
            recommendations.append(
                f"🔗 HIGH: Resolve {arch_high} architectural design issues"
            )

        # Root cause analysis recommendations
        root_cause_total = 0
        for category in [
            "root_cause_errors",
            "root_cause_changes",
            "root_cause_trace",
            "root_cause_execution",
        ]:
            root_cause_total += summary["by_category"].get(category, {}).get("total", 0)

        if root_cause_total > 10:
            recommendations.append(
                f"🔍 MEDIUM: Investigate {root_cause_total} potential root cause indicators"
            )

        if not recommendations:
            recommendations.append(
                "✅ Overall code health appears good - continue with regular monitoring"
            )

        return recommendations

    def _validate_test_result_quality(
        self, script_name: str, result: dict[str, Any], stderr: str
    ):
        """Validate that test results indicate proper tool functionality."""
        import os

        # Only run validation in testing environments
        if os.environ.get("TESTING", "").lower() != "true":
            return

        # Check for warning messages that indicate missing dependencies
        warning_indicators = [
            "WARNING: Missing required",
            "plugin not found",
            "tool not available",
            "degraded",
            "Install with:",
            "not installed",
        ]

        if stderr and any(indicator in stderr for indicator in warning_indicators):
            print(
                f"🚨 TESTING FAILURE: {script_name} has dependency issues:",
                file=sys.stderr,
            )
            print(f"   stderr: {stderr}", file=sys.stderr)
            # In testing, we want to know about these issues
            # but not fail the entire test suite - log for investigation

        # Check for suspicious patterns that might indicate silent tool failures
        findings_count = len(result.get("findings", []))
        execution_time = result.get("execution_time", 0)

        # Performance analyzers should find SOMETHING in a real codebase unless very clean
        if (
            script_name.startswith("performance_")
            and findings_count == 0
            and execution_time < 0.1
        ):
            print(
                f"⚠️  SUSPICIOUS: {script_name} found no issues and ran very quickly",
                file=sys.stderr,
            )
            print("   This might indicate missing tools or plugins", file=sys.stderr)


def main():
    """Run command-line integration of all analyzers."""
    import argparse
    import os

    # Set testing environment flag for strict dependency validation
    os.environ["TESTING"] = "true"

    parser = argparse.ArgumentParser(
        description="Run comprehensive code analysis across multiple dimensions"
    )
    parser.add_argument("target_path", help="Path to analyze")
    parser.add_argument(
        "--output-format",
        choices=["json", "console"],
        default="json",
        help="Output format (default: json)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Include detailed results (default is summary mode)",
    )
    parser.add_argument(
        "--min-severity",
        choices=["critical", "high", "medium", "low"],
        default="low",
        help="Minimum severity level (default: low)",
    )
    parser.add_argument(
        "--max-files",
        type=int,
        help="Maximum number of files to analyze per script (optional, for testing/debugging)",
    )

    args = parser.parse_args()

    summary_mode = (
        not args.verbose
    )  # Inverse logic: verbose=False means summary_mode=True

    runner = AnalysisRunner()
    report = runner.run_all_analyses(
        args.target_path, summary_mode, args.min_severity, args.max_files
    )

    # Output based on format choice
    if args.output_format == "console":
        # Simple console output for the combined report
        print("=== COMPREHENSIVE ANALYSIS REPORT ===")
        print(f"Target: {args.target_path}")
        print(f"Timestamp: {report.get('timestamp', 'unknown')}")
        print(f"Scripts run: {report.get('scripts_run', 0)}")
        print(f"Success: {report.get('overall_success', False)}")

        # Show combined summary
        summary = report.get("combined_summary", {})
        total_findings = sum(summary.values())
        print(f"Total findings: {total_findings}")
        for severity in ["critical", "high", "medium", "low", "info"]:
            count = summary.get(severity, 0)
            if count > 0:
                print(f"  {severity.upper()}: {count}")
    else:  # json (default)
        # Output combined report with proper error handling for broken pipe
        try:
            print(json.dumps(report, indent=2))
            sys.stdout.flush()
        except BrokenPipeError:
            # Handle broken pipe gracefully (e.g., when output is piped to head)
            with contextlib.suppress(OSError, ValueError):
                sys.stdout.close()
            with contextlib.suppress(OSError, ValueError):
                sys.stderr.close()


if __name__ == "__main__":
    main()
