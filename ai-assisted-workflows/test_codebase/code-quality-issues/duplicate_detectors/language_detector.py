#!/usr/bin/env python3
"""
Language Detection Utility for CI Framework
Shared utility for detecting programming languages in project files
"""

import fnmatch
from pathlib import Path


class LanguageDetector:
    """Shared utility for detecting programming languages from files."""

    # Language mapping from file extensions
    LANGUAGE_PATTERNS = {
        ".py": "python",
        ".js": "javascript",
        ".jsx": "javascript",
        ".ts": "typescript",
        ".tsx": "typescript",
        ".java": "java",
        ".go": "go",
        ".rs": "rust",
        ".php": "php",
        ".rb": "ruby",
        ".cs": "csharp",
        ".cpp": "cpp",
        ".cc": "cpp",
        ".cxx": "cpp",
        ".c": "c",
        ".h": "c",
        ".hpp": "cpp",
    }

    @classmethod
    def detect_from_files(cls, file_paths: list[Path], exclusion_patterns: list[str] | None = None) -> set[str]:
        """
        Detect programming languages from a list of files.

        Args:
            file_paths: List of file paths to analyze
            exclusion_patterns: List of patterns to exclude (e.g., ["node_modules/*", "test_codebase"])

        Returns:
            Set of detected language names
        """
        languages = set()
        exclusion_patterns = exclusion_patterns or []

        for file_path in file_paths:
            if cls._should_exclude_file(file_path, exclusion_patterns):
                continue

            suffix = file_path.suffix.lower()
            if suffix in cls.LANGUAGE_PATTERNS:
                languages.add(cls.LANGUAGE_PATTERNS[suffix])

        return languages

    @classmethod
    def detect_from_directory(cls, project_dir: str, exclusion_patterns: list[str] | None = None) -> set[str]:
        """
        Detect programming languages from all files in a directory.

        Args:
            project_dir: Directory path to scan
            exclusion_patterns: List of patterns to exclude

        Returns:
            Set of detected language names
        """
        project_path = Path(project_dir)
        all_files = []

        # Get all files with known extensions
        for pattern, _language in cls.LANGUAGE_PATTERNS.items():
            pattern_glob = f"**/*{pattern}"
            files = list(project_path.glob(pattern_glob))
            all_files.extend(files)

        return cls.detect_from_files(all_files, exclusion_patterns)

    @classmethod
    def _should_exclude_file(cls, file_path: Path, exclusion_patterns: list[str]) -> bool:
        """Check if file should be excluded based on exclusion patterns."""
        file_str = str(file_path)
        relative_path = str(file_path.name) if file_path.is_absolute() else file_str

        # Check against each exclusion pattern
        for pattern in exclusion_patterns:
            # Handle directory patterns
            if pattern.endswith("/*") or pattern.endswith("/**/*"):
                dir_pattern = pattern.rstrip("/*").rstrip("*")
                if f"/{dir_pattern}/" in file_str or file_str.startswith(f"{dir_pattern}/"):
                    return True
            # Handle file patterns
            elif fnmatch.fnmatch(relative_path, pattern) or fnmatch.fnmatch(file_str, pattern) or pattern in file_str:
                return True

        return False

    @classmethod
    def get_language_extensions(cls, language: str) -> list[str]:
        """Get file extensions for a given language."""
        extensions = []
        for ext, lang in cls.LANGUAGE_PATTERNS.items():
            if lang == language:
                extensions.append(ext)
        return extensions

    @classmethod
    def get_supported_languages(cls) -> list[str]:
        """Get list of all supported languages."""
        return sorted(set(cls.LANGUAGE_PATTERNS.values()))


def main():
    """CLI interface for language detection utility."""
    import argparse

    parser = argparse.ArgumentParser(description="Detect programming languages in project")
    parser.add_argument("--project-dir", required=True, help="Project directory to scan")
    parser.add_argument("--exclude", nargs="*", help="Exclusion patterns")
    parser.add_argument("--output", choices=["list", "json"], default="list", help="Output format")

    args = parser.parse_args()

    # Detect languages
    languages = LanguageDetector.detect_from_directory(args.project_dir, args.exclude)

    if args.output == "json":
        import json
        print(json.dumps({"languages": sorted(languages)}, indent=2))
    else:
        print("Detected languages:", ", ".join(sorted(languages)) if languages else "None")


if __name__ == "__main__":
    main()
