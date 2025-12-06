#!/usr/bin/env python3
"""
Pattern Detection Utility.

Distinguishes between language syntax and actual architectural patterns.
"""

import ast
import re
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from core.config.loader import ConfigError, load_architectural_pattern_sets


@dataclass
class PatternMatch:
    """Represents a detected pattern with context."""

    pattern_type: str
    pattern_name: str
    severity: str
    description: str
    line_number: int
    context: str
    confidence: float
    is_language_feature: bool


def _score_singleton(text: str) -> float:
    score = 0.0
    if "_instance" in text and "None" in text:
        score += 0.3
    if "__new__" in text:
        score += 0.2
    return score


def _score_factory(text: str) -> float:
    score = 0.0
    low = text.lower()
    if "create" in low and "return" in text:
        score += 0.3
    if "Factory" in text:
        score += 0.2
    return score


def _score_observer(text: str) -> float:
    low = text.lower()
    return 0.4 if ("observer" in low and ("notify" in low or "update" in low)) else 0.0


def _score_repository(text: str) -> float:
    low = text.lower()
    return (
        0.4
        if ("repository" in low and any(op in low for op in ["find", "save", "delete"]))
        else 0.0
    )


def _score_god_class(text: str) -> float:
    method_count = len(re.findall(r"def\s+\w+", text))
    return min(0.4, method_count * 0.02) if method_count > 10 else 0.0


_PATTERN_SCORERS: dict[str, Callable[[str], float]] = {
    "singleton": _score_singleton,
    "factory": _score_factory,
    "observer": _score_observer,
    "repository": _score_repository,
    "god_class": _score_god_class,
}


class ArchitecturalPatternDetector:
    """Detects architectural patterns while filtering out language syntax noise."""

    def __init__(self, config_dir: Path | None = None):
        # Load pattern definitions from config files (strict, no fallbacks)
        if config_dir is None:
            # shared/core/utils -> shared/config/patterns
            config_dir = Path(__file__).resolve().parents[2] / "config" / "patterns"
        try:
            config = load_architectural_pattern_sets(config_dir)
        except ConfigError as e:
            raise RuntimeError(f"Architectural pattern config error: {e}") from e

        self.architectural_patterns = config["architectural_patterns"]
        self.antipatterns = config["antipatterns"]
        self.language_features = config["language_features"]

    def detect_patterns(
        self, content: str, file_path: str, language: str
    ) -> list[PatternMatch]:
        """
        Detect architectural patterns while filtering out language features.

        Args:
            content: File content to analyze
            file_path: Path to the file being analyzed
            language: Programming language of the file

        Returns
        -------
            List of detected pattern matches
        """
        matches = []
        lines = content.split("\n")

        # First, identify language features to exclude
        language_feature_locations = self._identify_language_features(content, language)

        # Then detect architectural patterns
        for pattern_category in [self.architectural_patterns, self.antipatterns]:
            for pattern_name, pattern_info in pattern_category.items():
                pattern_matches = self._find_pattern_matches(
                    content,
                    lines,
                    pattern_name,
                    pattern_info,
                    language_feature_locations,
                    file_path,
                )
                matches.extend(pattern_matches)

        return matches

    def _identify_language_features(self, content: str, language: str) -> set[int]:
        """Identify line numbers that contain language features, not patterns.

        Process input line-by-line to avoid cross-line regex matches creating false positives.
        """
        feature_lines: set[int] = set()
        lines = content.split("\n")

        for idx, line in enumerate(lines, start=1):
            for _feature_name, feature_info in self.language_features.items():
                if language not in feature_info["languages"]:
                    continue
                for pattern in feature_info["patterns"]:
                    if re.search(pattern, line):
                        feature_lines.add(idx)
                        break

        return feature_lines

    def _find_pattern_matches(
        self,
        content: str,
        lines: list[str],
        pattern_name: str,
        pattern_info: dict,
        feature_lines: set[int],
        file_path: str,
    ) -> list[PatternMatch]:
        """Find matches for a specific pattern."""
        matches = []

        for indicator in pattern_info["indicators"]:
            for match in re.finditer(indicator, content, re.MULTILINE | re.DOTALL):
                line_num = content[: match.start()].count("\n") + 1

                # Skip if this line contains language features
                if line_num in feature_lines:
                    continue

                # Check exclude patterns
                if self._should_exclude_match(
                    match.group(0), pattern_info.get("exclude_patterns", [])
                ):
                    continue

                # Calculate confidence based on context
                confidence = self._calculate_confidence(match, content, pattern_name)

                # Only include high-confidence matches
                if confidence >= 0.7:
                    matches.append(
                        PatternMatch(
                            pattern_type=(
                                "architectural"
                                if pattern_name in self.architectural_patterns
                                else "anti"
                            ),
                            pattern_name=pattern_name,
                            severity=pattern_info["severity"],
                            description=pattern_info["description"],
                            line_number=line_num,
                            context=(
                                lines[line_num - 1].strip()
                                if line_num <= len(lines)
                                else ""
                            ),
                            confidence=confidence,
                            is_language_feature=False,
                        )
                    )

        return matches

    def _should_exclude_match(
        self, match_text: str, exclude_patterns: list[str]
    ) -> bool:
        """Check if match should be excluded based on exclude patterns."""
        for exclude_pattern in exclude_patterns:
            if re.search(exclude_pattern, match_text, re.IGNORECASE):
                return True
        return False

    def _calculate_confidence(
        self, match: re.Match, content: str, pattern_name: str
    ) -> float:
        """Calculate confidence score for a pattern match using small, pure scorers."""
        base = 0.5
        text = match.group(0)
        scorer = _PATTERN_SCORERS.get(pattern_name)
        if scorer is not None:
            base += scorer(text)
        # Penalize common false positives
        if re.search(r"@\w+", text):
            base -= 0.2
        if re.search(r"\/\*\*.*\*\/", text):
            base -= 0.3
        if re.search(r"#.*", text):
            base -= 0.1
        return max(0.0, min(1.0, base))

    def analyze_python_ast(self, content: str, file_path: str) -> list[PatternMatch]:
        """Use AST analysis for more accurate Python pattern detection."""
        matches = []

        try:
            tree = ast.parse(content)

            for node in ast.walk(tree):
                # Detect god classes
                if isinstance(node, ast.ClassDef):
                    method_count = len(
                        [n for n in node.body if isinstance(n, ast.FunctionDef)]
                    )
                    if method_count > 15:
                        matches.append(
                            PatternMatch(
                                pattern_type="anti",
                                pattern_name="god_class",
                                severity="high",
                                description=f"God class with {method_count} methods",
                                line_number=node.lineno,
                                context=f"class {node.name}:",
                                confidence=0.9,
                                is_language_feature=False,
                            )
                        )

                # Detect long parameter lists
                if isinstance(node, ast.FunctionDef):
                    param_count = len(node.args.args)
                    if param_count > 6:
                        matches.append(
                            PatternMatch(
                                pattern_type="anti",
                                pattern_name="long_parameter_list",
                                severity="medium",
                                description=f"Function with {param_count} parameters",
                                line_number=node.lineno,
                                context=f"def {node.name}(...)",
                                confidence=0.9,
                                is_language_feature=False,
                            )
                        )

        except SyntaxError:
            # Skip files with syntax errors
            pass

        return matches

    def get_pattern_summary(self, matches: list[PatternMatch]) -> dict[str, Any]:
        """Generate summary statistics for detected patterns."""
        total_matches = len(matches)

        by_type: dict[str, int] = {}
        by_severity: dict[str, int] = {}
        by_confidence = {"high": 0, "medium": 0, "low": 0}

        for match in matches:
            # Count by pattern type
            by_type[match.pattern_name] = by_type.get(match.pattern_name, 0) + 1

            # Count by severity
            by_severity[match.severity] = by_severity.get(match.severity, 0) + 1

            # Count by confidence level
            if match.confidence >= 0.8:
                by_confidence["high"] += 1
            elif match.confidence >= 0.6:
                by_confidence["medium"] += 1
            else:
                by_confidence["low"] += 1

        return {
            "total_patterns": total_matches,
            "patterns_by_type": by_type,
            "patterns_by_severity": by_severity,
            "patterns_by_confidence": by_confidence,
            "high_confidence_patterns": [m for m in matches if m.confidence >= 0.8],
            "recommendations": self._generate_recommendations(matches),
        }

    def _generate_recommendations(self, matches: list[PatternMatch]) -> list[str]:
        """Generate actionable recommendations based on detected patterns."""
        recommendations = []

        pattern_counts: dict[str, int] = {}
        for match in matches:
            pattern_counts[match.pattern_name] = (
                pattern_counts.get(match.pattern_name, 0) + 1
            )

        # Generate specific recommendations
        if pattern_counts.get("god_class", 0) > 0:
            recommendations.append(
                "Break down large classes into smaller, focused components"
            )

        if pattern_counts.get("long_parameter_list", 0) > 0:
            recommendations.append(
                "Use parameter objects or builder pattern for methods with many parameters"
            )

        if pattern_counts.get("feature_envy", 0) > 0:
            recommendations.append("Move methods closer to the data they operate on")

        if pattern_counts.get("singleton", 0) > 3:
            recommendations.append(
                "Consider dependency injection instead of multiple singletons"
            )

        # General recommendations
        total_anti_patterns = sum(1 for m in matches if m.pattern_type == "anti")
        if total_anti_patterns > 5:
            recommendations.append(
                "Consider architectural refactoring to address code smells"
            )

        return recommendations[:5]  # Limit to top 5 recommendations


def main():
    """Command-line interface for pattern detection testing."""
    import argparse

    parser = argparse.ArgumentParser(description="Test improved pattern detection")
    parser.add_argument("file_path", help="Path to file to analyze")
    parser.add_argument("--language", default="python", help="Programming language")

    args = parser.parse_args()

    detector = ArchitecturalPatternDetector()

    try:
        with open(args.file_path, encoding="utf-8") as f:
            content = f.read()

        matches = detector.detect_patterns(content, args.file_path, args.language)

        if args.language == "python":
            ast_matches = detector.analyze_python_ast(content, args.file_path)
            matches.extend(ast_matches)

        summary = detector.get_pattern_summary(matches)

        print(f"Pattern Analysis Results: {args.file_path}")
        print("=" * 50)
        print(f"Total patterns detected: {summary['total_patterns']}")
        print(f"High confidence patterns: {len(summary['high_confidence_patterns'])}")

        print("\nDetected Patterns:")
        for match in matches:
            print(
                f"  {match.pattern_name} (line {match.line_number}, confidence: {match.confidence:.2f})"
            )
            print(f"    {match.description}")
            print(f"    Context: {match.context}")
            print()

        if summary["recommendations"]:
            print("Recommendations:")
            for rec in summary["recommendations"]:
                print(f"  • {rec}")

    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()
