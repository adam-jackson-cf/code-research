#!/usr/bin/env python3
"""
Unit tests for detect_secrets_analyzer.py - Detect-Secrets Analyzer.

Tests the secret detection capabilities using the detect-secrets library,
configuration loading, and integration with BaseAnalyzer infrastructure.
"""

import json
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from analyzers.security.detect_secrets_analyzer import (
    DetectSecretsAnalyzer,
    DetectSecretsConfigError,
    DetectSecretsToolNotAvailable,
    _load_detect_secrets_config,
)
from core.base.analyzer_base import AnalyzerConfig


@pytest.fixture
def temp_secrets_config_dir():
    """Create a temporary detect-secrets config directory."""
    with tempfile.TemporaryDirectory() as temp_dir:
        config_dir = Path(temp_dir) / "config" / "security"
        config_dir.mkdir(parents=True)

        # Create test detect-secrets configuration
        secrets_config = {
            "schema_version": 1,
            "code_extensions": [
                ".py",
                ".js",
                ".java",
                ".cpp",
                ".h",
                ".cs",
                ".php",
                ".rb",
                ".go",
                ".rs",
            ],
            "skip_patterns": [
                "node_modules",
                ".git",
                "__pycache__",
                "venv",
                "env",
                "dist",
                "build",
                "target",
                "vendor",
                "*.min.js",
                "*.bundle.js",
                "package-lock.json",
                "yarn.lock",
                "Gemfile.lock",
            ],
            "plugins_used": [
                {
                    "name": "Base64HighEntropyString",
                    "base64_alphabet": "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
                    "limit": 4.5,
                },
                {
                    "name": "HexHighEntropyString",
                    "hex_alphabet": "0123456789abcdefABCDEF",
                    "limit": 3.0,
                },
                {
                    "name": "KeywordDetector",
                    "keyword_exclude": "",
                    "keyword_filter": [
                        "false",
                        "true",
                        "null",
                        "nil",
                        "undefined",
                        "None",
                    ],
                },
                {"name": "BasicAuthDetector"},
                {"name": "PrivateKeyDetector"},
                {"name": "AWSKeyDetector"},
                {"name": "ArtifactoryDetector"},
                {"name": "MailchimpDetector"},
                {"name": "StripeDetector"},
                {"name": " slackTokenDetector"},
            ],
            "filters_used": [
                {"path": "detect_secrets.filters.common.is_likely_id_string"},
                {
                    "path": "detect_secrets.filters.heuristic.is_indirect_reference",
                    "min_line_length": 20,
                },
                {
                    "path": "detect_secrets.filters.heuristic.is_typed_assignment",
                    "type_names": [
                        "bool",
                        "boolean",
                        "int",
                        "integer",
                        "float",
                        "double",
                        "str",
                        "string",
                    ],
                },
            ],
        }

        # Write config file
        (config_dir / "detect_secrets.json").write_text(json.dumps(secrets_config))

        # Clear cache and patch config path
        _load_detect_secrets_config.cache_clear()
        with patch(
            "analyzers.security.detect_secrets_analyzer._DETECT_SECRETS_CONFIG_PATH",
            config_dir / "detect_secrets.json",
        ):
            yield config_dir


class TestDetectSecretsConfiguration:
    """Test configuration loading and validation."""

    def test_load_detect_secrets_config_success(self, temp_secrets_config_dir):
        """Test successful loading of detect-secrets configuration."""
        config = _load_detect_secrets_config()

        assert isinstance(config, dict)
        assert "code_extensions" in config
        assert "skip_patterns" in config
        assert "plugins_used" in config
        assert "filters_used" in config

        # Check specific values
        assert ".py" in config["code_extensions"]
        assert "node_modules" in config["skip_patterns"]
        assert len(config["plugins_used"]) > 0
        assert len(config["filters_used"]) > 0

    def test_missing_config_file(self):
        """Test error handling for missing config file."""
        with patch(
            "analyzers.security.detect_secrets_analyzer._DETECT_SECRETS_CONFIG_PATH",
            Path("/nonexistent/config.json"),
        ):
            _load_detect_secrets_config.cache_clear()
            with pytest.raises(
                DetectSecretsConfigError, match="Detect-secrets config not found"
            ):
                _load_detect_secrets_config()

    def test_invalid_schema_version(self, temp_secrets_config_dir):
        """Test error handling for invalid schema version."""
        # Modify config to have invalid schema version
        config_file = temp_secrets_config_dir / "detect_secrets.json"
        data = json.loads(config_file.read_text())
        data["schema_version"] = 999
        config_file.write_text(json.dumps(data))

        _load_detect_secrets_config.cache_clear()
        with pytest.raises(
            DetectSecretsConfigError, match="Unsupported detect-secrets config version"
        ):
            _load_detect_secrets_config()

    def test_missing_required_keys(self, temp_secrets_config_dir):
        """Test error handling for missing required keys."""
        # Create invalid config
        invalid_config = {
            "schema_version": 1,
            "code_extensions": [".py"],
            # Missing other required keys
        }

        (temp_secrets_config_dir / "detect_secrets.json").write_text(
            json.dumps(invalid_config)
        )

        _load_detect_secrets_config.cache_clear()
        with pytest.raises(DetectSecretsConfigError, match="missing keys"):
            _load_detect_secrets_config()

    def test_invalid_list_values(self, temp_secrets_config_dir):
        """Test error handling for invalid list values."""
        # Create config with invalid list
        invalid_config = {
            "schema_version": 1,
            "code_extensions": "not_a_list",  # Should be a list
            "skip_patterns": [],
            "plugins_used": [],
            "filters_used": [],
        }

        (temp_secrets_config_dir / "detect_secrets.json").write_text(
            json.dumps(invalid_config)
        )

        _load_detect_secrets_config.cache_clear()
        with pytest.raises(DetectSecretsConfigError, match="must be a list of strings"):
            _load_detect_secrets_config()


class TestDetectSecretsAnalyzer:
    """Test the main DetectSecretsAnalyzer class."""

    @pytest.fixture
    def analyzer(self, temp_secrets_config_dir):
        """Create analyzer instance with test config."""
        return DetectSecretsAnalyzer()

    def test_analyzer_initialization(self, analyzer):
        """Test analyzer initialization."""
        assert analyzer.analyzer_type == "security"
        assert isinstance(analyzer.config, AnalyzerConfig)
        assert ".py" in analyzer.config.code_extensions
        assert "node_modules" in analyzer.config.skip_patterns

    @patch("subprocess.run")
    def test_detect_secrets_success(self, mock_run, analyzer):
        """Test successful secret detection."""
        # Mock detect-secrets 'scan' output structure used by analyzer
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout=json.dumps(
                {
                    "results": {
                        "file1.py": [
                            {
                                "type": "Base64 High Entropy String",
                                "line_number": 10,
                            }
                        ]
                    }
                }
            ),
            stderr="",
        )

        results = analyzer.analyze_target("file1.py")

        assert len(results) == 1
        finding = results[0]
        assert "base64" in finding["title"].lower()
        assert finding["line_number"] == 10
        assert finding["file_path"] == "file1.py"

    @patch("subprocess.run")
    def test_detect_secrets_no_secrets(self, mock_run, analyzer):
        """Test handling when no secrets are found."""
        # Mock detect-secrets output with no secrets
        mock_run.return_value = MagicMock(
            returncode=0, stdout=json.dumps({}), stderr=""
        )

        results = analyzer.analyze_target("clean_file.py")
        assert len(results) == 0

    @patch("subprocess.run")
    def test_detect_secrets_tool_error(self, mock_run, analyzer):
        """Test handling when detect-secrets tool fails."""
        # Mock tool error
        mock_run.return_value = MagicMock(
            returncode=1, stdout="", stderr="detect-secrets: command not found"
        )

        with pytest.raises(DetectSecretsToolNotAvailable):
            analyzer._check_detect_secrets_availability()

    @patch("subprocess.run")
    def test_detect_secrets_invalid_json(self, mock_run, analyzer):
        """Test handling of invalid JSON output."""
        # Mock invalid JSON output
        mock_run.return_value = MagicMock(
            returncode=0, stdout="invalid json output", stderr=""
        )

        results = analyzer.analyze_target("file.py")
        assert len(results) == 0

    @patch("subprocess.run")
    def test_analyze_target_with_secrets(self, mock_run, analyzer):
        """Test analyze_target method with secrets found."""
        # Mock detect-secrets output
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout=json.dumps(
                {"results": {"test.py": [{"type": "AWS Access Key", "line_number": 5}]}}
            ),
            stderr="",
        )

        test_content = """
def aws_config():
    access_key = "AKIAIOSFODNN7EXAMPLE"  # AWS access key
    return access_key
"""

        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(test_content)
            f.flush()

            results = analyzer.analyze_target(f.name)

            assert len(results) == 1
            finding = results[0]

            assert "aws access key" in finding["title"].lower()
            assert finding["severity"] == "critical"
            # Uses line numbers reported by detect-secrets output
            assert finding["line_number"] == 5
            assert "aws access key" in finding["description"].lower()
            assert "remove aws credentials" in finding["recommendation"].lower()
            assert finding["metadata"]["secret_type"] == "aws_access_key"

            Path(f.name).unlink()

    @patch("subprocess.run")
    def test_analyze_target_multiple_secrets(self, mock_run, analyzer):
        """Test analyze_target with multiple secrets in same file."""
        # Mock multiple secrets
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout=json.dumps(
                {
                    "results": {
                        "test.py": [
                            {"type": "API Key", "line_number": 5},
                            {"type": "Private Key", "line_number": 10},
                        ]
                    }
                }
            ),
            stderr="",
        )

        test_content = '''
# Multiple secrets
api_key = "sk_test_123456"
private_key = """-----BEGIN PRIVATE KEY-----"""
'''

        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(test_content)
            f.flush()

            results = analyzer.analyze_target(f.name)

            assert len(results) == 2

            # Check first secret (API key)
            api_key_result = next(r for r in results if "api key" in r["title"].lower())
            assert api_key_result["line_number"] == 5

            # Check second secret (private key)
            private_key_result = next(
                r for r in results if "private key" in r["title"].lower()
            )
            assert private_key_result["line_number"] == 10
            assert private_key_result["severity"] == "critical"

            Path(f.name).unlink()

    def test_analyze_target_skipped_file(self, analyzer):
        """Test handling of skipped files."""
        # Create file in skipped directory
        with tempfile.TemporaryDirectory() as temp_dir:
            skipped_dir = Path(temp_dir) / "node_modules"
            skipped_dir.mkdir()

            test_file = skipped_dir / "test.js"
            test_file.write_text("api_key = 'secret'")

            results = analyzer.analyze_target(str(test_file))

            # Should skip analysis
            assert len(results) == 0

    @patch("subprocess.run")
    def test_analyze_target_non_code_file(self, mock_run, analyzer):
        """Test handling of non-code files."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write("This is not a code file")
            f.flush()

            mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
            results = analyzer.analyze_target(f.name)

            # Should not analyze non-code files
            assert len(results) == 0

            Path(f.name).unlink()

    def test_get_analyzer_metadata(self, analyzer):
        """Test metadata generation."""
        metadata = analyzer.get_analyzer_metadata()

        assert metadata["name"] == "Detect-Secrets Analyzer"
        assert metadata["category"] == "security"
        assert metadata["tool"] == "detect-secrets"

    @patch("subprocess.run")
    def test_secret_finding_creation(self, mock_run, analyzer):
        """Test SecretFinding creation and conversion."""
        # Mock detect-secrets output
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout=json.dumps(
                {"results": {"test.py": [{"type": "Private Key", "line_number": 15}]}}
            ),
            stderr="",
        )

        results = analyzer.analyze_target("test.py")
        assert len(results) == 1
        finding_dict = results[0]
        assert finding_dict["severity"] == "critical"
        assert finding_dict["line_number"] == 15
        assert finding_dict["metadata"]["secret_type"] == "private_key"

    @patch("subprocess.run")
    def test_severity_determination(self, mock_run, analyzer):
        """Test severity determination based on secret type."""
        test_cases = [
            ("Private Key", "critical"),
            ("AWS Access Key", "critical"),
            ("API Key", "medium"),
            ("Password", "medium"),
            ("Token", "medium"),
            ("Base64 High Entropy String", "medium"),
            ("Hex High Entropy String", "medium"),
        ]

        for secret_type, expected_severity in test_cases:
            mock_run.return_value = MagicMock(
                returncode=0,
                stdout=json.dumps(
                    {"results": {"test.py": [{"type": secret_type, "line_number": 1}]}}
                ),
                stderr="",
            )

            results = analyzer.analyze_target("test.py")
            assert results[0]["severity"] == expected_severity

    @patch("subprocess.run")
    def test_recommendation_generation(self, mock_run, analyzer):
        """Test recommendation generation for different secret types."""
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout=json.dumps(
                {"results": {"test.py": [{"type": "API Key", "line_number": 1}]}}
            ),
            stderr="",
        )

        results = analyzer.analyze_target("test.py")
        finding_dict = results[0]

        recommendation = finding_dict["recommendation"]
        assert "remove api keys" in recommendation.lower()
        assert "environment variable" in recommendation.lower()

    @patch("subprocess.run")
    def test_file_path_handling(self, mock_run, analyzer):
        """Test proper file path handling."""
        # Test with relative path
        mock_run.return_value = MagicMock(
            returncode=0, stdout=json.dumps({}), stderr=""
        )

        # Should not crash with relative paths
        findings = analyzer.analyze_target("relative/path/file.py")
        assert isinstance(findings, list)

        # Should not crash with absolute paths
        findings = analyzer.analyze_target("/absolute/path/file.py")
        assert isinstance(findings, list)

    def test_tool_availability_check(self, analyzer):
        """Test detect-secrets tool availability check."""
        # This test may fail if detect-secrets is not installed
        # We'll mock the subprocess call to avoid dependency issues
        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(
                returncode=0, stdout="version 1.0.0", stderr=""
            )

            # Should not raise exception
            is_available = analyzer._check_detect_secrets_availability() is None
            assert is_available is True

        with patch("subprocess.run") as mock_run:
            mock_run.side_effect = FileNotFoundError()

            # Should return False instead of raising exception
            # Method raises on failure; simulate FileNotFoundError
            with pytest.raises(DetectSecretsToolNotAvailable):
                analyzer._check_detect_secrets_availability()
