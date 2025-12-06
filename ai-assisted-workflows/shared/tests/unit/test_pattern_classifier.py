#!/usr/bin/env python3
"""
Unit tests for pattern_classifier.py - Pattern Classification Engine.

Tests the anti-pattern detection, code smell detection, security pattern detection,
and overall pattern classification capabilities.
"""

import ast
import tempfile
from pathlib import Path

import pytest
from analyzers.quality.pattern_classifier import (
    AntiPatternDetector,
    CodeSmellDetector,
    CompositePatternClassifier,
    PatternMatch,
    PatternSeverity,
    PatternType,
    SecurityPatternDetector,
    classify_code_patterns,
)


class TestPatternEnums:
    """Test PatternType and PatternSeverity enums."""

    def test_pattern_types(self):
        """Test that all expected pattern types are defined."""
        expected_types = [
            "design_pattern",
            "anti_pattern",
            "code_smell",
            "best_practice",
            "security_issue",
            "performance_issue",
        ]

        for pattern_type in expected_types:
            assert PatternType(pattern_type).value == pattern_type

    def test_severity_levels(self):
        """Test that all expected severity levels are defined."""
        expected_severities = [
            "critical",
            "high",
            "medium",
            "low",
            "info",
        ]

        for severity in expected_severities:
            assert PatternSeverity(severity).value == severity


class TestPatternMatch:
    """Test PatternMatch dataclass."""

    def test_pattern_match_creation(self):
        """Test creation of PatternMatch objects."""
        match = PatternMatch(
            pattern_name="Test Pattern",
            pattern_type=PatternType.CODE_SMELL,
            severity=PatternSeverity.MEDIUM,
            file_path="/test/file.py",
            start_line=10,
            end_line=20,
            confidence=0.8,
            description="Test description",
            recommendation="Test recommendation",
            code_snippet="def test(): pass",
            metadata={"test_key": "test_value"},
        )

        assert match.pattern_name == "Test Pattern"
        assert match.pattern_type == PatternType.CODE_SMELL
        assert match.severity == PatternSeverity.MEDIUM
        assert match.confidence == 0.8
        assert match.metadata["test_key"] == "test_value"

    def test_pattern_match_with_default_metadata(self):
        """Test PatternMatch with default metadata."""
        match = PatternMatch(
            pattern_name="Test",
            pattern_type=PatternType.BEST_PRACTICE,
            severity=PatternSeverity.LOW,
            file_path="test.py",
            start_line=1,
            end_line=1,
            confidence=0.5,
            description="Test",
            recommendation="Fix it",
            code_snippet="code",
        )

        assert match.metadata == {}


class TestAntiPatternDetector:
    """Test anti-pattern detection functionality."""

    @pytest.fixture
    def detector(self):
        """Create AntiPatternDetector instance."""
        return AntiPatternDetector()

    def test_detect_god_class(self, detector):
        """Test god class detection."""
        # Generate a class with many methods and attributes to exceed thresholds
        lines = ["class GodClass:", "    def __init__(self):"]
        for i in range(20):
            lines.append(f"        self.attr{i} = {i}")
        for i in range(35):
            lines.append(f"    def method{i}(self):\n        pass")
        god_class_code = "\n".join(lines)

        tree = ast.parse(god_class_code)
        matches = detector._detect_god_class(tree, god_class_code, "test.py")

        assert len(matches) > 0
        match = matches[0]
        assert match.pattern_name == "God Class"
        assert match.pattern_type == PatternType.ANTI_PATTERN
        assert match.severity in [PatternSeverity.HIGH, PatternSeverity.MEDIUM]
        assert "too many responsibilities" in match.description

    def test_detect_long_method(self, detector):
        """Test long method detection."""
        method_lines = ["def very_long_method():"]
        method_lines += [f"    x{i} = {i}" for i in range(60)]
        method_lines.append("    return 0")
        long_method_code = "\n".join(method_lines)

        tree = ast.parse(long_method_code)
        matches = detector._detect_long_method(tree, long_method_code, "test.py")

        assert len(matches) > 0
        match = matches[0]
        assert match.pattern_name == "Long Method"
        assert match.pattern_type == PatternType.ANTI_PATTERN
        assert "too long" in match.description

    def test_detect_feature_envy(self, detector):
        """Test feature envy detection."""
        feature_envy_code = """
class MyClass:
    def process_order(self, order):
        # Method uses external class more than its own
        self.validate()

        # Many references to Order class
        order.calculate_total()
        order.apply_discount()
        order.save()
        order.send_confirmation()
        order.update_inventory()
        order.notify_customer()

        # Only one self reference
        return order.status
"""

        tree = ast.parse(feature_envy_code)
        matches = detector._detect_feature_envy(tree, feature_envy_code, "test.py")

        assert len(matches) > 0
        match = matches[0]
        assert match.pattern_name == "Feature Envy"
        assert "more interested in" in match.description

    def test_detect_data_clumps(self, detector):
        """Test data clumps detection."""
        data_clumps_code = """
def process_user(user_id, name, email, phone, address):
    # Function 1 with parameter group
    send_welcome_email(name, email)
    save_user_data(user_id, name, email, phone, address)

def update_user(user_id, name, email, phone, address):
    # Function 2 with same parameter group
    update_database(user_id, name, email, phone, address)
    send_notification(name, email)

def delete_user(user_id, name, email, phone, address):
    # Function 3 with same parameter group
    cleanup_data(user_id, name, email, phone, address)
"""

        tree = ast.parse(data_clumps_code)
        matches = detector._detect_data_clumps(tree, data_clumps_code, "test.py")

        assert len(matches) > 0
        match = matches[0]
        assert match.pattern_name == "Data Clumps"
        assert "parameters that appear together" in match.description

    def test_get_pattern_types(self, detector):
        """Test that detector returns correct pattern types."""
        types = detector.get_pattern_types()
        assert PatternType.ANTI_PATTERN in types

    def test_detect_patterns_integration(self, detector):
        """Test integration of pattern detection."""
        test_code = """
class LargeClass:
    def __init__(self):
        self.attr1 = 1
        self.attr2 = 2

    def long_method(self):
        # Long method
        result = []
        for i in range(100):
            for j in range(100):
                result.append(i * j)
        return result
"""

        matches = detector.detect_patterns(test_code, "test.py")

        # Should find patterns
        assert len(matches) > 0
        # All matches should be anti-patterns
        for match in matches:
            assert match.pattern_type == PatternType.ANTI_PATTERN


class TestCodeSmellDetector:
    """Test code smell detection functionality."""

    @pytest.fixture
    def detector(self):
        """Create CodeSmellDetector instance."""
        return CodeSmellDetector()

    def test_detect_dead_code(self, detector):
        """Test dead code detection."""
        dead_code_code = """
def function_with_dead_code():
    return "already returned"

    # This code is unreachable
    print("This will never execute")
    x = 1 + 2
    return x  # Also unreachable
"""

        tree = ast.parse(dead_code_code)
        matches = detector._detect_dead_code(tree, dead_code_code, "test.py")

        assert len(matches) > 0
        match = matches[0]
        assert match.pattern_name == "Dead Code"
        assert match.pattern_type == PatternType.CODE_SMELL
        assert "unreachable" in match.description

    def test_detect_large_class(self, detector):
        """Test large class detection."""
        # Simulate a large class by creating a long string
        lines = ["class LargeClass:"]
        for i in range(350):
            lines.append(f"    def method{i}(self): pass")
        large_class_content = "\n".join(lines)

        tree = ast.parse(large_class_content)
        matches = detector._detect_large_class(tree, large_class_content, "test.py")

        assert len(matches) > 0
        match = matches[0]
        assert match.pattern_name == "Large Class"
        assert match.pattern_type == PatternType.CODE_SMELL
        assert "very large" in match.description

    def test_detect_long_parameter_list(self, detector):
        """Test long parameter list detection."""
        long_params_code = """
def function_with_many_params(param1, param2, param3, param4, param5, param6, param7, param8):
    return param1 + param2 + param3 + param4 + param5 + param6 + param7 + param8
"""

        tree = ast.parse(long_params_code)
        matches = detector._detect_long_parameter_list(
            tree, long_params_code, "test.py"
        )

        assert len(matches) > 0
        match = matches[0]
        assert match.pattern_name == "Long Parameter List"
        assert match.pattern_type == PatternType.CODE_SMELL
        assert "too many parameters" in match.description

    def test_detect_switch_statements(self, detector):
        """Test complex switch statement detection."""
        switch_code = """
def process_request(request_type):
    if request_type == "CREATE":
        create_item()
    elif request_type == "READ":
        read_item()
    elif request_type == "UPDATE":
        update_item()
    elif request_type == "DELETE":
        delete_item()
    elif request_type == "LIST":
        list_items()
    elif request_type == "SEARCH":
        search_items()
    elif request_type == "EXPORT":
        export_items()
    elif request_type == "IMPORT":
        import_items()
"""

        tree = ast.parse(switch_code)
        matches = detector._detect_switch_statements(tree, switch_code, "test.py")

        assert len(matches) > 0
        match = matches[0]
        assert match.pattern_name == "Complex Switch Statement"
        assert match.pattern_type == PatternType.CODE_SMELL
        assert "if-elif chain" in match.description

    def test_get_pattern_types(self, detector):
        """Test that detector returns correct pattern types."""
        types = detector.get_pattern_types()
        assert PatternType.CODE_SMELL in types


class TestSecurityPatternDetector:
    """Test security pattern detection functionality."""

    @pytest.fixture
    def detector(self):
        """Create SecurityPatternDetector instance."""
        return SecurityPatternDetector()

    def test_detect_sql_injection(self, detector):
        """Test SQL injection detection."""
        sql_injection_code = """
def get_user(user_id):
    return cursor.execute("SELECT * FROM users WHERE id = " + str(user_id))
"""

        tree = ast.parse(sql_injection_code)
        matches = detector._detect_sql_injection(tree, sql_injection_code, "test.py")

        assert len(matches) > 0
        match = matches[0]
        assert match.pattern_name == "SQL Injection Risk"
        assert match.pattern_type == PatternType.SECURITY_ISSUE
        assert match.severity == PatternSeverity.HIGH

    def test_detect_hardcoded_secrets(self, detector):
        """Test hardcoded secrets detection."""
        secrets_code = """
class Config:
    def __init__(self):
        self.password = "super_secret_password_123"  # Bad!
        self.api_key = "12345-abcde-67890-fghij"  # Very bad!
        self.db_host = "localhost"  # This is fine
"""

        tree = ast.parse(secrets_code)
        matches = detector._detect_hardcoded_secrets(tree, secrets_code, "test.py")

        assert len(matches) >= 2  # Should find password and API key
        for match in matches:
            assert match.pattern_name == "Hardcoded Secrets"
            assert match.pattern_type == PatternType.SECURITY_ISSUE
            assert match.severity == PatternSeverity.CRITICAL

    def test_detect_insecure_random(self, detector):
        """Test insecure random number generation detection."""
        insecure_code = """
def generate_token():
    import random
    return random.randint(0, 1000000)  # Not cryptographically secure
"""

        tree = ast.parse(insecure_code)
        matches = detector._detect_insecure_random(tree, insecure_code, "test.py")

        assert len(matches) > 0
        match = matches[0]
        assert match.pattern_name == "Insecure Random"
        assert match.pattern_type == PatternType.SECURITY_ISSUE
        assert "insecure random number generation" in match.description

    def test_detect_eval_usage(self, detector):
        """Test dangerous eval/exec usage detection."""
        eval_code = """
def execute_code(code_string):
    return eval(code_string)  # Very dangerous!
"""

        tree = ast.parse(eval_code)
        matches = detector._detect_eval_usage(tree, eval_code, "test.py")

        assert len(matches) > 0
        match = matches[0]
        assert match.pattern_name == "Dangerous Code Execution"
        assert match.pattern_type == PatternType.SECURITY_ISSUE
        assert match.severity == PatternSeverity.CRITICAL

    def test_detect_string_patterns(self, detector):
        """Test string-based security pattern detection."""
        string_patterns_code = """
import subprocess
def run_command(user_input):
    # Command injection risk
    result = subprocess.call("ls " + user_input, shell=True)
    return result
"""

        matches = detector._detect_string_patterns(string_patterns_code, "test.py")

        assert len(matches) > 0
        match = matches[0]
        assert match.pattern_name == "Command Injection Risk"
        assert match.pattern_type == PatternType.SECURITY_ISSUE

    def test_get_pattern_types(self, detector):
        """Test that detector returns correct pattern types."""
        types = detector.get_pattern_types()
        assert PatternType.SECURITY_ISSUE in types


class TestCompositePatternClassifier:
    """Test the composite pattern classifier."""

    @pytest.fixture
    def classifier(self):
        """Create CompositePatternClassifier instance."""
        return CompositePatternClassifier()

    def test_analyzer_initialization(self, classifier):
        """Test analyzer initialization with detectors."""
        assert len(classifier.detectors) == 3  # Default 3 detectors
        detector_types = [type(d).__name__ for d in classifier.detectors]
        assert "AntiPatternDetector" in detector_types
        assert "CodeSmellDetector" in detector_types
        assert "SecurityPatternDetector" in detector_types

    def test_analyze_target_creates_findings(self, classifier):
        """Test that analyze_target creates findings from patterns."""
        test_code = """
class LargeClass:
    def __init__(self):
        self.password = "hardcoded_password"

    def long_method(self):
        query = "SELECT * FROM table WHERE id = " + str(1)
        # Many lines of code...
        return query
"""

        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(test_code)
            f.flush()

            findings = classifier.analyze_target(f.name)

            # Should find multiple patterns
            assert len(findings) > 0

            # Check that findings have proper structure
            for finding in findings:
                assert "title" in finding
                assert "description" in finding
                assert "severity" in finding
                assert "file_path" in finding
                assert "line_number" in finding
                assert "recommendation" in finding
                assert "metadata" in finding

            Path(f.name).unlink()

    def test_classify_patterns_integration(self, classifier):
        """Test pattern classification integration."""
        test_code = """
def insecure_function():
    password = "secret123"
    eval("user_input")
    return random.randint(0, 100)
"""

        matches = classifier.classify_patterns(test_code, "test.py")

        # Should find multiple security issues
        security_matches = [
            m for m in matches if m.pattern_type == PatternType.SECURITY_ISSUE
        ]
        assert len(security_matches) >= 2  # hardcoded secret and eval usage

    def test_deduplicate_matches(self, classifier):
        """Test match deduplication."""
        # Create duplicate matches
        match1 = PatternMatch(
            "Test",
            PatternType.CODE_SMELL,
            PatternSeverity.LOW,
            "test.py",
            1,
            5,
            0.8,
            "desc",
            "rec",
            "code",
        )
        match2 = PatternMatch(
            "Test",
            PatternType.CODE_SMELL,
            PatternSeverity.LOW,
            "test.py",
            1,
            5,
            0.9,
            "desc",
            "rec",
            "code",
        )  # Same location, different confidence

        deduplicated = classifier._deduplicate_matches([match1, match2])
        assert len(deduplicated) == 1  # Should deduplicate

    def test_sort_matches(self, classifier):
        """Test match sorting by severity and confidence."""
        matches = [
            PatternMatch(
                "Low",
                PatternType.CODE_SMELL,
                PatternSeverity.LOW,
                "test.py",
                1,
                1,
                0.5,
                "desc",
                "rec",
                "code",
            ),
            PatternMatch(
                "Critical",
                PatternType.SECURITY_ISSUE,
                PatternSeverity.CRITICAL,
                "test.py",
                2,
                2,
                0.7,
                "desc",
                "rec",
                "code",
            ),
            PatternMatch(
                "High",
                PatternType.ANTI_PATTERN,
                PatternSeverity.HIGH,
                "test.py",
                3,
                3,
                0.9,
                "desc",
                "rec",
                "code",
            ),
        ]

        sorted_matches = classifier._sort_matches(matches)

        # Should be sorted: Critical, High, Low
        assert sorted_matches[0].severity == PatternSeverity.CRITICAL
        assert sorted_matches[1].severity == PatternSeverity.HIGH
        assert sorted_matches[2].severity == PatternSeverity.LOW

    def test_get_analyzer_metadata(self, classifier):
        """Test metadata generation."""
        metadata = classifier.get_analyzer_metadata()

        assert metadata["analysis_type"] == "pattern_classification"
        assert "pattern_detectors" in metadata
        assert "pattern_types" in metadata
        assert "severity_levels" in metadata
        assert "supported_languages" in metadata

    def test_error_handling_syntax_error(self, classifier):
        """Test handling of syntax errors in analyzed code."""
        invalid_code = """
def invalid_function(
    # Missing closing parenthesis
    return "error"
"""

        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(invalid_code)
            f.flush()

            # Should not crash, should return error findings
            findings = classifier.analyze_target(f.name)

            # Should have at least one finding about the error
            assert len(findings) > 0

            Path(f.name).unlink()

    def test_custom_detectors(self, classifier):
        """Test classifier with custom detectors."""
        from analyzers.quality.pattern_classifier import PatternDetector

        class CustomDetector(PatternDetector):
            def detect_patterns(self, code, file_path):
                return [
                    PatternMatch(
                        "Custom",
                        PatternType.BEST_PRACTICE,
                        PatternSeverity.INFO,
                        file_path,
                        1,
                        1,
                        1.0,
                        "Custom pattern",
                        "Good job",
                        "code",
                    )
                ]

            def get_pattern_types(self):
                return [PatternType.BEST_PRACTICE]

        custom_classifier = CompositePatternClassifier(detectors=[CustomDetector()])
        matches = custom_classifier.classify_patterns("test code", "test.py")

        assert len(matches) == 1
        assert matches[0].pattern_name == "Custom"
        assert matches[0].pattern_type == PatternType.BEST_PRACTICE


class TestLegacyFunction:
    """Test the legacy classify_code_patterns function."""

    def test_legacy_function_success(self):
        """Test that legacy function works."""
        results = classify_code_patterns(__file__)

        assert "success" in results
        assert "findings" in results
        assert "metadata" in results
        assert results["success"] is True

    def test_legacy_function_with_format(self):
        """Test legacy function with different output formats."""
        for fmt in ["json", "console", "summary"]:
            results = classify_code_patterns(__file__, output_format=fmt)
            assert results["success"] is True

    def test_legacy_function_error_handling(self):
        """Test error handling in legacy function."""
        results = classify_code_patterns("/nonexistent/file.py")

        # Should handle errors gracefully
        assert "success" in results
        assert "error" in results or results["findings"] == []
