#!/usr/bin/env python3
"""
Code Complexity Analyzer using Lizard - Multi-language Complexity Analysis.

PURPOSE: Specialized code complexity analyzer using Lizard library.
Part of the shared/analyzers/quality suite using BaseAnalyzer infrastructure.

APPROACH:
- Cyclomatic complexity analysis across multiple languages
- Function length and parameter count metrics
- Industry-standard thresholds for complexity levels
- Batch processing for large codebases

EXTENDS: BaseAnalyzer for common analyzer infrastructure
- Inherits file scanning, CLI, configuration, and result formatting
- Implements complexity-specific analysis logic in analyze_target()
- Uses shared timing, logging, and error handling patterns

Supports: C/C++/C#, Java, JavaScript, Python, Ruby, PHP, Swift, Go, Rust, TypeScript, etc.
"""

import re
import subprocess
import sys
from pathlib import Path
from typing import Any

# Import base analyzer (package root must be on PYTHONPATH)
from core.base.analyzer_base import AnalyzerConfig, BaseAnalyzer
from core.base.analyzer_registry import register_analyzer


@register_analyzer("quality:lizard")
class LizardComplexityAnalyzer(BaseAnalyzer):
    """Wrapper around Lizard for code complexity analysis using BaseAnalyzer infrastructure."""

    def __init__(self, config: AnalyzerConfig | None = None):
        # Create quality-specific configuration
        quality_config = config or AnalyzerConfig(
            code_extensions={
                ".py",
                ".js",
                ".ts",
                ".tsx",
                ".jsx",
                ".java",
                ".cpp",
                ".c",
                ".h",
                ".go",
                ".rs",
                ".swift",
                ".kt",
                ".cs",
                ".rb",
                ".php",
                ".m",
                ".mm",
                ".scala",
                ".dart",
                ".lua",
                ".perl",
                ".r",
            },
            batch_size=100,  # Process files in batches for Lizard
            max_files=5000,
        )

        # Initialize base analyzer
        super().__init__("complexity", quality_config)

        # Check for Lizard availability
        self.lizard_available = True  # Will be set to False if not available
        self._check_lizard_availability()

        # Thresholds based on industry standards
        self.thresholds = {
            "cyclomatic_complexity": {
                "high": 20,  # Very complex
                "medium": 10,  # Complex
                "low": 5,  # Moderate
            },
            "function_length": {
                "high": 100,  # Very long
                "medium": 50,  # Long
                "low": 25,  # Getting long
            },
            "parameter_count": {
                "high": 7,  # Too many
                "medium": 5,  # Many
                "low": 4,  # Starting to be many
            },
        }

    def _is_testing_environment(self) -> bool:
        """Detect if we're running in a testing environment."""
        import os

        # Check for common testing environment indicators
        return any(
            [
                "test" in os.environ.get("PYTHONPATH", "").lower(),
                "test" in os.getcwd().lower(),
                os.environ.get("TESTING", "").lower() == "true",
                "pytest" in str(os.environ.get("_", "")),
                any("test" in arg for arg in os.sys.argv),
            ]
        )

    def check_lizard_installed(self) -> bool:
        """Check if lizard is installed."""
        try:
            subprocess.run(["lizard", "--version"], capture_output=True, check=True)
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False

    def _check_lizard_availability(self):
        """Check if Lizard is available."""
        if not self.check_lizard_installed():
            print(
                "WARNING: Lizard is required for complexity analysis but not found.",
                file=sys.stderr,
            )
            print("Install with: pip install lizard", file=sys.stderr)

            # In testing environments, this should fail hard
            if self._is_testing_environment():
                print(
                    "ERROR: In testing environment - all tools must be available",
                    file=sys.stderr,
                )
                sys.exit(1)
            else:
                # In production, warn but continue with degraded functionality
                print(
                    "Continuing with degraded complexity analysis capabilities",
                    file=sys.stderr,
                )
                self.lizard_available = False
                return

        self.lizard_available = True

    def analyze_target(self, target_path: str) -> list[dict[str, Any]]:
        """
        Implement complexity analysis logic for target path.

        Args:
            target_path: Path to analyze (single file or batch from BaseAnalyzer)

        Returns
        -------
            List of complexity findings
        """
        # Skip analysis if Lizard is not available (degraded mode)
        if not self.lizard_available:
            if self.verbose:
                print(
                    f"Skipping Lizard analysis for {target_path} - tool not available",
                    file=sys.stderr,
                )
            return []

        findings = []

        # For complexity analysis, we process the file with Lizard
        if Path(target_path).is_file():
            # Single file analysis
            lizard_output = self._run_lizard_on_file(target_path)
            findings.extend(self._parse_lizard_output(lizard_output, target_path))

        return findings

    def get_analyzer_metadata(self) -> dict[str, Any]:
        """
        Get complexity analyzer-specific metadata.

        Returns
        -------
            Dictionary with analyzer-specific metadata
        """
        return {
            "analysis_type": "code_complexity",
            "complexity_metrics": [
                "cyclomatic_complexity",
                "function_length",
                "parameter_count",
            ],
            "thresholds": self.thresholds,
            "supported_languages": [
                "Python",
                "JavaScript",
                "TypeScript",
                "Java",
                "C/C++",
                "C#",
                "Ruby",
                "PHP",
                "Swift",
                "Go",
                "Rust",
                "Kotlin",
                "Scala",
                "Dart",
                "Lua",
                "Perl",
                "R",
            ],
            "tool": "Lizard",
            "tool_installed": self.check_lizard_installed(),
        }

    def _run_lizard_on_file(self, file_path: str) -> str:
        """Run Lizard on a single file and return output."""
        try:
            cmd = [
                "lizard",
                "-C",
                "999",  # Set high to get all results
                "-L",
                "999",  # Set high to get all results
                "-a",
                "999",  # Set high to get all results
                file_path,
            ]
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0:
                return result.stdout
            return ""
        except Exception:
            return ""

    def _parse_lizard_output(self, output: str, file_path: str) -> list[dict[str, Any]]:
        """Parse Lizard output and convert to findings."""
        findings = []
        if not output:
            return findings

        lines = output.strip().split("\n")

        for line in lines:
            # Skip non-data lines
            if not line.strip() or "@" not in line:
                continue

            # Parse format: NLOC CCN token PARAM length location
            parts = line.strip().split()
            if len(parts) < 6:
                continue

            try:
                nloc = int(parts[0])
                ccn = int(parts[1])
                # token_count = int(parts[2])  # Not used in current implementation
                param_count = int(parts[3])
                # length = int(parts[4])  # Not used in current implementation
                location = " ".join(parts[5:])

                # Parse location: function_name@start-end@filepath
                match = re.match(r"(.+)@(\d+)-(\d+)@(.+)", location)
                if not match:
                    continue

                func_name = match.group(1)
                start_line = int(match.group(2))

                # Check cyclomatic complexity
                ccn_severity = self.get_severity("cyclomatic_complexity", ccn)
                if ccn_severity in ["high", "medium"]:
                    findings.append(
                        {
                            "title": "High Cyclomatic Complexity",
                            "description": f"Function '{func_name}' has cyclomatic complexity of {ccn}",
                            "severity": ccn_severity,
                            "file_path": file_path,
                            "line_number": start_line,
                            "recommendation": "Consider breaking down this function. Aim for complexity < 10",
                            "metadata": {
                                "function_name": func_name,
                                "cyclomatic_complexity": ccn,
                                "lines_of_code": nloc,
                                "parameters": param_count,
                            },
                        }
                    )

                # Check function length
                length_severity = self.get_severity("function_length", nloc)
                if length_severity in ["high", "medium"]:
                    findings.append(
                        {
                            "title": "Long Function",
                            "description": f"Function '{func_name}' is {nloc} lines long",
                            "severity": length_severity,
                            "file_path": file_path,
                            "line_number": start_line,
                            "recommendation": "Consider breaking down this function. Aim for < 50 lines",
                            "metadata": {
                                "function_name": func_name,
                                "lines_of_code": nloc,
                                "cyclomatic_complexity": ccn,
                            },
                        }
                    )

                # Check parameter count
                param_severity = self.get_severity("parameter_count", param_count)
                if param_severity in ["high", "medium"]:
                    findings.append(
                        {
                            "title": "Too Many Parameters",
                            "description": f"Function '{func_name}' has {param_count} parameters",
                            "severity": param_severity,
                            "file_path": file_path,
                            "line_number": start_line,
                            "recommendation": "Consider using parameter objects or configuration classes",
                            "metadata": {
                                "function_name": func_name,
                                "parameter_count": param_count,
                            },
                        }
                    )

            except (ValueError, IndexError):
                continue

        return findings

    def get_severity(self, metric_type: str, value: float) -> str:
        """Determine severity based on thresholds."""
        thresholds = self.thresholds.get(metric_type, {})

        if value >= thresholds.get("high", float("inf")):
            return "high"
        elif value >= thresholds.get("medium", float("inf")):
            return "medium"
        elif value >= thresholds.get("low", float("inf")):
            return "low"
        else:
            return "info"

    def analyze_with_lizard(self, target_path: str) -> Any:
        """
        Run full Lizard analysis on directory (legacy method for backward compatibility).

        This processes all files at once rather than using BaseAnalyzer's batch processing.
        """
        self.start_analysis()
        result = self.create_result("complexity_analysis")

        try:
            # Check lizard is installed
            if not self.check_lizard_installed():
                result.set_error("Lizard is not installed. Run: pip install lizard")
                return self.complete_analysis(result)

            # Get all files to analyze using BaseAnalyzer's scanning
            files_to_analyze = self.scan_directory(target_path)

            if not files_to_analyze:
                result.add_info("No files found matching complexity analyzer criteria")
                return self.complete_analysis(result)

            # Run Lizard on all files at once (Lizard's batch mode)
            all_findings = []
            for i in range(0, len(files_to_analyze), self.config.batch_size):
                batch = files_to_analyze[i : i + self.config.batch_size]
                batch_paths = [str(f) for f in batch]

                # Run Lizard on batch
                cmd = ["lizard", "-C", "999", "-L", "999", "-a", "999"] + batch_paths

                try:
                    result_output = subprocess.run(cmd, capture_output=True, text=True)
                    if result_output.returncode == 0:
                        # Parse output for all files in batch
                        for file_path in batch_paths:
                            file_findings = self._parse_lizard_output(
                                result_output.stdout, file_path
                            )
                            all_findings.extend(file_findings)
                except Exception as e:
                    self.logger.warning(f"Error running Lizard on batch: {e}")

            # Add findings to result
            self._add_findings_to_result(result, all_findings)

            # Add metadata
            self._add_metadata_to_result(
                result, target_path, files_to_analyze, all_findings
            )

        except Exception as e:
            result.set_error(f"Complexity analysis failed: {str(e)}")

        return self.complete_analysis(result)


# Legacy function for backward compatibility
def analyze_complexity(target_path: str = ".") -> Any:
    """
    Legacy function for backward compatibility.

    Args:
        target_path: Path to analyze

    Returns
    -------
        AnalysisResult from LizardComplexityAnalyzer
    """
    analyzer = LizardComplexityAnalyzer()
    # Use the Lizard batch mode for legacy compatibility
    return analyzer.analyze_with_lizard(target_path)


if __name__ == "__main__":
    raise SystemExit(0)
