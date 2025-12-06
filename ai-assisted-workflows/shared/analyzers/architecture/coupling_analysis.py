#!/usr/bin/env python3
"""
Coupling Analysis Analyzer - Architecture Coupling and Dependency Analysis.

PURPOSE: Analyzes code coupling patterns, dependency relationships, and architectural issues.
Part of the shared/analyzers/architecture suite using BaseAnalyzer infrastructure.

APPROACH:
- Multi-language import/dependency detection
- Dependency graph construction and analysis
- Circular dependency detection using DFS
- Fan-in/fan-out coupling metrics
- Architectural anti-pattern identification
- Cross-module dependency mapping

EXTENDS: BaseAnalyzer for common analyzer infrastructure
- Inherits file scanning, CLI, configuration, and result formatting
- Implements coupling-specific analysis logic in analyze_target()
- Uses shared timing, logging, and error handling patterns
"""

import re
from collections import defaultdict
from pathlib import Path
from typing import Any

# Import base analyzer (package root must be on PYTHONPATH)
from core.base.analyzer_base import AnalyzerConfig, BaseAnalyzer
from core.base.analyzer_registry import register_analyzer


@register_analyzer("architecture:coupling")
class CouplingAnalyzer(BaseAnalyzer):
    """Analyzes code coupling patterns and dependency relationships."""

    def __init__(self, config: AnalyzerConfig | None = None):
        # Create architecture-specific configuration
        architecture_config = config or AnalyzerConfig(
            code_extensions={
                ".py",
                ".js",
                ".jsx",
                ".ts",
                ".tsx",
                ".java",
                ".cs",
                ".go",
                ".rs",
                ".php",
                ".rb",
                ".swift",
                ".kt",
                ".scala",
                ".cpp",
                ".cc",
                ".cxx",
                ".c",
                ".h",
                ".hpp",
            },
            skip_patterns={
                "node_modules",
                ".git",
                "__pycache__",
                ".pytest_cache",
                "venv",
                "env",
                ".venv",
                "dist",
                "build",
                ".next",
                "coverage",
                ".nyc_output",
                "target",
                "vendor",
                "*.min.js",
                "*.min.css",
                "*.bundle.js",
                "*.chunk.js",
                "*.d.ts",
            },
        )

        # Initialize base analyzer
        super().__init__("architecture", architecture_config)

        # Dependency graph (will be built during analysis)
        self.dependency_graph = defaultdict(set)
        self.reverse_graph = defaultdict(set)
        self.module_info = {}

        # Initialize patterns and mappings
        self._init_import_patterns()
        self._init_coupling_patterns()
        self._init_extension_mapping()

    def _init_import_patterns(self):
        """Initialize import/dependency patterns for different languages."""
        # Import/dependency patterns for different languages
        self.import_patterns = {
            "python": {
                "pattern": r"(?:from\s+(\S+)\s+import|import\s+(\S+))",
                "groups": [1, 2],
            },
            "javascript": {
                "pattern": r'(?:import\s+.*?from\s+[\'"]([^\'"]+)[\'"]|require\([\'"]([^\'"]+)[\'"]\))',
                "groups": [1, 2],
            },
            "typescript": {
                "pattern": r'(?:import\s+.*?from\s+[\'"]([^\'"]+)[\'"]|require\([\'"]([^\'"]+)[\'"]\))',
                "groups": [1, 2],
            },
            "java": {"pattern": r"import\s+([^;]+);", "groups": [1]},
            "csharp": {"pattern": r"using\s+([^;]+);", "groups": [1]},
            "go": {
                "pattern": r'import\s+(?:"([^"]+)"|`([^`]+)`)',
                "groups": [1, 2],
            },
            "rust": {
                "pattern": r"use\s+([^;]+);",
                "groups": [1],
            },
            "php": {
                "pattern": r"(?:use\s+([^;]+);|require_once\s+['\"]([^'\"]+)['\"]|include_once\s+['\"]([^'\"]+)['\"])",
                "groups": [1, 2, 3],
            },
            "ruby": {
                "pattern": r"(?:require\s+['\"]([^'\"]+)['\"]|require_relative\s+['\"]([^'\"]+)['\"])",
                "groups": [1, 2],
            },
            "swift": {
                "pattern": r"import\s+(\w+)",
                "groups": [1],
            },
            "kotlin": {
                "pattern": r"import\s+([^;]+)",
                "groups": [1],
            },
            "cpp": {
                "pattern": r"#include\s+[<\"]([^>\"]+)[>\"]",
                "groups": [1],
            },
            "c": {
                "pattern": r"#include\s+[<\"]([^>\"]+)[>\"]",
                "groups": [1],
            },
        }

    def _init_coupling_patterns(self):
        """Initialize coupling anti-patterns."""
        # Coupling anti-patterns
        self.coupling_patterns = {
            "circular_dependency": {
                "severity": "high",
                "description": "Circular dependency detected",
            },
            "high_fan_out": {
                "severity": "medium",
                "description": "Module has too many outgoing dependencies",
            },
            "high_fan_in": {
                "severity": "medium",
                "description": "Module is depended on by too many others",
            },
            "deep_dependency": {
                "severity": "medium",
                "description": "Deep dependency chain detected",
            },
            "unstable_dependency": {
                "severity": "medium",
                "description": "Dependency on unstable/concrete module",
            },
        }

    def _init_extension_mapping(self):
        """Initialize file extension to language mapping."""
        # File extension mapping
        self.extension_language_map = {
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

        # Compile import patterns for performance
        self._compiled_patterns = {}
        for language, pattern_info in self.import_patterns.items():
            self._compiled_patterns[language] = re.compile(
                pattern_info["pattern"], re.MULTILINE
            )

    def get_analyzer_metadata(self) -> dict[str, Any]:
        """Return metadata about this analyzer."""
        return {
            "name": "Coupling Analysis Analyzer",
            "version": "2.0.0",
            "description": "Analyzes code coupling patterns and dependency relationships",
            "category": "architecture",
            "priority": "high",
            "capabilities": [
                "Multi-language import detection",
                "Dependency graph construction",
                "Circular dependency detection",
                "Fan-in/fan-out coupling metrics",
                "Architectural anti-pattern identification",
                "Cross-module dependency mapping",
                "Coupling hotspot detection",
            ],
            "supported_formats": list(self.config.code_extensions),
            "languages_supported": len(self.import_patterns),
            "coupling_patterns": len(self.coupling_patterns),
        }

    def analyze_target(self, target_path: str) -> list[dict[str, Any]]:
        """
        Analyze a single file for coupling patterns.

        Note: This analyzer works at the project level, so it will analyze
        the entire directory structure when called on any individual file.

        Args:
            target_path: Path to file to analyze

        Returns
        -------
            List of findings with standardized structure
        """
        all_findings = []
        file_path = Path(target_path)

        # For coupling analysis, we need to analyze the entire project
        # So we'll get the project root and analyze from there
        if file_path.is_file():
            project_root = self._find_project_root(file_path)
        else:
            project_root = file_path

        # Build dependency graph for the entire project
        self._build_dependency_graph_for_project(project_root)

        # Analyze coupling patterns
        coupling_findings = self._analyze_coupling_patterns()

        # Convert to standardized finding format
        for finding in coupling_findings:
            standardized = {
                "title": f"{finding['description']} ({finding['pattern_type'].replace('_', ' ').title()})",
                "description": finding["description"],
                "severity": finding["severity"],
                "file_path": finding.get("file_path", str(project_root)),
                "line_number": 1,  # Architecture issues don't have specific line numbers
                "recommendation": self._get_recommendation(finding["pattern_type"]),
                "metadata": {
                    "pattern_type": finding["pattern_type"],
                    "module": finding.get("module"),
                    "metric_value": finding.get("metric_value"),
                    "dependencies": finding.get("dependencies"),
                    "dependents": finding.get("dependents"),
                    "cycle": finding.get("cycle"),
                    "confidence": "high",
                },
            }
            all_findings.append(standardized)

        return all_findings

    def _find_project_root(self, file_path: Path) -> Path:
        """Find the project root directory."""
        current = file_path.parent if file_path.is_file() else file_path

        # Look for common project indicators
        project_indicators = [
            "package.json",
            "requirements.txt",
            "go.mod",
            "Cargo.toml",
            "pom.xml",
            "build.gradle",
            ".git",
            "pyproject.toml",
        ]

        while current.parent != current:  # Not at filesystem root
            if any((current / indicator).exists() for indicator in project_indicators):
                return current
            current = current.parent

        # Fallback to the directory containing the file or the file's parent
        return file_path.parent if file_path.is_file() else file_path

    def _build_dependency_graph_for_project(self, project_root: Path):
        """Build dependency graph for the entire project."""
        # Reset graphs
        self.dependency_graph = defaultdict(set)
        self.reverse_graph = defaultdict(set)
        self.module_info = {}

        # Scan all files in the project
        for file_path in project_root.rglob("*"):
            if (
                file_path.is_file()
                and file_path.suffix.lower() in self.extension_language_map
                and self._should_analyze_file(file_path)
            ):
                module_name = self._get_module_name(file_path)
                dependencies = self._extract_dependencies(file_path)

                self.dependency_graph[module_name] = set(dependencies)
                self.module_info[module_name] = {
                    "file_path": str(file_path),
                    "dependencies": dependencies,
                    "language": self.extension_language_map.get(
                        file_path.suffix.lower()
                    ),
                }

        # Build reverse graph
        for module, deps in self.dependency_graph.items():
            for dep in deps:
                self.reverse_graph[dep].add(module)

    def _should_analyze_file(self, file_path: Path) -> bool:
        """Check if file should be analyzed."""
        # Skip files in skip patterns
        path_str = str(file_path).lower()
        for pattern in self.config.skip_patterns:
            if pattern.replace("*", "") in path_str:
                return False
        return True

    def _extract_dependencies(self, file_path: Path) -> list[str]:
        """Extract dependencies from a file."""
        dependencies = []
        suffix = file_path.suffix.lower()
        language = self.extension_language_map.get(suffix)

        if not language or language not in self.import_patterns:
            return dependencies

        try:
            with open(file_path, encoding="utf-8", errors="ignore") as f:
                content = f.read()

                pattern_info = self.import_patterns[language]
                pattern = pattern_info["pattern"]
                groups = pattern_info["groups"]

                matches = re.finditer(pattern, content, re.MULTILINE)

                for match in matches:
                    for group_idx in groups:
                        if group_idx <= len(match.groups()) and match.group(group_idx):
                            dep = match.group(group_idx).strip()
                            # Clean up dependency name - be less aggressive to preserve module identity
                            # Only filter out external/system dependencies, keep internal project structure
                            if (
                                dep
                                and not dep.startswith(".")
                                and not self._is_external_dependency(dep)
                            ):
                                # For relative path imports, clean up but preserve structure
                                if "/" in dep:
                                    # For path-based imports like "./path/to/module"
                                    dep = dep.replace("./", "").replace("../", "")
                                dependencies.append(dep)

        except Exception:
            # Continue on error
            pass

        return list(set(dependencies))  # Remove duplicates

    def _is_external_dependency(self, dep: str) -> bool:
        """Check if dependency is external (not part of project)."""
        external_patterns = [
            # Common external libraries
            "react",
            "vue",
            "angular",
            "lodash",
            "axios",
            "express",
            "next",
            # Python libraries
            "numpy",
            "pandas",
            "django",
            "flask",
            "requests",
            "urllib",
            # System imports
            "os",
            "sys",
            "path",
            "fs",
            "http",
            "https",
            "util",
            "crypto",
            # Node.js built-ins
            "buffer",
            "child_process",
            "cluster",
            "events",
            "stream",
        ]

        dep_lower = dep.lower()
        return any(pattern in dep_lower for pattern in external_patterns)

    def _get_module_name(self, file_path: Path) -> str:
        """Get module name from file path."""
        # Use relative path from project root as module name to ensure uniqueness
        try:
            # Find project root by looking for common project indicators
            project_root = self._find_project_root(file_path)
            relative_path = file_path.relative_to(project_root)
            # Use the full relative path without extension as unique module identifier
            return str(relative_path.with_suffix(""))
        except (ValueError, AttributeError):
            # Fallback to stem if relative path calculation fails
            return str(file_path.stem)

    def _analyze_coupling_patterns(self) -> list[dict[str, Any]]:
        """Analyze coupling metrics and find issues."""
        findings = []

        for module, dependencies in self.dependency_graph.items():
            module_info = self.module_info.get(module, {})
            file_path = module_info.get("file_path", "")

            # Fan-out (efferent coupling) - number of dependencies
            fan_out = len(dependencies)
            if fan_out > 10:  # High fan-out threshold
                findings.append(
                    {
                        "category": "Coupling",
                        "pattern_type": "high_fan_out",
                        "module": module,
                        "file_path": file_path,
                        "severity": "high" if fan_out > 20 else "medium",
                        "description": f"Module has {fan_out} outgoing dependencies (recommended: <10)",
                        "metric_value": fan_out,
                        "dependencies": list(dependencies),
                    }
                )

            # Fan-in (afferent coupling) - number of modules depending on this one
            fan_in = len(self.reverse_graph.get(module, set()))
            if fan_in > 15:  # High fan-in threshold
                findings.append(
                    {
                        "category": "Coupling",
                        "pattern_type": "high_fan_in",
                        "module": module,
                        "file_path": file_path,
                        "severity": "medium",
                        "description": f"Module is used by {fan_in} other modules (high coupling)",
                        "metric_value": fan_in,
                        "dependents": list(self.reverse_graph.get(module, set())),
                    }
                )

        # Check for circular dependencies
        circular_deps = self._find_circular_dependencies()
        # Deduplicate circular dependencies by normalizing cycle representation
        unique_cycles = self._deduplicate_cycles(circular_deps)

        for cycle in unique_cycles:
            # Get file path for the first module in the cycle
            first_module = cycle[0] if cycle else ""
            file_path = self.module_info.get(first_module, {}).get("file_path", "")

            findings.append(
                {
                    "category": "Coupling",
                    "pattern_type": "circular_dependency",
                    "module": " -> ".join(cycle),
                    "file_path": file_path,
                    "severity": "high",
                    "description": f"Circular dependency: {' -> '.join(cycle)}",
                    "cycle": cycle,
                }
            )

        return findings

    def _find_circular_dependencies(self) -> list[list[str]]:
        """Find circular dependencies using DFS."""
        visited = set()
        rec_stack = set()
        cycles = []

        def dfs(node, path):
            if node in rec_stack:
                # Found a cycle
                cycle_start = path.index(node)
                cycle = path[cycle_start:] + [node]
                cycles.append(cycle)
                return

            if node in visited:
                return

            visited.add(node)
            rec_stack.add(node)

            for neighbor in self.dependency_graph.get(node, set()):
                if neighbor in self.dependency_graph:  # Only internal dependencies
                    dfs(neighbor, path + [node])

            rec_stack.remove(node)

        for module in self.dependency_graph:
            if module not in visited:
                dfs(module, [])

        return cycles

    def _deduplicate_cycles(self, cycles: list[list[str]]) -> list[list[str]]:
        """Deduplicate circular dependencies by normalizing representations."""
        unique_cycles = []
        seen_cycles = set()

        for cycle in cycles:
            if len(cycle) < 2:  # Skip invalid cycles
                continue

            # Normalize cycle by starting from the lexicographically smallest module
            # and ensuring consistent direction
            min_idx = cycle.index(min(cycle))
            normalized_cycle = cycle[min_idx:] + cycle[:min_idx]

            # Create a string representation for deduplication
            cycle_str = " -> ".join(normalized_cycle)
            reverse_cycle_str = " -> ".join(reversed(normalized_cycle))

            # Use the lexicographically smaller representation
            canonical_str = min(cycle_str, reverse_cycle_str)

            if canonical_str not in seen_cycles:
                seen_cycles.add(canonical_str)
                unique_cycles.append(normalized_cycle)

        return unique_cycles

    def _get_recommendation(self, pattern_type: str) -> str:
        """Get recommendation for specific pattern type."""
        recommendations = {
            "circular_dependency": "Break circular dependencies using dependency inversion or intermediary modules",
            "high_fan_out": "Reduce dependencies by using dependency injection or facade patterns",
            "high_fan_in": "Consider breaking large modules into smaller, focused components",
            "deep_dependency": "Flatten dependency chains and reduce coupling layers",
            "unstable_dependency": "Depend on abstractions rather than concrete implementations",
        }
        return recommendations.get(
            pattern_type, "Review architecture for coupling reduction opportunities"
        )


if __name__ == "__main__":
    raise SystemExit(0)
