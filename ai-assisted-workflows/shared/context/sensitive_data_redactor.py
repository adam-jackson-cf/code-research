#!/usr/bin/env python3
"""
Sensitive Data Redaction Module for Context Capture.

Detects and redacts sensitive information from captured context data while preserving
structure and meaningful context. Designed to be self-contained with no external
dependencies for deployment to user environments.
"""

import re


class SensitiveDataRedactor:
    """Redacts sensitive data from various input formats."""

    def __init__(self, config=None):
        """Initialize with redaction configuration."""
        self.config = config or {}
        self.patterns = self.config.get("patterns", {})

        # Common environment variable patterns
        self.env_var_patterns = [
            # Standard exports: export VAR=value (including quoted values)
            (
                r'(export\s+)(\w*(?:KEY|TOKEN|PASSWORD|SECRET|CREDENTIAL)\w*)(\s*=\s*[\'"]?)([^\'"\s]*[\'"]?)',
                r"\1\2\3***",
            ),
            # Shell variables: VAR=value (including quoted values)
            (
                r'(\b)(\w*(?:KEY|TOKEN|PASSWORD|SECRET|CREDENTIAL)\w*)(\s*=\s*[\'"]?)([^\'"\s]*[\'"]?)',
                r"\1\2\3***",
            ),
            # Environment variable references: $VAR or ${VAR}
            (
                r"(\$\{?)(\w*(?:KEY|TOKEN|PASSWORD|SECRET|CREDENTIAL)\w*)(\}?)",
                r"\1\2\3",
            ),  # Keep variable names
        ]

        # API key and token patterns
        self.api_key_patterns = [
            # GitHub tokens
            (r"(ghp_)[a-zA-Z0-9_]{36}", r"\1***"),
            (r"(github_pat_)[a-zA-Z0-9_]{82}", r"\1***"),
            # OpenAI/Anthropic API keys
            (r"(sk-[a-zA-Z0-9-]{20,})", r"***"),
            (r"(claude-[a-zA-Z0-9-]{20,})", r"***"),
            # AWS keys
            (r"(AKIA[0-9A-Z]{16})", r"***"),
            (r'(aws_secret_access_key.*?[=:]\s*)([^\s\'"]+)', r"\1***"),
            # Generic Bearer tokens and Authorization headers
            (r"(Bearer\s+)([a-zA-Z0-9._-]{10,})", r"\1***"),
            (r"(Authorization:\s*Bearer\s+)([a-zA-Z0-9._-]{10,})", r"\1***"),
            # Authorization in curl commands
            (
                r'(-H\s*["\']Authorization:\s*Bearer\s+)([a-zA-Z0-9._-]{10,})(["\'])',
                r"\1***\3",
            ),
            # Any Authorization header value
            (r'(Authorization:\s*["\']?)([a-zA-Z0-9._-]{15,})(["\']?)', r"\1***\3"),
        ]

        # Password patterns in URLs and commands
        self.password_patterns = [
            # URLs with authentication: protocol://user:pass@host
            (r"((?:https?|ftp|mysql|postgresql)://[^:/@\s]+:)([^@\s]+)(@)", r"\1***\3"),
            # Command line password arguments
            (r"(--password[=\s]+)([^\s]+)", r"\1***"),
            (r"(-p\s+)([^\s]+)", r"\1***"),  # -p password
            (r"(--token[=\s]+)([^\s]+)", r"\1***"),
            (r"(--secret[=\s]+)([^\s]+)", r"\1***"),
        ]

        # JSON/YAML secret patterns
        self.json_patterns = [
            # JSON string values for common secret keys
            (
                r'("(?:api_?key|token|password|secret|credential)":\s*")([^"]+)(")',
                r"\1***\3",
            ),
            (
                r'("(?:API_?KEY|TOKEN|PASSWORD|SECRET|CREDENTIAL)":\s*")([^"]+)(")',
                r"\1***\3",
            ),
        ]

        # Common sensitive environment variable names
        self.sensitive_env_names = {
            "API_KEY",
            "APIKEY",
            "SECRET_KEY",
            "SECRETKEY",
            "PASSWORD",
            "PASSWD",
            "TOKEN",
            "ACCESS_TOKEN",
            "REFRESH_TOKEN",
            "AUTH_TOKEN",
            "BEARER_TOKEN",
            "PRIVATE_KEY",
            "CERT_KEY",
            "SSH_KEY",
            "GPG_KEY",
            "PGP_KEY",
            "DATABASE_PASSWORD",
            "DB_PASSWORD",
            "DB_PASS",
            "MYSQL_PASSWORD",
            "POSTGRES_PASSWORD",
            "REDIS_PASSWORD",
            "MONGODB_PASSWORD",
            "AWS_SECRET_ACCESS_KEY",
            "AWS_SESSION_TOKEN",
            "GITHUB_TOKEN",
            "GITLAB_TOKEN",
            "BITBUCKET_TOKEN",
            "OPENAI_API_KEY",
            "ANTHROPIC_API_KEY",
            "CLAUDE_API_KEY",
            "STRIPE_SECRET_KEY",
            "PAYPAL_SECRET",
            "TWILIO_AUTH_TOKEN",
            "SLACK_BOT_TOKEN",
            "DISCORD_TOKEN",
            "TELEGRAM_BOT_TOKEN",
        }

    def is_sensitive_env_var(self, var_name):
        """Check if environment variable name indicates sensitive content."""
        var_upper = var_name.upper()

        # Direct match with known sensitive names
        if var_upper in self.sensitive_env_names:
            return True

        # Pattern matching for common sensitive suffixes/prefixes
        sensitive_patterns = [
            "KEY",
            "TOKEN",
            "SECRET",
            "PASSWORD",
            "PASS",
            "CREDENTIAL",
            "CERT",
        ]

        return any(pattern in var_upper for pattern in sensitive_patterns)

    def redact_environment_variables(self, text):
        """Redact environment variable assignments and references."""
        if not self.patterns.get("env_vars", True):
            return text

        result = text

        # Apply environment variable patterns
        for pattern, replacement in self.env_var_patterns:
            result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)

        # Handle os.getenv() and similar calls
        getenv_pattern = (
            r'(os\.getenv\([\'"])([^\'"]+)([\'"],?\s*[\'"]?)([^\'"]*)([\'"]?\))'
        )

        def redact_getenv(match):
            prefix, var_name, middle, default_val, suffix = match.groups()
            if self.is_sensitive_env_var(var_name):
                if default_val and default_val.strip():
                    return f"{prefix}{var_name}{middle}***{suffix}"
                else:
                    return f"{prefix}{var_name}{middle}{suffix}"
            return match.group(0)

        result = re.sub(getenv_pattern, redact_getenv, result)

        return result

    def redact_api_keys(self, text):
        """Redact API keys and tokens."""
        if not self.patterns.get("api_keys", True):
            return text

        result = text
        for pattern, replacement in self.api_key_patterns:
            result = re.sub(pattern, replacement, result)

        return result

    def redact_passwords(self, text):
        """Redact passwords in URLs and command line arguments."""
        if not self.patterns.get("passwords", True):
            return text

        result = text
        for pattern, replacement in self.password_patterns:
            result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)

        return result

    def redact_json_secrets(self, text):
        """Redact secret values in JSON/YAML-like structures."""
        if not self.patterns.get("json_secrets", True):
            return text

        result = text
        for pattern, replacement in self.json_patterns:
            result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)

        return result

    def redact_urls_with_auth(self, text):
        """Redact authentication in URLs."""
        if not self.patterns.get("urls_with_auth", True):
            return text

        # This is handled in redact_passwords, but we can add URL-specific logic here
        return self.redact_passwords(text)

    def apply_custom_patterns(self, text):
        """Apply user-defined custom redaction patterns."""
        custom_patterns = self.config.get("custom_patterns", [])
        result = text

        for pattern_config in custom_patterns:
            if isinstance(pattern_config, dict):
                pattern = pattern_config.get("pattern")
                replacement = pattern_config.get("replacement", "***")
                flags = pattern_config.get("flags", 0)

                if pattern:
                    try:
                        result = re.sub(pattern, replacement, result, flags=flags)
                    except re.error:
                        # Skip invalid regex patterns
                        continue

        return result

    def redact_sensitive_data(self, text, preserve_structure=True):
        """Apply all configured redaction patterns to the input text."""
        if not text or not isinstance(text, str):
            return text

        result = text

        # Apply all enabled redaction patterns
        if self.patterns.get("env_vars", True):
            result = self.redact_environment_variables(result)

        if self.patterns.get("api_keys", True):
            result = self.redact_api_keys(result)

        if self.patterns.get("passwords", True):
            result = self.redact_passwords(result)

        if self.patterns.get("urls_with_auth", True):
            result = self.redact_urls_with_auth(result)

        if self.patterns.get("json_secrets", True):
            result = self.redact_json_secrets(result)

        # Apply custom patterns last
        result = self.apply_custom_patterns(result)

        return result


# Module-level convenience function
def redact_sensitive_data(text, config=None):
    """Redact sensitive data from text using configured patterns."""
    redactor = SensitiveDataRedactor(config)
    return redactor.redact_sensitive_data(
        text, preserve_structure=config.get("preserve_structure", True)
    )


# Test function for development/debugging
def test_redaction():
    """Test the redaction functionality with sample data."""
    test_cases = [
        "export GITHUB_TOKEN=ghp_1234567890abcdefghijklmnopqrstuvwxyz123456",
        "curl -H 'Authorization: Bearer sk-proj-abcd1234567890'",
        "mysql://user:mypassword@localhost:3306/db",
        'export API_KEY="sk-1234567890abcdef"',
        "--password=MySecret123!",
        'os.getenv("OPENAI_API_KEY", "default-key")',
        '{"api_key": "secret123", "name": "test"}',
        "aws configure set aws_secret_access_key AKIAIOSFODNN7EXAMPLE",
    ]

    redactor = SensitiveDataRedactor(
        {
            "patterns": {
                "env_vars": True,
                "api_keys": True,
                "passwords": True,
                "urls_with_auth": True,
                "json_secrets": True,
            }
        }
    )

    print("Testing sensitive data redaction:")
    for i, test_case in enumerate(test_cases, 1):
        redacted = redactor.redact_sensitive_data(test_case)
        print(f"{i}. Original: {test_case}")
        print(f"   Redacted: {redacted}")
        print()


if __name__ == "__main__":
    test_redaction()
