#!/usr/bin/env python3
"""
Architecture Pattern Evaluation Analyzer - Design Pattern Analysis and Evaluation.

PURPOSE: Analyzes design patterns and architectural decisions in codebases.
Part of the shared/analyzers/architecture suite using BaseAnalyzer infrastructure.

APPROACH:
- Multi-language pattern detection
- Design pattern identification (Singleton, Factory, Observer, etc.)
- Anti-pattern detection (God Class, Feature Envy, etc.)
- Architectural pattern analysis (MVC, Repository, Service Layer)
- Code complexity analysis (method length, parameter count)
- Pattern density and recommendations

EXTENDS: BaseAnalyzer for common analyzer infrastructure
- Inherits file scanning, CLI, configuration, and result formatting
- Implements pattern-specific analysis logic in analyze_target()
- Uses shared timing, logging, and error handling patterns
"""

import re
import subprocess
from pathlib import Path
from typing import Any

# Import base analyzer (package root must be on PYTHONPATH)
from core.base.analyzer_base import AnalyzerConfig, BaseAnalyzer
from core.base.analyzer_registry import register_analyzer


@register_analyzer("architecture:patterns")
class PatternEvaluationAnalyzer(BaseAnalyzer):
    """Evaluates design patterns and architectural decisions."""

    def __init__(self, config: AnalyzerConfig | None = None):
        # Create pattern-specific configuration
        pattern_config = config or AnalyzerConfig(
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

        # Initialize base analyzer
        super().__init__("architecture", pattern_config)

        # Initialize pattern definitions
        self._init_design_patterns()
        self._init_anti_patterns()
        self._init_architectural_patterns()
        self._init_language_patterns()
        self._init_config_file_patterns()
        # Cache to reduce repeated Lizard CLI invocations per file
        self._lizard_cache: dict[str, dict[str, Any]] = {}

    def get_analyzer_metadata(self) -> dict[str, Any]:
        """Return metadata about this analyzer."""
        return {
            "name": "Pattern Evaluation Analyzer",
            "version": "2.0.0",
            "description": "Analyzes design patterns and architectural decisions in codebases",
            "category": "architecture",
            "priority": "high",
            "capabilities": [
                "Design pattern detection (Singleton, Factory, Observer, etc.)",
                "Anti-pattern identification (God Class, Feature Envy, etc.)",
                "Architectural pattern analysis (MVC, Repository, Service)",
                "Code complexity analysis (method length, parameters)",
                "Pattern density metrics",
                "Multi-language pattern recognition",
                "Pattern-specific recommendations",
            ],
            "supported_formats": list(self.config.code_extensions),
            "pattern_types": {
                "design_patterns": len(self.design_patterns),
                "anti_patterns": len(self.anti_patterns),
                "architectural_patterns": len(self.architectural_patterns),
            },
        }

    # analyze method removed - using BaseAnalyzer default implementation

    def analyze_target(self, target_path: str) -> list[dict[str, Any]]:
        """
        Analyze a single file for design patterns.

        Args:
            target_path: Path to file to analyze

        Returns
        -------
            List of findings with standardized structure
        """
        # Debug logging removed

        all_findings = []
        file_path = Path(target_path)

        try:
            # Skip config files that commonly cause false positives
            if self._should_skip_file(file_path):
                return all_findings

            with open(file_path, encoding="utf-8", errors="ignore") as f:
                content = f.read()
                lines = content.split("\n")

            # Early exit for files that are too large or complex
            if len(content) > 50000 or len(lines) > 1000:
                return all_findings

            # Detect programming language
            language = self._detect_language(file_path)

            # Analyze design patterns
            findings = self._check_patterns(
                content, lines, str(file_path), self.design_patterns, "design", language
            )
            all_findings.extend(findings)

            # Analyze anti-patterns
            findings = self._check_patterns(
                content, lines, str(file_path), self.anti_patterns, "anti", language
            )
            all_findings.extend(findings)

            # Analyze architectural patterns
            findings = self._check_patterns(
                content,
                lines,
                str(file_path),
                self.architectural_patterns,
                "architectural",
                language,
            )
            all_findings.extend(findings)

            # Analyze complexity patterns
            findings = self._check_complexity_patterns(
                content, lines, str(file_path), language
            )
            all_findings.extend(findings)

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

        # Deduplicate findings to prevent duplicate reports
        return self._deduplicate_findings(all_findings)

    def _init_design_patterns(self):
        """Initialize design pattern definitions."""
        self.design_patterns = {
            "singleton": {
                "indicators": [
                    r"__instance\s*=\s*None",  # Python singleton (simplified)
                    r"private\s+static\s+\w+\s+instance",  # Java/C# singleton
                    r"getInstance\(\)",  # Common getInstance method
                ],
                "severity": "medium",
                "description": "Singleton pattern detected",
            },
            "factory": {
                "indicators": [
                    r"def\s+create_\w+\(",  # Python factory methods
                    r"class\s+\w*Factory\w*",  # Factory class names
                    r"def\s+\w*factory\w*\(",  # Factory function names
                ],
                "severity": "low",
                "description": "Factory pattern detected",
            },
            "observer": {
                "indicators": [
                    r"def\s+notify\(",  # Observer notify methods
                    r"def\s+subscribe\(",  # Subscription methods
                    r"def\s+add_listener\(",  # Event listener patterns
                    r"class\s+\w*Observer\w*",  # Observer class names
                ],
                "severity": "low",
                "description": "Observer pattern detected",
            },
            "strategy": {
                "indicators": [
                    r"def\s+execute\(",  # Strategy execute methods
                    r"class\s+\w*Strategy\w*",  # Strategy class names
                    r"def\s+algorithm\(",  # Algorithm methods
                ],
                "severity": "low",
                "description": "Strategy pattern detected",
            },
            "decorator": {
                "indicators": [
                    r"@\w+\s*\n\s*def\s+",  # Python decorators before functions
                    r"@\w+\s*\n\s*class\s+",  # Python decorators before classes
                    r"class\s+\w*Decorator\w*",  # Decorator class names
                ],
                "severity": "low",
                "description": "Decorator pattern detected",
            },
        }

    def _init_anti_patterns(self):
        """Initialize anti-pattern definitions."""
        self.anti_patterns = {
            "god_class": {
                "indicators": [
                    r"class\s+\w+.*:",  # Simplified - just detect classes, let complexity check handle size
                ],
                "severity": "high",
                "description": "God Class anti-pattern detected - overly large class",
            },
            "feature_envy": {
                "indicators": [
                    r"\w+_\w+\.\w+_\w+\.\w+_\w+\.\w+",  # Very deep chaining with underscores (real coupling)
                    r"other\w*\.\w+\.\w+\.\w+",  # Accessing other object's nested methods frequently
                ],
                "severity": "medium",
                "description": "Feature Envy anti-pattern detected - excessive coupling to external objects",
            },
            "data_class": {
                "indicators": [
                    r"class\s+\w+.*:\s*\n\s*def\s+__init__",  # Class with only init
                    r"@dataclass\s*\nclass\s+\w+.*:\s*\n\s*\w+:\s*\w+",  # Simple dataclass
                ],
                "severity": "low",
                "description": "Data Class anti-pattern detected",
            },
            "long_parameter_list": {
                "indicators": [
                    r"def\s+\w+\([^)]{80,}\)",  # Very long parameter lists
                ],
                "severity": "medium",
                "description": "Long Parameter List anti-pattern detected",
            },
        }

    def _init_architectural_patterns(self):
        """Initialize architectural pattern definitions."""
        self.architectural_patterns = {
            "mvc": {
                "indicators": [
                    r"class\s+\w*Controller\w*",  # Controller classes
                    r"class\s+\w*Model\w*",  # Model classes
                    r"class\s+\w*View\w*",  # View classes
                ],
                "severity": "low",
                "description": "MVC architectural pattern detected",
            },
            "repository": {
                "indicators": [
                    r"class\s+\w*Repository\w*",  # Repository classes
                    r"def\s+find_by_\w+\(",  # Repository query methods
                    r"def\s+save\(",  # Repository save methods
                ],
                "severity": "low",
                "description": "Repository pattern detected",
            },
            "service": {
                "indicators": [
                    r"class\s+\w*Service\w*",  # Service classes
                    r"@service",  # Service decorators
                    r"def\s+process\w*\(",  # Service processing methods
                ],
                "severity": "low",
                "description": "Service Layer pattern detected",
            },
            "dependency_injection": {
                "indicators": [
                    r"@inject",  # Dependency injection decorators
                    r"def\s+__init__\(self,.*:\s*\w+\)",  # Type-hinted constructors
                    r"container\.",  # DI container usage
                ],
                "severity": "low",
                "description": "Dependency Injection pattern detected",
            },
        }

    def _init_language_patterns(self):
        """Initialize language-specific patterns."""
        self.language_patterns = {
            "python": {
                "method_pattern": r"def\s+(\w+)\s*\([^)]*\):",
                "class_pattern": r"class\s+(\w+).*:",
                "import_pattern": r"^(?:from\s+\w+\s+)?import\s+",
            },
            "javascript": {
                "method_pattern": r"(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>))",
                "class_pattern": r"class\s+(\w+)",
                "import_pattern": r"^(?:import|const|let|var).*(?:from|require)",
            },
            "java": {
                "method_pattern": r"(?:public|private|protected|static|final)?\s*\w+\s+(\w+)\s*\(",
                "class_pattern": r"(?:public\s+)?class\s+(\w+)",
                "import_pattern": r"^import\s+",
            },
        }

    def _check_patterns(
        self,
        content: str,
        lines: list[str],
        file_path: str,
        pattern_dict: dict,
        pattern_type: str,
        language: str = "unknown",
    ) -> list[dict[str, Any]]:
        """Check for specific patterns in file content."""
        import signal

        findings = []

        # Safety limit for large files
        if len(content) > 10000:  # Skip files > 10KB to prevent hangs
            return findings

        # Timeout protection
        def timeout_handler(signum, frame):
            raise TimeoutError("Pattern analysis timeout")

        signal.signal(signal.SIGALRM, timeout_handler)
        signal.alarm(10)  # 10 second timeout (increased from 5)

        try:
            for pattern_idx, (pattern_name, pattern_info) in enumerate(
                pattern_dict.items()
            ):
                if pattern_idx > 5:  # Max 5 patterns per type to prevent hangs
                    break

                for indicator_idx, indicator in enumerate(pattern_info["indicators"]):
                    if indicator_idx > 3:  # Max 3 indicators per pattern
                        break

                    try:
                        # Compile pattern with timeout protection
                        compiled_pattern = re.compile(
                            indicator, re.MULTILINE | re.IGNORECASE
                        )

                        matches = list(compiled_pattern.finditer(content))

                        # Limit number of matches processed
                        if len(matches) > 10:
                            matches = matches[:10]

                    except re.error:
                        # Skip invalid regex patterns
                        continue

                    for match_idx, match in enumerate(matches):
                        if match_idx > 5:  # Max 5 matches per pattern
                            break

                        line_num = content[: match.start()].count("\n") + 1
                        context = (
                            lines[line_num - 1].strip()
                            if line_num <= len(lines)
                            else ""
                        )

                        findings.append(
                            {
                                "title": f"{pattern_type.title()} Pattern: {pattern_name.title()}",
                                "description": pattern_info["description"],
                                "severity": pattern_info["severity"],
                                "file_path": file_path,
                                "line_number": line_num,
                                "recommendation": self._get_pattern_recommendation(
                                    f"{pattern_type}_{pattern_name}"
                                ),
                                "metadata": {
                                    "pattern_type": pattern_type,
                                    "pattern_name": pattern_name,
                                    "language": language,
                                    "context": context,
                                    "confidence": "medium",
                                },
                            }
                        )
        except TimeoutError:
            # Return partial findings if timeout occurs
            pass
        finally:
            signal.alarm(0)  # Cancel the alarm

        return findings

    def _get_lizard_metrics(self, file_path: str) -> dict[str, Any]:
        """Get Lizard complexity metrics for the file."""
        if file_path in self._lizard_cache:
            return self._lizard_cache[file_path]
        try:
            result = subprocess.run(
                ["lizard", "-C", "999", "-L", "999", "-a", "999", file_path],
                capture_output=True,
                text=True,
                timeout=10,
            )

            if result.returncode == 0:
                # Parse lizard output for metrics
                lines = result.stdout.strip().split("\n")
                metrics = {
                    "functions": [],
                    "avg_ccn": 0,
                    "max_ccn": 0,
                    "total_functions": 0,
                }

                # Track function names for deduplication
                seen_functions = set()

                for line in lines:
                    if (
                        line.strip()
                        and not line.startswith("=")
                        and not line.startswith("NLOC")
                        and not line.startswith("-")
                        and "file analyzed" not in line
                        and "Total nloc" not in line
                        and "No thresholds exceeded" not in line
                    ):
                        parts = line.split()
                        if len(parts) >= 4 and parts[0].isdigit():
                            try:
                                ccn = int(parts[0])
                                nloc = int(parts[1])
                                function_name = (
                                    parts[3] if len(parts) > 3 else "unknown"
                                )

                                # Skip invalid function names from parsing errors
                                if function_name in [
                                    "0",
                                    "1",
                                    "2",
                                    "3",
                                    "4",
                                    "5",
                                    "6",
                                    "7",
                                    "8",
                                    "9",
                                    "unknown",
                                ]:
                                    continue

                                # Skip if NLOC is 0 or 1 (likely parsing error)
                                if nloc <= 1:
                                    continue

                                # Create unique function identifier
                                func_id = f"{function_name}:{ccn}:{nloc}"
                                if func_id in seen_functions:
                                    continue
                                seen_functions.add(func_id)

                                metrics["functions"].append(
                                    {"name": function_name, "ccn": ccn, "nloc": nloc}
                                )
                                metrics["max_ccn"] = max(metrics["max_ccn"], ccn)
                                metrics["total_functions"] += 1
                            except (ValueError, IndexError):
                                continue

                if metrics["total_functions"] > 0:
                    metrics["avg_ccn"] = (
                        sum(f["ccn"] for f in metrics["functions"])
                        / metrics["total_functions"]
                    )

                self._lizard_cache[file_path] = metrics
                return metrics

        except (
            subprocess.TimeoutExpired,
            subprocess.SubprocessError,
            FileNotFoundError,
        ):
            pass

        metrics = {"functions": [], "avg_ccn": 0, "max_ccn": 0, "total_functions": 0}
        self._lizard_cache[file_path] = metrics
        return metrics

    def _check_complexity_patterns(
        self, content: str, lines: list[str], file_path: str, language: str = "unknown"
    ) -> list[dict[str, Any]]:
        """Check for complexity-based pattern violations using Lizard metrics."""
        findings = []

        # Get Lizard metrics for more accurate analysis
        lizard_metrics = self._get_lizard_metrics(file_path)

        # Check for god class (high complexity class with many functions)
        if lizard_metrics["total_functions"] > 20 and lizard_metrics["avg_ccn"] > 10:
            findings.append(
                {
                    "title": "God Class Anti-pattern",
                    "description": f"Class has {lizard_metrics['total_functions']} functions with average complexity {lizard_metrics['avg_ccn']:.1f}",
                    "severity": "high",
                    "file_path": file_path,
                    "line_number": 1,
                    "recommendation": "Break down into smaller, focused classes with single responsibilities.",
                    "metadata": {
                        "complexity_type": "god_class",
                        "function_count": lizard_metrics["total_functions"],
                        "avg_ccn": lizard_metrics["avg_ccn"],
                        "language": language,
                        "confidence": "high",
                    },
                }
            )

        # Check for individual complex functions
        for func in lizard_metrics["functions"]:
            if func["ccn"] > 15:  # High complexity threshold
                findings.append(
                    {
                        "title": f"Complex Function: {func['name']}",
                        "description": f"Function '{func['name']}' has cyclomatic complexity of {func['ccn']} (recommended: <15)",
                        "severity": "medium" if func["ccn"] < 25 else "high",
                        "file_path": file_path,
                        "line_number": 1,  # Lizard doesn't provide line numbers in simple output
                        "recommendation": "Break function into smaller, focused functions with single responsibilities.",
                        "metadata": {
                            "complexity_type": "high_ccn",
                            "function_name": func["name"],
                            "ccn": func["ccn"],
                            "nloc": func["nloc"],
                            "language": language,
                            "confidence": "high",
                        },
                    }
                )

            if func["nloc"] > 50:  # Long function threshold
                findings.append(
                    {
                        "title": f"Long Function: {func['name']}",
                        "description": f"Function '{func['name']}' has {func['nloc']} lines (recommended: <50)",
                        "severity": "medium",
                        "file_path": file_path,
                        "line_number": 1,
                        "recommendation": "Break function into smaller, focused functions.",
                        "metadata": {
                            "complexity_type": "long_function",
                            "function_name": func["name"],
                            "nloc": func["nloc"],
                            "language": language,
                            "confidence": "high",
                        },
                    }
                )

        return findings

    def _get_pattern_recommendation(self, pattern: str) -> str:
        """Get recommendation for a specific pattern."""
        recommendations = {
            "design_singleton": "Consider dependency injection instead of singleton pattern for better testability",
            "design_factory": "Good use of factory pattern for object creation flexibility",
            "design_observer": "Consider using event-driven architecture for loose coupling",
            "design_strategy": "Good separation of algorithms - ensure strategies are interchangeable",
            "design_decorator": "Consider composition over inheritance for better flexibility",
            "anti_god_class": "Break down into smaller, focused classes with single responsibilities",
            "anti_feature_envy": "Move functionality closer to the data it uses to improve cohesion",
            "anti_data_class": "Add behavior to data classes or use records/structs appropriately",
            "anti_long_parameter_list": "Use parameter objects, builder pattern, or configuration classes",
            "architectural_mvc": "Good separation of concerns with MVC pattern",
            "architectural_repository": "Good data access abstraction - ensure proper encapsulation",
            "architectural_service": "Consider domain-driven design principles for service boundaries",
            "architectural_dependency_injection": "Good use of inversion of control principle",
        }
        return recommendations.get(
            pattern, "Review pattern usage and consider refactoring for better design"
        )

    def _detect_language(self, file_path: Path) -> str:
        """Detect programming language from file extension."""
        ext = file_path.suffix.lower()
        language_map = {
            ".py": "python",
            ".js": "javascript",
            ".jsx": "javascript",
            ".ts": "typescript",
            ".tsx": "typescript",
            ".java": "java",
            ".cs": "csharp",
            ".go": "go",
            ".rs": "rust",
            ".php": "php",
            ".rb": "ruby",
            ".swift": "swift",
            ".kt": "kotlin",
            ".scala": "scala",
            ".cpp": "cpp",
            ".cc": "cpp",
            ".cxx": "cpp",
            ".c": "c",
            ".h": "cpp",
            ".hpp": "cpp",
        }
        return language_map.get(ext, "unknown")

    def _init_config_file_patterns(self):
        """Initialize patterns for config files that should be skipped or handled specially."""
        self.config_file_patterns = [
            "tailwind.config.js",
            "next.config.js",
            "webpack.config.js",
            "babel.config.js",
            "rollup.config.js",
            "vite.config.js",
            "jest.config.js",
            "package.json",
            "tsconfig.json",
            "eslint.config.js",
            ".eslintrc.js",
        ]

    def _should_skip_file(self, file_path: Path) -> bool:
        """Check if file should be skipped for pattern analysis."""
        filename = file_path.name.lower()
        return any(pattern in filename for pattern in self.config_file_patterns)

    def _deduplicate_findings(
        self, findings: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """Remove duplicate findings based on key characteristics."""
        seen = set()
        unique_findings = []

        for finding in findings:
            # Create unique key based on file, line, type, and pattern
            title = finding.get("title", "")
            file_path = finding.get("file_path", "")
            line_number = finding.get("line_number", 0)
            severity = finding.get("severity", "")

            # For complexity findings, include function name to avoid duplicates
            metadata = finding.get("metadata", {})
            function_name = metadata.get("function_name", "")
            pattern_name = metadata.get("pattern_name", "")

            # Create unique identifier
            unique_key = f"{file_path}:{line_number}:{title}:{severity}:{function_name}:{pattern_name}"

            if unique_key not in seen:
                seen.add(unique_key)
                unique_findings.append(finding)

        return unique_findings


if __name__ == "__main__":
    raise SystemExit(0)
