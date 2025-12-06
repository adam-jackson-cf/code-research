#!/usr/bin/env python3
"""
Semgrep Security Analyzer - Semantic Static Analysis Security Scanner.

PURPOSE: Comprehensive security analysis using Semgrep's semantic analysis engine.
Replaces bespoke regex pattern matching with established semantic analysis.

APPROACH:
- Uses Semgrep's extensive ruleset for OWASP Top 10 vulnerabilities
- Semantic analysis instead of brittle regex patterns
- Multi-language support with native language parsers
- Real-time rule updates from security community

EXTENDS: BaseAnalyzer for common analyzer infrastructure
- Inherits file scanning, CLI, configuration, and result formatting
- Implements security-specific analysis logic in analyze_target()
- Uses shared timing, logging, and error handling patterns

REPLACES: Multiple bespoke analyzers with regex patterns
- scan_vulnerabilities.py - SQL injection, XSS, command injection
- check_auth.py - Authentication and authorization issues
- validate_inputs.py - Input validation vulnerabilities
"""

import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

# Import base analyzer (package root must be on PYTHONPATH)
from core.base.analyzer_base import AnalyzerConfig, BaseAnalyzer
from core.base.analyzer_registry import register_analyzer


@register_analyzer("security:semgrep")
class SemgrepAnalyzer(BaseAnalyzer):
    """Semantic security analysis using Semgrep instead of regex patterns."""

    def __init__(self, config: AnalyzerConfig | None = None):
        # Create security-specific configuration
        security_config = config or AnalyzerConfig(
            code_extensions={
                # Semgrep supports extensive language coverage
                ".py",
                ".js",
                ".ts",
                ".jsx",
                ".tsx",
                ".java",
                ".cs",
                ".php",
                ".rb",
                ".go",
                ".rs",
                ".cpp",
                ".c",
                ".h",
                ".hpp",
                ".swift",
                ".kt",
                ".scala",
                ".dart",
                ".vue",
                ".xml",
                ".html",
                ".sql",
                ".sh",
                ".bash",
                ".ps1",
                ".bat",
                ".yaml",
                ".yml",
                ".json",
                ".tf",
                ".hcl",
                ".dockerfile",
                ".lock",
                ".gradle",
                ".pom",
            },
            # skip_patterns={
            #     "node_modules",
            #     ".git",
            #     "__pycache__",
            #     ".pytest_cache",
            #     "venv",
            #     "env",
            #     ".venv",
            #     "dist",
            #     "build",
            #     ".next",
            #     "coverage",
            #     ".nyc_output",
            #     "target",
            #     "vendor",
            #     "*.min.js",
            #     "*.min.css",
            #     "*.bundle.js",
            #     "*.chunk.js",
            #     "*.map",  # Source map files
            #     "*.d.ts",  # TypeScript declaration files
            #     "*.generated.*",  # Generated files
            #     "*.auto.*",  # Auto-generated files
            #     ".turbo",  # Turbo cache
            #     ".husky",  # Git hooks
            #     "packages/*/dist/*",  # Package distribution directories
            #     "apps/*/dist/*",  # App distribution directories
            #     "*.lock",  # Lock files
            #     "*.log",  # Log files
            # },
        )

        # Initialize base analyzer
        super().__init__("security", security_config)

        # Check for Semgrep availability
        self.semgrep_available = True  # Will be set to False if not available
        self._check_semgrep_availability()

        # Semgrep rule configurations for different security categories
        self.semgrep_rulesets = {
            "owasp_top10": "r/security",
            "injection": "r/security/audit/injection",
            "xss": "r/security/audit/xss",
            "auth": "r/security/audit/auth",
            "secrets": "r/secrets",
            "input_validation": "r/security/audit/validation",
            "crypto": "r/security/audit/crypto",
            "deserialization": "r/security/audit/deserialization",
        }

        # Severity mapping from Semgrep to our levels
        self.severity_mapping = {
            "ERROR": "critical",
            "WARNING": "high",
            "INFO": "medium",
        }

    def _is_testing_environment(self) -> bool:
        """Detect if we're running in a testing environment."""
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

    def _check_semgrep_availability(self):
        """Check if Semgrep is available."""
        try:
            result = subprocess.run(
                ["semgrep", "--version"], capture_output=True, text=True, timeout=10
            )
            if result.returncode != 0:
                print(
                    "WARNING: Semgrep is required for semantic security analysis but not found.",
                    file=sys.stderr,
                )
                print("Install with: pip install semgrep", file=sys.stderr)

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
                        "Continuing with degraded security analysis capabilities",
                        file=sys.stderr,
                    )
                    self.semgrep_available = False
                    return

            version = result.stdout.strip()
            print(f"Found Semgrep {version}", file=sys.stderr)
            self.semgrep_available = True

        except (subprocess.TimeoutExpired, FileNotFoundError):
            print("WARNING: Semgrep is required but not available.", file=sys.stderr)
            print("Install with: pip install semgrep", file=sys.stderr)

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
                    "Continuing with degraded security analysis capabilities",
                    file=sys.stderr,
                )
                self.semgrep_available = False

    def _run_semgrep_batch_analysis(
        self, file_paths: list[str]
    ) -> list[dict[str, Any]]:
        """
        Run Semgrep analysis on multiple files efficiently with combined rulesets.

        This replaces the old per-file, per-ruleset approach with a single invocation.
        """
        findings = []

        try:
            # Build semgrep command with configurable rulesets
            cmd = [
                "semgrep",
                "scan",
                "--json",
                "--timeout",
                "10",  # Faster timeout per file
                "--timeout-threshold",
                "3",  # Skip slow files quickly
                "--max-target-bytes",
                "500000",  # Skip files > 500KB
                "--jobs",
                "4",  # Parallel processing
                "--optimizations",
                "all",  # Enable all optimizations
            ]

            # Config override via env
            configs_str = os.environ.get("AAW_SEMGREP_CONFIGS", "").strip()
            configs: list[str]
            if configs_str:
                configs = [
                    c.strip() for c in re.split(r"[\n,]+", configs_str) if c.strip()
                ]
            else:
                configs = ["auto"]
            for cfg in configs:
                if cfg == "auto":
                    cmd.append("--config=auto")
                else:
                    cmd.extend(["--config", cfg])

            # OSS-only toggle (defaults true)
            oss_only = os.environ.get("AAW_SEMGREP_OSS_ONLY", "true").lower() != "false"
            if oss_only:
                cmd.append("--oss-only")
            # Add custom Rust security rules if analyzing Rust files
            rust_files = [fp for fp in file_paths if fp.endswith(".rs")]
            if rust_files:
                rust_rules_path = os.path.join(
                    os.path.dirname(__file__), "rules", "rust-security.yml"
                )
                if os.path.exists(rust_rules_path):
                    cmd.extend(["--config", rust_rules_path])
                    # Debug output for custom rules
                    import sys

                    print(
                        f"Added custom Rust rules for {len(rust_files)} Rust files: {rust_rules_path}",
                        file=sys.stderr,
                    )

            # Add all file paths to analyze in batch
            cmd.extend(file_paths)

            self.logger.info(f"Running semgrep on {len(file_paths)} files in batch")

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60,  # 1 minute total timeout for batch
            )

            if result.stdout:
                semgrep_output = json.loads(result.stdout)

                # Process Semgrep findings
                for finding in semgrep_output.get("results", []):
                    processed_finding = self._process_semgrep_finding(
                        finding, "auto"  # Mark as auto-detected ruleset
                    )
                    if processed_finding:
                        findings.append(processed_finding)

        except (
            subprocess.TimeoutExpired,
            subprocess.CalledProcessError,
            json.JSONDecodeError,
        ) as e:
            self.logger.warning(f"Semgrep batch analysis failed: {e}")
            # Fallback to individual file analysis if batch fails
            return self._fallback_individual_analysis(file_paths)

        return findings

    def _fallback_individual_analysis(
        self, file_paths: list[str]
    ) -> list[dict[str, Any]]:
        """Fallback to analyze files individually if batch processing fails."""
        self.logger.info("Falling back to individual file analysis")

        findings = []
        for file_path in file_paths:
            file_findings = self._run_semgrep_analysis(file_path, ["r/security"])
            findings.extend(file_findings)
        return findings

    def _run_semgrep_analysis(
        self, target_path: str, rulesets: list[str]
    ) -> list[dict[str, Any]]:
        """Run Semgrep analysis with specified rulesets (legacy method for fallback)."""
        findings = []

        for ruleset in rulesets:
            try:
                cmd = [
                    "semgrep",
                    "--config",
                    ruleset,
                    "--json",
                    # "--no-git-ignore",  # Let Semgrep use built-in exclusions and .gitignore
                    "--timeout",
                    "10",  # Faster timeout per file
                    "--timeout-threshold",
                    "3",  # Skip slow files
                    "--max-target-bytes",
                    "500000",  # Skip files > 500KB
                    target_path,
                ]

                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=30,  # Reduced timeout
                )

                if result.stdout:
                    semgrep_output = json.loads(result.stdout)

                    # Process Semgrep findings
                    for finding in semgrep_output.get("results", []):
                        processed_finding = self._process_semgrep_finding(
                            finding, ruleset
                        )
                        if processed_finding:
                            findings.append(processed_finding)

            except (
                subprocess.TimeoutExpired,
                subprocess.CalledProcessError,
                json.JSONDecodeError,
            ) as e:
                self.logger.warning(
                    f"Semgrep analysis failed for ruleset {ruleset}: {e}"
                )

        return findings

    def _process_semgrep_finding(
        self, finding: dict[str, Any], ruleset: str
    ) -> dict[str, Any] | None:
        """Convert Semgrep finding to our standardized format."""
        try:
            # Extract key information from Semgrep finding
            check_id = finding.get("check_id", "unknown")
            message = finding.get("message", "Security issue detected")
            path = finding.get("path", "")
            start_line = finding.get("start", {}).get("line", 0)
            severity = finding.get("extra", {}).get("severity", "WARNING")

            # Map Semgrep severity to our levels
            our_severity = self.severity_mapping.get(severity, "medium")

            # Create standardized finding
            return {
                "perf_type": check_id,
                "category": self._get_category_from_ruleset(ruleset),
                "file_path": path,
                "line_number": start_line,
                "line_content": finding.get("extra", {}).get("lines", "")[:150],
                "severity": our_severity,
                "description": message,
                "recommendation": self._get_recommendation(check_id),
                "pattern_matched": f"Semgrep: {check_id}",
                "confidence": "high",  # Semgrep provides high confidence findings
            }

        except Exception as e:
            self.logger.warning(f"Failed to process Semgrep finding: {e}")
            return None

    def _get_category_from_ruleset(self, ruleset: str) -> str:
        """Map Semgrep ruleset to our category system."""
        if "injection" in ruleset:
            return "injection"
        elif "xss" in ruleset:
            return "xss"
        elif "auth" in ruleset:
            return "authentication"
        elif "secrets" in ruleset:
            return "secrets"
        elif "validation" in ruleset:
            return "input_validation"
        elif "crypto" in ruleset:
            return "cryptography"
        else:
            return "security"

    def _get_recommendation(self, check_id: str) -> str:
        """Get specific recommendations based on Semgrep check ID."""
        # Map common Semgrep rules to actionable recommendations
        recommendations = {
            "python.lang.security.audit.dangerous-subprocess-use": "Use subprocess with shell=False and validate all inputs",
            "python.lang.security.audit.sql-injection": "Use parameterized queries or ORM methods to prevent SQL injection",
            "javascript.lang.security.audit.xss.direct-write-to-innerhtml": "Use textContent instead of innerHTML or sanitize user input",
            "java.lang.security.audit.command-injection": "Avoid runtime.exec() with user input. Use ProcessBuilder with validation",
            "generic.secrets.security.detected-private-key": "Remove private keys from code. Use environment variables or secure vaults",
        }

        return recommendations.get(
            check_id,
            "Review this security finding and apply appropriate security controls",
        )

    def _run_semgrep_on_directory(self, directory_path: str) -> list[dict[str, Any]]:
        """
        Run Semgrep on entire directory, letting it handle exclusions.

        This bypasses BaseAnalyzer's file discovery and lets Semgrep use its own
        .gitignore logic and built-in exclusions for optimal performance.
        """
        findings = []

        try:
            # Run Semgrep on the entire directory with configurable rulesets
            cmd = [
                "semgrep",
                "scan",
                "--json",
                "--timeout",
                "10",  # Per-file timeout
                "--timeout-threshold",
                "3",  # Skip slow files
                "--max-target-bytes",
                "500000",  # Skip files > 500KB
                "--jobs",
                "4",  # Parallel processing
                "--optimizations",
                "all",  # Enable all optimizations
            ]

            # Config override via env
            configs_str = os.environ.get("AAW_SEMGREP_CONFIGS", "").strip()
            configs: list[str]
            if configs_str:
                configs = [
                    c.strip() for c in re.split(r"[\n,]+", configs_str) if c.strip()
                ]
            else:
                configs = ["auto"]
            for cfg in configs:
                if cfg == "auto":
                    cmd.append("--config=auto")
                else:
                    cmd.extend(["--config", cfg])

            # OSS-only toggle (defaults true)
            oss_only = os.environ.get("AAW_SEMGREP_OSS_ONLY", "true").lower() != "false"
            if oss_only:
                cmd.append("--oss-only")

            ignore_patterns: set[str] = set()

            for pattern in getattr(self.config, "exclude_globs", set()):
                trimmed = pattern.strip()
                if trimmed:
                    ignore_patterns.add(trimmed)

            for skip in self.config.skip_patterns:
                sanitized = skip.strip("/")
                if not sanitized:
                    continue
                ignore_patterns.add(sanitized)
                ignore_patterns.add(f"**/{sanitized}")
                ignore_patterns.add(f"{sanitized}/**")

                if sanitized.endswith("*") and not sanitized.startswith("**/"):
                    ignore_patterns.add(f"**/{sanitized}")

            for pattern in getattr(self.config, "gitignore_patterns", []):
                trimmed = pattern.strip()
                if not trimmed or trimmed.startswith("#") or trimmed.startswith("!"):
                    continue
                ignore_patterns.add(trimmed)
                if trimmed.endswith("/"):
                    base = trimmed.rstrip("/")
                    ignore_patterns.add(f"{trimmed}**")
                    ignore_patterns.add(f"**/{base}/**")

            for pattern in sorted(p for p in ignore_patterns if p):
                cmd.extend(["--exclude", pattern])

            cmd.append(directory_path)  # Pass directory, not individual files

            self.logger.info(f"Running Semgrep on directory: {directory_path}")

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300,  # 5 minute total timeout
            )

            if result.stdout:
                semgrep_output = json.loads(result.stdout)

                # Log how many files Semgrep actually scanned
                results = semgrep_output.get("results", [])
                scanned_files = set()
                for finding in results:
                    scanned_files.add(finding.get("path", ""))

                self.logger.info(
                    f"Semgrep scanned {len(scanned_files)} files (down from BaseAnalyzer's file discovery)"
                )

                # Process Semgrep findings
                for finding in results:
                    processed_finding = self._process_semgrep_finding(finding, "auto")
                    if processed_finding:
                        findings.append(processed_finding)

                self.logger.info(f"Found {len(findings)} security findings")

            if result.stderr:
                self.logger.warning(f"Semgrep warnings: {result.stderr[:500]}")

        except (
            subprocess.TimeoutExpired,
            subprocess.CalledProcessError,
            json.JSONDecodeError,
        ) as e:
            self.logger.error(f"Semgrep directory analysis failed: {e}")
            # Don't fallback to file-by-file - let it fail cleanly
            raise

        return findings

    def analyze(self, target_path: str | None = None) -> Any:
        """
        Override BaseAnalyzer.analyze to let Semgrep handle file discovery.

        This bypasses BaseAnalyzer's file scanning and lets Semgrep use its own
        .gitignore logic and built-in exclusions for optimal performance.
        """
        self.start_analysis()

        analyze_path = target_path or self.config.target_path
        result = self.create_result("analysis")

        try:
            # Skip analysis if Semgrep is not available (degraded mode)
            if not self.semgrep_available:
                result.metadata["info"] = "Semgrep not available - analysis skipped"
                return self.complete_analysis(result)

            # Pass the DIRECTORY to Semgrep, not individual files
            # Semgrep will handle all file discovery and exclusions
            raw_findings = self._run_semgrep_on_directory(analyze_path)

            # Convert to standardized format for BaseAnalyzer
            standardized_findings = []
            for finding in raw_findings:
                standardized = {
                    "title": f"{finding['description']} ({finding['perf_type']})",
                    "description": f"Semgrep detected: {finding['description']}. Category: {finding['category']}. This requires security review and remediation.",
                    "severity": finding["severity"],
                    "file_path": finding["file_path"],
                    "line_number": finding["line_number"],
                    "recommendation": finding["recommendation"],
                    "metadata": {
                        "tool": "semgrep",
                        "check_id": finding["perf_type"],
                        "category": finding["category"],
                        "line_content": finding["line_content"],
                        "confidence": finding["confidence"],
                    },
                }
                standardized_findings.append(standardized)

            # Convert findings to Finding objects
            self._add_findings_to_result(result, standardized_findings)

            # Add comprehensive metadata (with empty file list since Semgrep handled discovery)
            result.metadata = {
                "analyzer_type": self.analyzer_type,
                "target_path": analyze_path,
                "files_analyzed": "handled_by_semgrep",  # Semgrep reports actual count in logs
                "files_processed": len(
                    {f["file_path"] for f in raw_findings}
                ),  # Unique files with findings
                "files_skipped": 0,  # Semgrep handles this
                "processing_errors": 0,
                "total_findings": len(standardized_findings),
                "severity_breakdown": self._calculate_severity_breakdown(
                    standardized_findings
                ),
                "analyzer_config": {
                    "max_files": self.config.max_files,
                    "max_file_size_mb": self.config.max_file_size_mb,
                    "extensions_count": len(self.config.code_extensions),
                    "skip_patterns_count": len(self.config.skip_patterns),
                },
                **self.get_analyzer_metadata(),
            }

        except Exception as e:
            result.set_error(f"Semgrep analysis failed: {str(e)}")
            self.logger.error(f"Analysis failed: {e}")

        return self.complete_analysis(result)

    def _process_batch(self, batch: list[Path]) -> list[dict[str, Any]]:
        """
        Override batch processing to analyze multiple files efficiently with semgrep.

        Instead of calling analyze_target for each file individually,
        we run semgrep once on all files in the batch.
        """
        if not batch:
            return []

        # Skip analysis if Semgrep is not available (degraded mode)
        if not self.semgrep_available:
            self.logger.warning(
                "Skipping Semgrep analysis for batch - tool not available"
            )
            return []

        # Convert paths to strings for semgrep
        file_paths = [str(file_path) for file_path in batch]

        # Run comprehensive security analysis with combined rulesets
        findings = self._run_semgrep_batch_analysis(file_paths)

        # Update file processing counts
        self.files_processed += len(batch)

        # Convert to standardized format for BaseAnalyzer
        standardized_findings = []
        for finding in findings:
            standardized = {
                "title": f"{finding['description']} ({finding['perf_type']})",
                "description": f"Semgrep detected: {finding['description']}. Category: {finding['category']}. This requires security review and remediation.",
                "severity": finding["severity"],
                "file_path": finding["file_path"],
                "line_number": finding["line_number"],
                "recommendation": finding["recommendation"],
                "metadata": {
                    "tool": "semgrep",
                    "check_id": finding["perf_type"],
                    "category": finding["category"],
                    "line_content": finding["line_content"],
                    "confidence": finding["confidence"],
                },
            }
            standardized_findings.append(standardized)

        return standardized_findings

    def analyze_target(self, target_path: str) -> list[dict[str, Any]]:
        """
        Analyze target using Semgrep semantic analysis.

        Args:
            target_path: Path to analyze (single file - BaseAnalyzer handles directory iteration)

        Returns
        -------
            List of security findings with standardized structure
        """
        # Skip analysis if Semgrep is not available (degraded mode)
        if not self.semgrep_available:
            self.logger.warning(
                f"Skipping Semgrep analysis for {target_path} - tool not available"
            )
            return []

        # Run comprehensive security analysis with multiple rulesets
        rulesets = [
            "r/security",  # OWASP Top 10 and general security
            "r/secrets",  # Hardcoded secrets detection
        ]

        # Add custom Rust security rules if analyzing Rust code
        rust_rules_path = os.path.join(
            os.path.dirname(__file__), "rules", "rust-security.yml"
        )
        if os.path.exists(rust_rules_path):
            rulesets.append(rust_rules_path)
            print(f"Added custom Rust rules: {rust_rules_path}", file=sys.stderr)

        print(f"Using rulesets: {rulesets}", file=sys.stderr)

        findings = self._run_semgrep_analysis(target_path, rulesets)

        # Convert to our standardized format for BaseAnalyzer
        standardized_findings = []
        for finding in findings:
            standardized = {
                "title": f"{finding['description']} ({finding['perf_type']})",
                "description": f"Semgrep detected: {finding['description']}. Category: {finding['category']}. This requires security review and remediation.",
                "severity": finding["severity"],
                "file_path": finding["file_path"],
                "line_number": finding["line_number"],
                "recommendation": finding["recommendation"],
                "metadata": {
                    "tool": "semgrep",
                    "check_id": finding["perf_type"],
                    "category": finding["category"],
                    "line_content": finding["line_content"],
                    "confidence": finding["confidence"],
                },
            }
            standardized_findings.append(standardized)

        return standardized_findings

    def get_analyzer_metadata(self) -> dict[str, Any]:
        """Return metadata about this analyzer."""
        return {
            "name": "Semgrep Security Analyzer",
            "version": "2.0.0",
            "description": "Semantic security analysis using Semgrep (replacing bespoke regex patterns)",
            "category": "security",
            "priority": "critical",
            "capabilities": [
                "OWASP Top 10 vulnerability detection",
                "SQL injection analysis",
                "XSS vulnerability detection",
                "Authentication/authorization analysis",
                "Hardcoded secrets detection",
                "Input validation analysis",
                "Cryptographic weakness detection",
                "Multi-language semantic analysis",
                "Real-time security rule updates",
            ],
            "supported_languages": [
                "Python",
                "JavaScript",
                "TypeScript",
                "Java",
                "C#",
                "PHP",
                "Ruby",
                "Go",
                "Rust",
                "C/C++",
                "Swift",
                "Kotlin",
                "Scala",
                "Dart",
                "HTML",
                "SQL",
                "Shell",
                "YAML",
                "Terraform",
            ],
            "tool": "semgrep",
            "replaces": [
                "scan_vulnerabilities.py",
                "check_auth.py",
                "validate_inputs.py",
            ],
        }


if __name__ == "__main__":
    # CLI removed; this module is intended to be invoked via the orchestration layer
    sys.exit(0)
