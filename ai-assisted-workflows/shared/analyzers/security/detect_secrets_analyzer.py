#!/usr/bin/env python3
"""
Detect-Secrets Analyzer - Hardcoded Secrets Detection Using Established Tool.

PURPOSE: Detects hardcoded secrets and credentials using detect-secrets library.
Replaces bespoke regex pattern matching with established entropy-based analysis.

APPROACH:
- Uses detect-secrets' entropy analysis and plugin system
- Multiple detection algorithms (entropy, keyword, pattern-based)
- Configurable filters to reduce false positives
- Industry-standard secret detection patterns

EXTENDS: BaseAnalyzer for common analyzer infrastructure
- Inherits file scanning, CLI, configuration, and result formatting
- Implements security-specific analysis logic in analyze_target()
- Uses shared timing, logging, and error handling patterns

REPLACES: detect_secrets.py with bespoke regex patterns
- More accurate entropy-based detection
- Established plugin ecosystem
- Better false positive filtering
"""

import json
import subprocess
import sys
from functools import lru_cache
from pathlib import Path
from typing import Any

# Import base analyzer (package root must be on PYTHONPATH)
from core.base.analyzer_base import AnalyzerConfig, BaseAnalyzer
from core.base.analyzer_registry import register_analyzer

_DETECT_SECRETS_CONFIG_PATH = (
    Path(__file__).resolve().parents[2] / "config" / "security" / "detect_secrets.json"
)
_DETECT_SECRETS_SCHEMA_VERSION = 1
_REQUIRED_TOP_LEVEL_KEYS = {
    "code_extensions",
    "skip_patterns",
    "plugins_used",
    "filters_used",
}


class DetectSecretsConfigError(RuntimeError):
    """Raised when detect-secrets configuration is invalid."""


class DetectSecretsToolNotAvailable(RuntimeError):
    """Raised when the detect-secrets CLI cannot be executed."""


@lru_cache(maxsize=1)
def _load_detect_secrets_config() -> dict[str, Any]:
    """Load and validate detect-secrets configuration from JSON."""
    try:
        config_data = json.loads(
            _DETECT_SECRETS_CONFIG_PATH.read_text(encoding="utf-8")
        )
    except FileNotFoundError as exc:  # pragma: no cover - configuration must exist
        raise DetectSecretsConfigError(
            f"Detect-secrets config not found: {_DETECT_SECRETS_CONFIG_PATH}"
        ) from exc

    if not isinstance(config_data, dict):
        raise DetectSecretsConfigError("Detect-secrets config must be a JSON object")

    if config_data.get("schema_version") != _DETECT_SECRETS_SCHEMA_VERSION:
        raise DetectSecretsConfigError(
            "Unsupported detect-secrets config version:"
            f" {config_data.get('schema_version')}"
        )

    config_data = {
        key: value for key, value in config_data.items() if key != "schema_version"
    }

    missing = _REQUIRED_TOP_LEVEL_KEYS - set(config_data)
    if missing:
        raise DetectSecretsConfigError(
            f"Detect-secrets config missing keys: {', '.join(sorted(missing))}"
        )

    for key in ("code_extensions", "skip_patterns"):
        values = config_data[key]
        if not isinstance(values, list) or not all(
            isinstance(item, str) for item in values
        ):
            raise DetectSecretsConfigError(
                f"Config entry '{key}' must be a list of strings"
            )

    for key in ("plugins_used", "filters_used"):
        items = config_data[key]
        if not isinstance(items, list) or not all(
            isinstance(item, dict) for item in items
        ):
            raise DetectSecretsConfigError(
                f"Config entry '{key}' must be a list of objects"
            )

    return config_data


@register_analyzer("security:detect_secrets")
class DetectSecretsAnalyzer(BaseAnalyzer):
    """Hardcoded secrets detection using detect-secrets tool."""

    def __init__(self, config: AnalyzerConfig | None = None):
        config_data = _load_detect_secrets_config()

        security_config = config or AnalyzerConfig(
            code_extensions=set(config_data["code_extensions"]),
            skip_patterns=set(config_data["skip_patterns"]),
        )

        # Initialize base analyzer
        super().__init__("security", security_config)

        # Ensure the detect-secrets CLI is available
        self._check_detect_secrets_availability()

        # Secret detection configuration
        self.detect_secrets_config = {
            "plugins_used": [dict(item) for item in config_data["plugins_used"]],
            "filters_used": [dict(item) for item in config_data["filters_used"]],
        }

    def _check_detect_secrets_availability(self):
        """Ensure detect-secrets CLI is available."""
        try:
            result = subprocess.run(
                ["detect-secrets", "--version"],
                capture_output=True,
                text=True,
                timeout=10,
            )
        except (subprocess.TimeoutExpired, FileNotFoundError) as exc:
            raise DetectSecretsToolNotAvailable(
                "detect-secrets CLI is required but could not be executed."
            ) from exc

        if result.returncode != 0:
            raise DetectSecretsToolNotAvailable(
                f"detect-secrets returned non-zero exit code: {result.returncode}"
            )

        version = result.stdout.strip()
        if version:
            print(f"Found detect-secrets {version}", file=sys.stderr)

    def _run_detect_secrets_scan(self, target_path: str) -> list[dict[str, Any]]:
        """Run detect-secrets scan on target path."""
        findings = []

        try:
            # Use detect-secrets with default configuration for maximum detection
            cmd = [
                "detect-secrets",
                "scan",
                "--all-files",
                "--force-use-all-plugins",
                target_path,
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

            if result.stdout:
                secrets_output = json.loads(result.stdout)

                # Process detected secrets with custom filtering
                for file_path, secrets in secrets_output.get("results", {}).items():
                    for secret in secrets:
                        # Apply custom filtering to reduce false positives
                        if self._should_include_secret(secret, file_path):
                            finding = self._process_secret_finding(secret, file_path)
                            if finding:
                                findings.append(finding)

        except (
            subprocess.TimeoutExpired,
            subprocess.CalledProcessError,
            json.JSONDecodeError,
        ) as e:
            if getattr(self, "verbose", False):
                print(f"detect-secrets scan failed: {e}", file=sys.stderr)
        finally:
            # No cleanup needed for command-line approach
            pass

        return findings

    def _should_include_secret(self, secret: dict[str, Any], file_path: str) -> bool:
        """Apply custom filtering to reduce false positives while preserving legitimate secrets."""
        secret_type = secret.get("type", "")

        # Always include high-value secret types
        high_value_types = [
            "Private Key",
            "AWS Access Key",
            "GitHub Token",
            "JWT Token",
        ]
        if secret_type in high_value_types:
            return True

        # For keyword secrets, apply balanced filtering
        if secret_type == "Secret Keyword":
            # Exclude obvious test files but allow legitimate secrets in vulnerable apps
            if any(
                pattern in file_path.lower()
                for pattern in [
                    "test_",
                    "mock_",
                    "example_only",
                    "demo_data",
                    "fixture_",
                ]
            ):
                return False

            # Allow secrets in vulnerable apps (this is expected for our test)
            if any(app in file_path for app in ["pygoat", "nodegoat", "sql-vulns"]):
                return True

        return True  # Include by default

    def _process_secret_finding(
        self, secret: dict[str, Any], file_path: str
    ) -> dict[str, Any] | None:
        """Convert detect-secrets finding to our standardized format."""
        try:
            secret_type = secret.get("type", "unknown")
            line_number = secret.get("line_number", 0)

            # Map secret types to severity levels
            severity_mapping = {
                "Private Key": "critical",
                "AWS Access Key": "critical",
                "JWT Token": "critical",
                "Azure Storage Key": "critical",
                "GitHub Token": "critical",
                "High Entropy String": "high",
                "Basic Auth": "high",
                "Slack Token": "high",
                "Keyword": "medium",
            }

            severity = severity_mapping.get(secret_type, "medium")

            return {
                "perf_type": secret_type.lower().replace(" ", "_"),
                "category": "secrets",
                "file_path": file_path,
                "line_number": line_number,
                "line_content": "",  # detect-secrets doesn't provide line content
                "severity": severity,
                "description": f"Hardcoded {secret_type.lower()} detected",
                "recommendation": self._get_secret_recommendation(secret_type),
                "pattern_matched": f"detect-secrets: {secret_type}",
                "confidence": "high",
            }

        except Exception as e:
            if getattr(self, "verbose", False):
                print(f"Failed to process secret finding: {e}", file=sys.stderr)
            return None

    def _get_secret_recommendation(self, secret_type: str) -> str:
        """Get specific recommendations based on secret type."""
        recommendations = {
            "Private Key": "Remove private keys from code. Use secure key management services and environment variables.",
            "AWS Access Key": "Remove AWS credentials from code. Use IAM roles, AWS profiles, or environment variables.",
            "JWT Token": "Remove hardcoded JWT tokens. Generate tokens dynamically and store signing keys securely.",
            "GitHub Token": "Remove GitHub tokens from code. Use GitHub secrets or environment variables.",
            "Azure Storage Key": "Remove Azure keys from code. Use Azure Key Vault or managed identities.",
            "High Entropy String": "Review high entropy strings. If secrets, move to environment variables or secure vaults.",
            "Basic Auth": "Remove hardcoded authentication. Use secure credential storage and environment variables.",
            "API Key": "Remove API keys from code. Use environment variables or secure configuration management.",
        }

        return recommendations.get(
            secret_type,
            "Remove hardcoded secrets from code. Use environment variables or secure credential management.",
        )

    def analyze_target(self, target_path: str) -> list[dict[str, Any]]:
        """
        Analyze target using detect-secrets for hardcoded secrets.

        Args:
            target_path: Path to analyze (single file - BaseAnalyzer handles directory iteration)

        Returns
        -------
            List of secret findings with standardized structure
        """
        findings = self._run_detect_secrets_scan(target_path)

        # Convert to our standardized format for BaseAnalyzer
        standardized_findings = []
        for finding in findings:
            standardized = {
                "title": f"{finding['description']} ({finding['perf_type']})",
                "description": f"detect-secrets found: {finding['description']}. This hardcoded secret poses a security risk and should be removed immediately.",
                "severity": finding["severity"],
                "file_path": finding["file_path"],
                "line_number": finding["line_number"],
                "recommendation": finding["recommendation"],
                "metadata": {
                    "tool": "detect-secrets",
                    "secret_type": finding["perf_type"],
                    "category": finding["category"],
                    "confidence": finding["confidence"],
                },
            }
            standardized_findings.append(standardized)

        return standardized_findings

    def get_analyzer_metadata(self) -> dict[str, Any]:
        """Return metadata about this analyzer."""
        return {
            "name": "Detect-Secrets Analyzer",
            "version": "2.0.0",
            "description": "Hardcoded secrets detection using detect-secrets library (replacing regex patterns)",
            "category": "security",
            "priority": "critical",
            "capabilities": [
                "Entropy-based secret detection",
                "Private key detection",
                "API key identification",
                "Cloud credentials detection",
                "JWT token discovery",
                "Basic authentication detection",
                "Multi-plugin analysis",
                "False positive filtering",
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
                "Configuration files",
                "Environment files",
                "Shell scripts",
            ],
            "tool": "detect-secrets",
            "replaces": ["detect_secrets.py"],
        }


if __name__ == "__main__":
    # CLI removed; this module is intended to be invoked via the orchestration layer
    sys.exit(0)
