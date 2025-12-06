#!/usr/bin/env python3
"""
Root Cause Execution Tracer - High-level execution path and dependency analysis.

PURPOSE: Analyzes codebase structure to provide investigation pointers for debugging.
Part of the shared/analyzers/root_cause suite using BaseAnalyzer infrastructure.

APPROACH:
- High-level execution pattern analysis
- Dependency structure identification
- Investigation pointer generation
- Error handling coverage assessment
- Complexity hotspot identification

EXTENDS: BaseAnalyzer for common analyzer infrastructure
- Inherits file scanning, CLI, configuration, and result formatting
- Implements execution-specific analysis logic in analyze_target()
- Uses shared timing, logging, and error handling patterns
"""

import re
import sys
from pathlib import Path
from typing import Any

# Import base analyzer (package root must be on PYTHONPATH)
from core.base.analyzer_base import AnalyzerConfig, BaseAnalyzer
from core.base.analyzer_registry import register_analyzer


@register_analyzer("root_cause:trace_execution")
class ExecutionTraceAnalyzer(BaseAnalyzer):
    """Analyzes execution patterns and provides investigation pointers for debugging."""

    def __init__(self, config: AnalyzerConfig | None = None, error_info: str = ""):
        # Create execution-specific configuration
        trace_config = config or AnalyzerConfig(
            code_extensions={
                ".py",
                ".js",
                ".jsx",
                ".ts",
                ".tsx",
                ".java",
                ".cs",
                ".cpp",
                ".c",
                ".h",
                ".hpp",
                ".go",
                ".rs",
                ".php",
                ".rb",
                ".swift",
                ".kt",
                ".scala",
            },
            skip_patterns={
                "node_modules",
                ".git",
                "__pycache__",
                ".pytest_cache",
                "build",
                "dist",
                ".next",
                ".nuxt",
                "coverage",
                "venv",
                "env",
                ".env",
                "vendor",
                "logs",
                "target",
                ".vscode",
                ".idea",
                "*.min.js",
                "*.bundle.js",
            },
        )

        # Store error information for targeted analysis
        self.error_info = error_info

        # Initialize base analyzer
        super().__init__("root_cause", trace_config)

        # Simple patterns for basic component identification
        self.patterns = {
            "main_functions": [r"def main\(", r'if __name__ == ["\']__main__["\']'],
            "classes": [r"class \w+"],
            "functions": [r"def \w+\("],
            "imports": [r"import \w+", r"from \w+ import"],
            "try_blocks": [r"try:"],
            "for_loops": [r"for \w+ in"],
            "api_routes": [r"@app\.route", r"app\.(get|post|put|delete)"],
        }

    def get_analyzer_metadata(self) -> dict[str, Any]:
        """Return metadata about this analyzer."""
        return {
            "name": "Execution Trace Analyzer",
            "version": "2.0.0",
            "description": "Analyzes execution patterns and provides investigation pointers for debugging",
            "category": "root_cause",
            "priority": "medium",
            "capabilities": [
                "High-level execution pattern analysis",
                "Dependency structure identification",
                "Investigation pointer generation",
                "Error handling coverage assessment",
                "Complexity hotspot identification",
                "Multi-language pattern recognition",
            ],
            "supported_formats": list(self.config.code_extensions),
        }

    def analyze_target(self, target_path: str) -> list[dict[str, Any]]:
        """
        Analyze a single file for execution patterns related to a specific error.

        Args:
            target_path: Path to file to analyze

        Returns
        -------
            List of findings with standardized structure
        """
        # REQUIRED: Must have error information to investigate
        if not self.error_info:
            return [
                {
                    "title": "Error Information Required",
                    "description": "Root cause analysis requires an error message or issue to investigate. Please provide: error message, stack trace, or specific issue description.",
                    "severity": "critical",
                    "file_path": target_path,
                    "line_number": 0,
                    "recommendation": "Run with --error parameter: python trace_execution.py --error 'your error message here'",
                    "metadata": {
                        "error_type": "missing_error_context",
                        "confidence": "high",
                    },
                }
            ]

        all_findings = []
        file_path = Path(target_path)

        # Parse the error to understand what we're investigating
        error_context = self.parse_error(self.error_info)

        # Only analyze files related to the error
        normalized_target = str(file_path).replace("\\", "/")

        # Skip files not related to the error
        if error_context.get("file"):
            error_file = error_context["file"].replace("\\", "/")
            # Allow exact match or if error file is contained in target path
            if error_file not in normalized_target and not any(
                part in normalized_target for part in error_file.split("/")
            ):
                return []  # Skip unrelated files

        try:
            with open(file_path, encoding="utf-8", errors="ignore") as f:
                content = f.read()

            # Skip very large files
            if len(content) > 100000:  # 100KB limit
                return all_findings

            # Analyze file structure with error context
            file_info = self._analyze_file_structure(content, str(file_path))

            # Generate targeted investigation pointers
            pointers = self._generate_targeted_investigation_pointers(
                file_info, str(file_path), error_context
            )

            # Convert pointers to findings
            for pointer in pointers:
                severity_map = {
                    "critical": "critical",
                    "high": "high",
                    "medium": "medium",
                    "low": "low",
                    "info": "info",
                }

                finding = {
                    "title": pointer["type"].replace("_", " ").title(),
                    "description": pointer["description"],
                    "severity": severity_map.get(pointer["severity"], "medium"),
                    "file_path": str(file_path),
                    "line_number": pointer.get("line_number", 0),
                    "recommendation": pointer["investigation_focus"],
                    "metadata": {
                        "pointer_type": pointer["type"],
                        "investigation_focus": pointer["investigation_focus"],
                        "evidence": pointer.get("evidence", {}),
                        "confidence": "medium",
                    },
                }
                all_findings.append(finding)

        except Exception as e:
            all_findings.append(
                {
                    "title": "File Analysis Error",
                    "description": f"Could not analyze file: {str(e)}",
                    "severity": "low",
                    "file_path": str(file_path),
                    "line_number": 0,
                    "recommendation": "Check file encoding and permissions.",
                    "metadata": {"error_type": "file_read_error", "confidence": "high"},
                }
            )

        return all_findings

    def _analyze_file_structure(self, content: str, file_path: str) -> dict[str, Any]:
        """Analyze single file structure for patterns."""
        lines = content.split("\n")
        file_info = {
            "total_lines": len(lines),
            "code_lines": len(
                [
                    line
                    for line in lines
                    if line.strip() and not line.strip().startswith("#")
                ]
            ),
            "blank_lines": len([line for line in lines if not line.strip()]),
            "comment_lines": len(
                [line for line in lines if line.strip().startswith("#")]
            ),
        }

        # Count patterns in the content
        for pattern_name, patterns in self.patterns.items():
            count = 0
            for pattern in patterns:
                matches = re.findall(pattern, content)
                count += len(matches)
            file_info[pattern_name] = count

        return file_info

    def _generate_investigation_pointers(
        self, file_info: dict[str, Any], file_path: str
    ) -> list[dict[str, Any]]:
        """Generate investigation pointers based on file analysis."""
        pointers = []

        # Check for missing main functions
        if file_info.get("main_functions", 0) == 0 and file_path.endswith(".py"):
            pointers.append(
                {
                    "type": "no_entry_points",
                    "severity": "medium",
                    "description": "No main functions or entry points found in Python file",
                    "investigation_focus": "Identify application startup and entry points",
                    "evidence": {"main_functions": file_info.get("main_functions", 0)},
                }
            )

        # Check for error handling coverage
        total_functions = file_info.get("functions", 0)
        try_blocks = file_info.get("try_blocks", 0)
        if total_functions > 3 and try_blocks < (total_functions * 0.3):
            pointers.append(
                {
                    "type": "low_error_handling",
                    "severity": "high",
                    "description": f"Only {try_blocks} try blocks for {total_functions} functions",
                    "investigation_focus": "Review error handling and exception management",
                    "evidence": {
                        "functions": total_functions,
                        "try_blocks": try_blocks,
                    },
                }
            )

        # Check for complex files
        code_lines = file_info.get("code_lines", 0)
        if code_lines > 200:
            pointers.append(
                {
                    "type": "complex_file",
                    "severity": "medium",
                    "description": f"File has {code_lines} lines of code, indicating high complexity",
                    "investigation_focus": "Review complex file for potential issues and refactoring opportunities",
                    "evidence": {"code_lines": code_lines},
                }
            )

        # Check for API endpoints
        api_routes = file_info.get("api_routes", 0)
        if api_routes > 0:
            pointers.append(
                {
                    "type": "web_application_detected",
                    "severity": "info",
                    "description": f"Found {api_routes} API routes in file",
                    "investigation_focus": "Review web application structure and routing",
                    "evidence": {"api_routes": api_routes},
                }
            )

        # Check for low test coverage indicators
        if (
            file_info.get("classes", 0) > 0
            and file_info.get("functions", 0) > 5
            and ("test" not in file_path.lower() and try_blocks < 2)
        ):
            pointers.append(
                {
                    "type": "potential_testing_gap",
                    "severity": "medium",
                    "description": "Complex file with multiple classes/functions but minimal error handling",
                    "investigation_focus": "Consider adding comprehensive testing and error handling",
                    "evidence": {
                        "classes": file_info.get("classes", 0),
                        "functions": file_info.get("functions", 0),
                    },
                }
            )

        return pointers

    def parse_error(self, error_info: str) -> dict[str, Any]:
        """Parse error information to extract actionable context."""
        if not error_info:
            return {}

        error_context = {
            "error_type": "unknown",
            "message": error_info,
            "file": None,
            "line": None,
        }

        # JavaScript/TypeScript error patterns
        js_error_pattern = r"(\w+Error): (.+?) at (.+?):(\d+)"
        js_match = re.search(js_error_pattern, error_info)
        if js_match:
            error_context.update(
                {
                    "error_type": js_match.group(1),
                    "message": js_match.group(2),
                    "file": js_match.group(3),
                    "line": int(js_match.group(4)),
                }
            )

        # Python error patterns
        python_error_pattern = r'File "(.+?)", line (\d+).+\n\s*(.+)'
        python_match = re.search(python_error_pattern, error_info, re.MULTILINE)
        if python_match:
            error_context.update(
                {
                    "file": python_match.group(1),
                    "line": int(python_match.group(2)),
                    "message": python_match.group(3),
                }
            )

        # General file:line pattern
        general_pattern = r"([a-zA-Z_./\\]+\.\w+):?(\d+)?"
        general_match = re.search(general_pattern, error_info)
        if general_match and not error_context["file"]:
            error_context["file"] = general_match.group(1)
            if general_match.group(2):
                error_context["line"] = int(general_match.group(2))

        return error_context

    def _generate_targeted_investigation_pointers(
        self, file_info: dict, file_path: str, error_context: dict[str, Any]
    ) -> list[dict[str, Any]]:
        """Generate investigation pointers focused on the specific error."""
        pointers = []

        # If we have a specific error line, focus analysis around it
        if error_context.get("line"):
            error_line = error_context["line"]

            # Check function structure around error line
            total_functions = file_info.get("functions", 0)
            if total_functions > 0:
                pointers.append(
                    {
                        "type": "error_context_analysis",
                        "severity": "high",
                        "description": f"Error occurred at line {error_line} in file with {total_functions} functions",
                        "investigation_focus": f"Focus investigation on function containing line {error_line} and its callers",
                        "evidence": {
                            "error_line": error_line,
                            "total_functions": total_functions,
                            "error_type": error_context.get("error_type", "unknown"),
                        },
                    }
                )

        # Check error handling around the issue
        try_blocks = file_info.get("try_blocks", 0)
        total_functions = file_info.get("functions", 0)

        if total_functions > 0 and try_blocks == 0:
            pointers.append(
                {
                    "type": "missing_error_handling",
                    "severity": "high",
                    "description": f"No error handling found in file where {error_context.get('error_type', 'error')} occurred",
                    "investigation_focus": "Add error handling to prevent similar failures",
                    "evidence": {
                        "try_blocks": try_blocks,
                        "functions": total_functions,
                        "error_type": error_context.get("error_type"),
                    },
                }
            )

        # Check for complexity that might contribute to errors
        if total_functions > 10:
            pointers.append(
                {
                    "type": "complex_file_analysis",
                    "severity": "medium",
                    "description": f"Error occurred in complex file with {total_functions} functions",
                    "investigation_focus": "Review file complexity and consider refactoring to reduce error likelihood",
                    "evidence": {
                        "functions": total_functions,
                        "classes": file_info.get("classes", 0),
                        "complexity_level": "high"
                        if total_functions > 20
                        else "medium",
                    },
                }
            )

        # Add error context to all pointers
        for pointer in pointers:
            pointer["evidence"]["investigated_error"] = error_context

        return pointers


def main():
    """Run trace execution analyzer from the command line."""
    import argparse

    # Parse arguments first to get error info
    parser = argparse.ArgumentParser(
        description="Root cause analysis through execution tracing"
    )
    parser.add_argument("target_path", help="Path to analyze")
    parser.add_argument(
        "--error",
        required=True,
        help="Error message, stack trace, or issue description to investigate",
    )
    parser.add_argument(
        "--output-format",
        choices=["json", "console"],
        default="json",
        help="Output format",
    )

    args = parser.parse_args()

    # Create analyzer with error info
    analyzer = ExecutionTraceAnalyzer(error_info=args.error)

    # Set up basic config
    analyzer.config.target_path = args.target_path
    analyzer.config.output_format = args.output_format

    # Run analysis
    try:
        result = analyzer.analyze()

        if args.output_format == "console":
            print(f"Execution Trace Analysis for: {args.error}")
            print("=" * 60)
            for finding in result.findings:
                print(f"\n{finding.title}")
                print(f"Severity: {finding.severity}")
                print(f"Description: {finding.description}")
                print(f"Recommendation: {finding.recommendation}")
        else:
            print(result.to_json(indent=2))

        sys.exit(0)

    except Exception as e:
        print(f"Error during analysis: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
