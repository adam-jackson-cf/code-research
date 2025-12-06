#!/usr/bin/env python3
"""
Vendor/Third-party Code Detection Utility.

PURPOSE: Automatically detect vendor, third-party, or external library code
to avoid analyzing it as application code.

APPROACH:
- File header analysis (copyright, license markers)
- Minification pattern detection
- Common vendor path patterns
- Library signature detection
- Generated file markers

This helps reduce false positives by excluding code that shouldn't be analyzed
as part of the application codebase.
"""

import re
from dataclasses import dataclass
from pathlib import Path


@dataclass
class VendorDetection:
    """Result of vendor detection analysis."""

    is_vendor: bool
    confidence: float  # 0.0 to 1.0
    reasons: list[str]
    detected_library: str | None = None


class VendorDetector:
    """Detects vendor, third-party, and external library code."""

    def __init__(self, project_root: Path | None = None):
        """
        Initialize vendor detector.

        Args:
            project_root: Root directory of the project to analyze
        """
        self.project_root = project_root

        # Compile regex patterns for performance
        self._compile_patterns()

    def _compile_patterns(self) -> None:
        """Compile regex patterns for vendor detection."""
        # Copyright and license patterns
        self.copyright_patterns = [
            re.compile(r"@license\b", re.IGNORECASE),
            re.compile(r"copyright\s*\(c\)", re.IGNORECASE),
            re.compile(r"mit\s+license", re.IGNORECASE),
            re.compile(r"apache\s+license", re.IGNORECASE),
            re.compile(r"bsd\s+license", re.IGNORECASE),
            re.compile(r"gnu\s+general\s+public\s+license", re.IGNORECASE),
            re.compile(r"@copyright\b", re.IGNORECASE),
            re.compile(r"all\s+rights\s+reserved", re.IGNORECASE),
        ]

        # Library signature patterns
        self.library_patterns = [
            re.compile(r"!function\s*\(", re.IGNORECASE),
            re.compile(r"\(function\s*\(\s*global\s*,\s*factory\s*\)", re.IGNORECASE),
            re.compile(
                r'define\s*\(\s*[\'"][^\'\"]*[\'"],?\s*\[', re.IGNORECASE
            ),  # AMD
            re.compile(r"module\.exports\s*=", re.IGNORECASE),  # CommonJS
            re.compile(r"__webpack_require__", re.IGNORECASE),
            re.compile(r"webpackJsonp", re.IGNORECASE),
            re.compile(
                r"/\*!\s*.*?\s*\*/", re.IGNORECASE | re.DOTALL
            ),  # Banner comments
        ]

        # Minification detection patterns
        self.minification_patterns = [
            re.compile(
                r"^[a-zA-Z_$][a-zA-Z0-9_$]{0,2}=function\("
            ),  # Single letter function vars
            re.compile(
                r"[;}]\s*[a-zA-Z_$]{1,2}\s*=\s*[a-zA-Z_$]{1,2}[;}]"
            ),  # Single letter assignments
            re.compile(r"[a-zA-Z_$]{1,2}\|\|[a-zA-Z_$]{1,2}"),  # Short var logical OR
        ]

        # Generated file patterns
        self.generated_patterns = [
            re.compile(r"@generated\b", re.IGNORECASE),
            re.compile(r"auto-generated", re.IGNORECASE),
            re.compile(r"do\s+not\s+edit", re.IGNORECASE),
            re.compile(r"generated\s+automatically", re.IGNORECASE),
            re.compile(r"this\s+file\s+was\s+generated", re.IGNORECASE),
        ]

        # Common vendor paths
        self.vendor_path_patterns = [
            "vendor",
            "vendors",
            "third-party",
            "third_party",
            "external",
            "lib",
            "libs",
            "library",
            "libraries",
            "assets/vendor",
            "assets/private",
            "public/vendor",
            "static/vendor",
            "dist/vendor",
            "build/vendor",
        ]

        # Framework-specific generated paths
        self.generated_path_patterns = [
            ".angular",
            ".next",
            ".nuxt",
            ".cache",
            ".tmp",
            "tmp",
            "cache",
            "generated",
            "auto",
            "__generated__",
        ]

    def detect_vendor_code(self, file_path: Path) -> VendorDetection:
        """
        Detect if a file contains vendor/third-party code.

        Args:
            file_path: Path to the file to analyze

        Returns
        -------
            VendorDetection result with confidence score and reasons
        """
        reasons = []
        confidence = 0.0
        detected_library = None

        # Check if file exists and is readable
        if not file_path.exists() or not file_path.is_file():
            return VendorDetection(False, 0.0, ["File not found or not readable"])

        # Path-based detection
        path_result = self._check_vendor_paths(file_path)
        if path_result[0]:
            confidence += path_result[1]
            reasons.extend(path_result[2])

        # File name pattern detection
        filename_result = self._check_filename_patterns(file_path)
        if filename_result[0]:
            confidence += filename_result[1]
            reasons.extend(filename_result[2])

        # Content-based detection (only if not already high confidence)
        if confidence < 0.8:
            try:
                # Read first 2KB for performance (headers usually at top)
                with open(file_path, encoding="utf-8", errors="ignore") as f:
                    header_content = f.read(2048)

                # Check for copyright/license markers
                license_result = self._check_license_markers(header_content)
                if license_result[0]:
                    confidence += license_result[1]
                    reasons.extend(license_result[2])

                # Check for library signatures
                library_result = self._check_library_signatures(header_content)
                if library_result[0]:
                    confidence += library_result[1]
                    reasons.extend(library_result[2])
                    if library_result[3]:  # detected_library
                        detected_library = library_result[3]

                # Check for minification
                minify_result = self._check_minification(header_content)
                if minify_result[0]:
                    confidence += minify_result[1]
                    reasons.extend(minify_result[2])

                # Check for generated file markers
                generated_result = self._check_generated_markers(header_content)
                if generated_result[0]:
                    confidence += generated_result[1]
                    reasons.extend(generated_result[2])

            except (UnicodeDecodeError, PermissionError, OSError):
                reasons.append("Could not read file content")

        # Cap confidence at 1.0
        confidence = min(confidence, 1.0)

        # Consider it vendor code if confidence > 0.3
        is_vendor = confidence > 0.3

        return VendorDetection(is_vendor, confidence, reasons, detected_library)

    def _check_vendor_paths(
        self, file_path: Path
    ) -> tuple[bool, float, list[str], str | None]:
        """Check if file is in a vendor/third-party directory."""
        path_str = str(file_path).lower()
        reasons = []

        # Check vendor path patterns
        for pattern in self.vendor_path_patterns:
            if pattern in path_str:
                reasons.append(f"File in vendor directory: {pattern}")
                return True, 0.8, reasons, None

        # Check generated path patterns
        for pattern in self.generated_path_patterns:
            if f"/{pattern}/" in path_str or path_str.endswith(f"/{pattern}"):
                reasons.append(f"File in generated directory: {pattern}")
                return True, 0.9, reasons, None

        return False, 0.0, reasons, None

    def _check_filename_patterns(
        self, file_path: Path
    ) -> tuple[bool, float, list[str], str | None]:
        """Check filename patterns that indicate vendor code."""
        filename = file_path.name.lower()
        reasons = []

        # Minified files
        if ".min." in filename:
            reasons.append("Minified file (.min.)")
            return True, 0.9, reasons, None

        # Bundle files
        bundle_patterns = [".bundle.", ".chunk.", ".vendor.", "-vendor.", "_vendor."]
        for pattern in bundle_patterns:
            if pattern in filename:
                reasons.append(f"Bundle file pattern: {pattern}")
                return True, 0.7, reasons, None

        # Library files (common library names)
        library_names = [
            "jquery",
            "angular",
            "react",
            "vue",
            "ember",
            "backbone",
            "lodash",
            "underscore",
            "moment",
            "three",
            "chart",
            "bootstrap",
            "material",
            "antd",
            "semantic",
            "foundation",
        ]

        for lib_name in library_names:
            if lib_name in filename:
                reasons.append(f"Common library name: {lib_name}")
                return True, 0.6, reasons, lib_name

        return False, 0.0, reasons, None

    def _check_license_markers(
        self, content: str
    ) -> tuple[bool, float, list[str], str | None]:
        """Check for copyright and license markers."""
        reasons = []

        for pattern in self.copyright_patterns:
            if pattern.search(content):
                reasons.append("License/copyright marker found")
                return True, 0.7, reasons, None

        return False, 0.0, reasons, None

    def _check_library_signatures(
        self, content: str
    ) -> tuple[bool, float, list[str], str | None]:
        """Check for library-specific signatures."""
        reasons = []

        for pattern in self.library_patterns:
            if pattern.search(content):
                reasons.append("Library signature pattern detected")
                return True, 0.6, reasons, None

        return False, 0.0, reasons, None

    def _check_minification(
        self, content: str
    ) -> tuple[bool, float, list[str], str | None]:
        """Check for minification patterns."""
        reasons = []

        # Check pattern density (minified files have high pattern density)
        matches = 0
        for pattern in self.minification_patterns:
            matches += len(pattern.findall(content[:1000]))  # Check first 1KB

        if matches > 5:  # Threshold for likely minification
            reasons.append("Minification patterns detected")
            return True, 0.8, reasons, None

        return False, 0.0, reasons, None

    def _check_generated_markers(
        self, content: str
    ) -> tuple[bool, float, list[str], str | None]:
        """Check for generated file markers."""
        reasons = []

        for pattern in self.generated_patterns:
            if pattern.search(content):
                reasons.append("Generated file marker found")
                return True, 0.9, reasons, None

        return False, 0.0, reasons, None

    def should_exclude_file(
        self, file_path: Path, confidence_threshold: float = 0.3
    ) -> bool:
        """
        Determine if file should be excluded from analysis.

        Args:
            file_path: Path to check
            confidence_threshold: Minimum confidence to exclude file

        Returns
        -------
            True if file should be excluded
        """
        detection = self.detect_vendor_code(file_path)
        return detection.is_vendor and detection.confidence >= confidence_threshold
