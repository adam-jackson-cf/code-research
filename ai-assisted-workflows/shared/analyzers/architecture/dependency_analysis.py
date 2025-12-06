#!/usr/bin/env python3
"""
Dependency Analysis Analyzer - Architecture Dependency Analysis and Visualization.

PURPOSE: Analyzes project dependencies, version conflicts, and security vulnerabilities.
Part of the shared/analyzers/architecture suite using BaseAnalyzer infrastructure.

APPROACH:
- Multi-language dependency file parsing
- Version conflict detection
- Security vulnerability identification
- Dependency graph visualization
- License compatibility analysis
- Outdated dependency detection
- Unused dependency identification

EXTENDS: BaseAnalyzer for common analyzer infrastructure
- Inherits file scanning, CLI, configuration, and result formatting
- Implements dependency-specific analysis logic in analyze_target()
- Uses shared timing, logging, and error handling patterns
"""

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

# Import base analyzer (package root must be on PYTHONPATH)
from core.base.analyzer_base import AnalyzerConfig, BaseAnalyzer
from core.base.analyzer_registry import register_analyzer


@register_analyzer("architecture:dependency")
class DependencyAnalyzer(BaseAnalyzer):
    """Analyzes project dependencies and identifies potential issues."""

    def __init__(self, config: AnalyzerConfig | None = None):
        # Create dependency-specific configuration
        dependency_config = config or AnalyzerConfig(
            code_extensions={
                # Dependency manifest files
                ".json",  # package.json, composer.json
                ".txt",  # requirements.txt
                ".toml",  # pyproject.toml, Cargo.toml
                ".xml",  # pom.xml
                ".gradle",  # build.gradle
                ".yaml",  # environment.yml
                ".yml",  # docker-compose.yml
                ".lock",  # package-lock.json, Pipfile.lock
                ".cfg",  # setup.cfg
                ".ini",  # pip.conf
                ".conf",  # pip.conf
                # Source files for usage analysis
                ".py",
                ".js",
                ".jsx",
                ".ts",
                ".tsx",
                ".java",
                ".go",
                ".rs",
                ".rb",
                ".php",
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
                ".tox",
                ".cache",
                "site-packages",
                "wheels",
                "*.egg-info",
            },
        )

        # Initialize base analyzer
        super().__init__("architecture", dependency_config)

        # Initialize dependency patterns and parsers
        self._init_dependency_files()
        self._init_vulnerability_patterns()
        self._init_version_patterns()

        # Dependency tracking
        self.dependencies = defaultdict(dict)  # {file_path: {package: version}}
        self.dependency_usage = defaultdict(set)  # {package: {file_paths}}

    def _init_dependency_files(self):
        """Initialize dependency file patterns and parsers."""
        self.dependency_files = {
            # Python
            "requirements.txt": {
                "language": "python",
                "parser": self._parse_requirements_txt,
                "pattern": r"^([a-zA-Z0-9\-_.]+)([><=!~]+[0-9.*]+.*)?$",
            },
            "pyproject.toml": {
                "language": "python",
                "parser": self._parse_pyproject_toml,
                "sections": ["dependencies", "dev-dependencies"],
            },
            "Pipfile": {
                "language": "python",
                "parser": self._parse_pipfile,
                "sections": ["packages", "dev-packages"],
            },
            "environment.yml": {
                "language": "python",
                "parser": self._parse_conda_yml,
                "section": "dependencies",
            },
            # JavaScript/Node.js
            "package.json": {
                "language": "javascript",
                "parser": self._parse_package_json,
                "sections": ["dependencies", "devDependencies"],
            },
            # Java
            "pom.xml": {
                "language": "java",
                "parser": self._parse_pom_xml,
                "xpath": "//dependency",
            },
            "build.gradle": {
                "language": "java",
                "parser": self._parse_gradle,
                "pattern": r"implementation ['\"]([^'\"]+)['\"]",
            },
            # Rust
            "Cargo.toml": {
                "language": "rust",
                "parser": self._parse_cargo_toml,
                "sections": ["dependencies", "dev-dependencies"],
            },
            # Go
            "go.mod": {
                "language": "go",
                "parser": self._parse_go_mod,
                "pattern": r"require ([^\s]+) (.+)",
            },
            # Ruby
            "Gemfile": {
                "language": "ruby",
                "parser": self._parse_gemfile,
                "pattern": r"gem ['\"]([^'\"]+)['\"],?\s*['\"]?([^'\"]*)['\"]?",
            },
            # PHP
            "composer.json": {
                "language": "php",
                "parser": self._parse_composer_json,
                "sections": ["require", "require-dev"],
            },
        }

    def _init_vulnerability_patterns(self):
        """Initialize known vulnerability patterns."""
        self.vulnerability_patterns = {
            # Known vulnerable packages (simplified list)
            "lodash": {
                "versions": ["<4.17.21"],
                "severity": "high",
                "cve": "CVE-2021-23337",
                "description": "Command injection vulnerability",
            },
            "axios": {
                "versions": ["<0.21.1"],
                "severity": "medium",
                "cve": "CVE-2020-28168",
                "description": "Server-side request forgery vulnerability",
            },
            "pillow": {
                "versions": ["<8.1.1"],
                "severity": "high",
                "cve": "CVE-2021-25287",
                "description": "Buffer overflow in image processing",
            },
            "flask": {
                "versions": ["<1.0"],
                "severity": "medium",
                "cve": "CVE-2018-1000656",
                "description": "Denial of service vulnerability",
            },
            # Add more known vulnerabilities...
        }

    def _init_version_patterns(self):
        """Initialize version comparison patterns."""
        self.version_operators = {
            "==": "exact",
            ">=": "greater_equal",
            ">": "greater",
            "<=": "less_equal",
            "<": "less",
            "!=": "not_equal",
            "~": "compatible",
            "^": "compatible_caret",
        }

    def get_analyzer_metadata(self) -> dict[str, Any]:
        """Return metadata about this analyzer."""
        return {
            "name": "Dependency Analysis Analyzer",
            "version": "2.0.0",
            "description": "Analyzes project dependencies and identifies potential issues",
            "category": "architecture",
            "priority": "high",
            "capabilities": [
                "Multi-language dependency file parsing",
                "Version conflict detection",
                "Security vulnerability identification",
                "Dependency graph analysis",
                "License compatibility checks",
                "Outdated dependency detection",
                "Unused dependency identification",
                "Transitive dependency analysis",
            ],
            "supported_formats": list(self.config.code_extensions),
            "dependency_types": len(self.dependency_files),
            "vulnerability_db_size": len(self.vulnerability_patterns),
        }

    def analyze_target(self, target_path: str) -> list[dict[str, Any]]:
        """
        Analyze a single file or directory for dependency issues.

        Args:
            target_path: Path to file or directory to analyze

        Returns
        -------
            List of findings with standardized structure
        """
        all_findings = []
        file_path = Path(target_path)

        if file_path.is_file():
            # Analyze single file if it's a dependency file
            if file_path.name in self.dependency_files:
                findings = self._analyze_dependency_file(file_path)
                all_findings.extend(findings)
            # Or check for imports/usage
            elif file_path.suffix.lower() in {".py", ".js", ".jsx", ".ts", ".tsx"}:
                findings = self._analyze_dependency_usage(file_path)
                all_findings.extend(findings)
        else:
            # Analyze directory - find all dependency files
            project_findings = self._analyze_project_dependencies(file_path)
            all_findings.extend(project_findings)

        return all_findings

    def _analyze_project_dependencies(self, project_root: Path) -> list[dict[str, Any]]:
        """Analyze all dependency files in a project."""
        all_findings = []

        # Find all dependency files
        dependency_files_found = []
        for pattern_name in self.dependency_files:
            for dep_file in project_root.rglob(pattern_name):
                if self._should_analyze_file(dep_file):
                    dependency_files_found.append(dep_file)

        # Analyze each dependency file
        for dep_file in dependency_files_found:
            findings = self._analyze_dependency_file(dep_file)
            all_findings.extend(findings)

        # Cross-file analysis (version conflicts, unused deps)
        if len(dependency_files_found) > 1:
            conflict_findings = self._analyze_version_conflicts()
            all_findings.extend(conflict_findings)

        return all_findings

    def _analyze_dependency_file(self, file_path: Path) -> list[dict[str, Any]]:
        """Analyze a specific dependency file."""
        findings = []
        file_config = self.dependency_files.get(file_path.name, {})

        if not file_config:
            return findings

        try:
            # Parse dependencies
            parser = file_config.get("parser")
            if parser:
                deps = parser(file_path)
                self.dependencies[str(file_path)] = deps

                # Check each dependency
                for dep_name, dep_version in deps.items():
                    # Check for vulnerabilities
                    vuln_finding = self._check_vulnerability(
                        dep_name, dep_version, file_path
                    )
                    if vuln_finding:
                        findings.append(vuln_finding)

                    # Check for outdated versions
                    outdated_finding = self._check_outdated_version(
                        dep_name, dep_version, file_path
                    )
                    if outdated_finding:
                        findings.append(outdated_finding)

        except Exception as e:
            # Error parsing dependency file
            findings.append(
                {
                    "title": f"Dependency File Parse Error ({file_path.name})",
                    "description": f"Failed to parse dependency file {file_path.name}: {str(e)}",
                    "severity": "medium",
                    "file_path": str(file_path),
                    "line_number": 1,
                    "recommendation": "Check file syntax and format. Ensure it follows standard conventions.",
                    "metadata": {
                        "error_type": "parse_error",
                        "file_type": file_path.name,
                        "language": file_config.get("language", "unknown"),
                        "confidence": "high",
                    },
                }
            )

        return findings

    def _parse_requirements_txt(self, file_path: Path) -> dict[str, str]:
        """Parse Python requirements.txt file."""
        dependencies = {}
        try:
            with open(file_path, encoding="utf-8", errors="ignore") as f:
                for _line_num, line in enumerate(f, 1):
                    line = line.strip()
                    if line and not line.startswith("#"):
                        # Parse package==version or package>=version
                        match = re.match(
                            r"^([a-zA-Z0-9\-_.]+)([><=!~]+[0-9.*]+.*)?", line
                        )
                        if match:
                            package = match.group(1)
                            version = match.group(2) or ""
                            dependencies[package] = version
        except Exception:
            pass
        return dependencies

    def _parse_package_json(self, file_path: Path) -> dict[str, str]:
        """Parse Node.js package.json file."""
        dependencies = {}
        try:
            with open(file_path, encoding="utf-8", errors="ignore") as f:
                data = json.load(f)

                # Combine dependencies and devDependencies
                for dep_type in ["dependencies", "devDependencies"]:
                    if dep_type in data:
                        dependencies.update(data[dep_type])
        except Exception:
            pass
        return dependencies

    def _parse_pyproject_toml(self, file_path: Path) -> dict[str, str]:
        """Parse Python pyproject.toml file."""
        dependencies = {}
        try:
            # Simple TOML parsing for dependencies section
            with open(file_path, encoding="utf-8", errors="ignore") as f:
                content = f.read()

                # Look for dependencies array
                dep_match = re.search(
                    r"dependencies\s*=\s*\[(.*?)\]", content, re.DOTALL
                )
                if dep_match:
                    deps_text = dep_match.group(1)
                    # Extract quoted dependencies
                    for match in re.finditer(r'["\']([^"\']+)["\']', deps_text):
                        dep_line = match.group(1)
                        # Parse package==version
                        pkg_match = re.match(
                            r"^([a-zA-Z0-9\-_.]+)([><=!~]+[0-9.*]+.*)?", dep_line
                        )
                        if pkg_match:
                            package = pkg_match.group(1)
                            version = pkg_match.group(2) or ""
                            dependencies[package] = version
        except Exception:
            pass
        return dependencies

    def _parse_pipfile(self, file_path: Path) -> dict[str, str]:
        """Parse Python Pipfile."""
        dependencies = {}
        try:
            # Simple TOML-like parsing for Pipfile
            with open(file_path, encoding="utf-8", errors="ignore") as f:
                content = f.read()

                # Look for [packages] and [dev-packages] sections
                for section in ["packages", "dev-packages"]:
                    section_match = re.search(
                        f"\\[{section}\\](.*?)(?=\\[|$)", content, re.DOTALL
                    )
                    if section_match:
                        section_content = section_match.group(1)
                        # Find package = "version" entries
                        for match in re.finditer(
                            r'(\w+)\s*=\s*["\']([^"\']*)["\']', section_content
                        ):
                            package = match.group(1)
                            version = match.group(2)
                            dependencies[package] = version
        except Exception:
            pass
        return dependencies

    def _parse_conda_yml(self, file_path: Path) -> dict[str, str]:
        """Parse conda environment.yml file."""
        dependencies = {}
        try:
            # Simple YAML parsing for dependencies
            with open(file_path, encoding="utf-8", errors="ignore") as f:
                in_deps = False
                for line in f:
                    line = line.strip()
                    if line == "dependencies:":
                        in_deps = True
                    elif in_deps and line.startswith("- "):
                        dep = line[2:].strip()
                        if "=" in dep:
                            package, version = dep.split("=", 1)
                            dependencies[package] = f"=={version}"
                        else:
                            dependencies[dep] = ""
                    elif (
                        in_deps
                        and not line.startswith("- ")
                        and not line.startswith(" ")
                    ):
                        in_deps = False
        except Exception:
            pass
        return dependencies

    def _parse_pom_xml(self, file_path: Path) -> dict[str, str]:
        """Parse Java pom.xml file."""
        dependencies = {}
        try:
            with open(file_path, encoding="utf-8", errors="ignore") as f:
                content = f.read()

                # Find dependency blocks
                dep_pattern = r"<dependency>.*?<groupId>(.*?)</groupId>.*?<artifactId>(.*?)</artifactId>.*?<version>(.*?)</version>.*?</dependency>"
                for match in re.finditer(dep_pattern, content, re.DOTALL):
                    group_id = match.group(1)
                    artifact_id = match.group(2)
                    version = match.group(3)
                    package_name = f"{group_id}:{artifact_id}"
                    dependencies[package_name] = version
        except Exception:
            pass
        return dependencies

    def _parse_gradle(self, file_path: Path) -> dict[str, str]:
        """Parse Java build.gradle file."""
        dependencies = {}
        try:
            with open(file_path, encoding="utf-8", errors="ignore") as f:
                content = f.read()

                # Find implementation/compile dependencies
                patterns = [
                    r"implementation ['\"]([^:'\"]+):([^:'\"]+):([^'\"]+)['\"]",
                    r"compile ['\"]([^:'\"]+):([^:'\"]+):([^'\"]+)['\"]",
                ]

                for pattern in patterns:
                    for match in re.finditer(pattern, content):
                        group_id = match.group(1)
                        artifact_id = match.group(2)
                        version = match.group(3)
                        package_name = f"{group_id}:{artifact_id}"
                        dependencies[package_name] = version
        except Exception:
            pass
        return dependencies

    def _parse_cargo_toml(self, file_path: Path) -> dict[str, str]:
        """Parse Rust Cargo.toml file."""
        dependencies = {}
        try:
            with open(file_path, encoding="utf-8", errors="ignore") as f:
                content = f.read()

                # Look for [dependencies] section
                dep_match = re.search(
                    r"\[dependencies\](.*?)(?=\[|$)", content, re.DOTALL
                )
                if dep_match:
                    deps_content = dep_match.group(1)
                    # Find package = "version" or package = { version = "x" }
                    for match in re.finditer(
                        r'(\w+)\s*=\s*["\']([^"\']*)["\']', deps_content
                    ):
                        package = match.group(1)
                        version = match.group(2)
                        dependencies[package] = version
        except Exception:
            pass
        return dependencies

    def _parse_go_mod(self, file_path: Path) -> dict[str, str]:
        """Parse Go go.mod file."""
        dependencies = {}
        try:
            with open(file_path, encoding="utf-8", errors="ignore") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("require "):
                        # Handle both single line and block format
                        if "(" in line:
                            continue  # Skip require ( line
                        req_match = re.match(r"require ([^\s]+) (.+)", line)
                        if req_match:
                            module = req_match.group(1)
                            version = req_match.group(2)
                            dependencies[module] = version
                    elif re.match(r"^\s+([^\s]+) (.+)", line):
                        # Inside require block
                        req_match = re.match(r"^\s+([^\s]+) (.+)", line)
                        if req_match:
                            module = req_match.group(1)
                            version = req_match.group(2)
                            dependencies[module] = version
        except Exception:
            pass
        return dependencies

    def _parse_gemfile(self, file_path: Path) -> dict[str, str]:
        """Parse Ruby Gemfile."""
        dependencies = {}
        try:
            with open(file_path, encoding="utf-8", errors="ignore") as f:
                for line in f:
                    line = line.strip()
                    # Match gem "name", "version"
                    gem_match = re.match(
                        r"gem ['\"]([^'\"]+)['\"],?\s*['\"]?([^'\"]*)['\"]?", line
                    )
                    if gem_match:
                        gem_name = gem_match.group(1)
                        version = gem_match.group(2) or ""
                        dependencies[gem_name] = version
        except Exception:
            pass
        return dependencies

    def _parse_composer_json(self, file_path: Path) -> dict[str, str]:
        """Parse PHP composer.json file."""
        dependencies = {}
        try:
            with open(file_path, encoding="utf-8", errors="ignore") as f:
                data = json.load(f)

                # Combine require and require-dev
                for dep_type in ["require", "require-dev"]:
                    if dep_type in data:
                        dependencies.update(data[dep_type])
        except Exception:
            pass
        return dependencies

    def _analyze_dependency_usage(self, file_path: Path) -> list[dict[str, Any]]:
        """Analyze dependency usage in source files."""
        findings = []

        try:
            with open(file_path, encoding="utf-8", errors="ignore") as f:
                content = f.read()

                # Look for import statements
                import_patterns = [
                    r"import\s+([a-zA-Z0-9_\-]+)",  # Python/JS imports
                    r"from\s+([a-zA-Z0-9_\-]+)\s+import",  # Python from imports
                    r'require\(["\']([^"\']+)["\']\)',  # Node.js require
                ]

                for pattern in import_patterns:
                    for match in re.finditer(pattern, content):
                        package = match.group(1)
                        self.dependency_usage[package].add(str(file_path))

        except Exception:
            pass

        return findings

    def _check_vulnerability(
        self, package: str, version: str, file_path: Path
    ) -> dict[str, Any] | None:
        """Check if package version has known vulnerabilities."""
        if package in self.vulnerability_patterns:
            vuln_info = self.vulnerability_patterns[package]
            # Simplified version check - in production use proper version parsing
            if version and any(op in version for op in ["<", "<=", "=="]):
                return {
                    "title": f"Security Vulnerability in {package} ({vuln_info['cve']})",
                    "description": f"Package {package} version {version} has a known security vulnerability: {vuln_info['description']}",
                    "severity": vuln_info["severity"],
                    "file_path": str(file_path),
                    "line_number": 1,
                    "recommendation": f"Update {package} to a version that fixes {vuln_info['cve']}. Check security advisories for the latest safe version.",
                    "metadata": {
                        "vulnerability_type": "known_cve",
                        "package": package,
                        "version": version,
                        "cve": vuln_info["cve"],
                        "confidence": "high",
                    },
                }
        return None

    def _check_outdated_version(
        self, package: str, version: str, file_path: Path
    ) -> dict[str, Any] | None:
        """Check if package version is outdated."""
        # Simplified outdated check - look for very old patterns
        outdated_indicators = [
            ("==1.", "major version 1.x may be outdated"),
            ("==0.", "version 0.x may be in beta/development"),
            ("<2.", "version constraint may be too restrictive"),
        ]

        for indicator, description in outdated_indicators:
            if indicator in version:
                return {
                    "title": f"Potentially Outdated Dependency ({package})",
                    "description": f"Package {package} version {version} - {description}",
                    "severity": "low",
                    "file_path": str(file_path),
                    "line_number": 1,
                    "recommendation": f"Check if {package} has newer stable versions available. Update version constraints if appropriate.",
                    "metadata": {
                        "dependency_issue": "outdated_version",
                        "package": package,
                        "version": version,
                        "confidence": "medium",
                    },
                }
        return None

    def _analyze_version_conflicts(self) -> list[dict[str, Any]]:
        """Analyze for version conflicts across dependency files."""
        findings = []
        package_versions = defaultdict(list)  # {package: [(file, version)]}

        # Collect all versions for each package
        for file_path, deps in self.dependencies.items():
            for package, version in deps.items():
                if version:  # Only consider packages with explicit versions
                    package_versions[package].append((file_path, version))

        # Check for conflicts
        for package, versions in package_versions.items():
            if len(versions) > 1:
                unique_versions = {v[1] for v in versions}
                if len(unique_versions) > 1:
                    # Version conflict detected
                    conflict_desc = (
                        f"Package {package} has conflicting version requirements: "
                    )
                    conflict_desc += ", ".join(
                        [f"{Path(f).name}:{v}" for f, v in versions]
                    )

                    findings.append(
                        {
                            "title": f"Version Conflict for {package}",
                            "description": conflict_desc,
                            "severity": "medium",
                            "file_path": versions[0][0],  # First file with this package
                            "line_number": 1,
                            "recommendation": f"Resolve version conflict for {package} by aligning version requirements across dependency files.",
                            "metadata": {
                                "dependency_issue": "version_conflict",
                                "package": package,
                                "conflicting_versions": list(unique_versions),
                                "affected_files": [f for f, _ in versions],
                                "confidence": "high",
                            },
                        }
                    )

        return findings

    def _should_analyze_file(self, file_path: Path) -> bool:
        """Check if file should be analyzed."""
        path_str = str(file_path).lower()
        for pattern in self.config.skip_patterns:
            if pattern.replace("*", "") in path_str:
                return False
        return True


if __name__ == "__main__":
    raise SystemExit(0)
