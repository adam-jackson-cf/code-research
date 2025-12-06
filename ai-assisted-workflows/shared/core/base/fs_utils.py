#!/usr/bin/env python3
"""
File System Utilities for Continuous Improvement Framework.

Eliminates duplication of file system operation patterns.
"""

import fnmatch
import hashlib
import shutil
import tempfile
from collections.abc import Callable
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from .error_handler import CIErrorContext, CIErrorHandler
from .timing_utils import timed_operation


class FileSystemUtils:
    """Utility class for common file system operations."""

    @staticmethod
    def ensure_directory(path: str | Path, mode: int = 0o755) -> Path:
        """Ensure directory exists with proper error handling."""
        path_obj = Path(path)

        with CIErrorContext("creating directory", str(path_obj)):
            path_obj.mkdir(parents=True, exist_ok=True, mode=mode)

        return path_obj

    @staticmethod
    def safe_read_text(
        file_path: str | Path,
        encoding: str = "utf-8",
        fallback_encodings: list[str] | None = None,
    ) -> str:
        """
        Safely read text file with fallback encodings.

        Args:
            file_path: Path to file
            encoding: Primary encoding to try
            fallback_encodings: List of fallback encodings

        Returns
        -------
            File content as string
        """
        path_obj = Path(file_path)
        encodings_to_try = [encoding]

        if fallback_encodings:
            encodings_to_try.extend(fallback_encodings)
        else:
            encodings_to_try.extend(["latin-1", "cp1252", "utf-16"])

        for enc in encodings_to_try:
            try:
                return path_obj.read_text(encoding=enc)
            except UnicodeDecodeError:
                continue
            except FileNotFoundError:
                CIErrorHandler.fatal_error(
                    f"File not found: {path_obj}",
                    error_code=4,  # FILE_NOT_FOUND
                    file_path=path_obj,
                )
            except PermissionError as e:
                CIErrorHandler.permission_error("read file", path_obj, e)

        CIErrorHandler.fatal_error(
            f"Could not decode file with any supported encoding: {encodings_to_try}",
            error_code=6,  # FILE_READ_ERROR
            file_path=path_obj,
        )
        return ""

    @staticmethod
    def safe_write_text(
        file_path: str | Path,
        content: str,
        encoding: str = "utf-8",
        create_parents: bool = True,
        backup: bool = False,
    ) -> None:
        """
        Safely write text file with proper error handling.

        Args:
            file_path: Path to file
            content: Content to write
            encoding: Text encoding
            create_parents: Create parent directories if needed
            backup: Create backup of existing file
        """
        path_obj = Path(file_path)

        if create_parents:
            FileSystemUtils.ensure_directory(path_obj.parent)

        if backup and path_obj.exists():
            backup_path = path_obj.with_suffix(f"{path_obj.suffix}.backup")
            shutil.copy2(path_obj, backup_path)

        with CIErrorContext("writing file", str(path_obj)):
            path_obj.write_text(content, encoding=encoding)

    @staticmethod
    def safe_copy_file(
        source: str | Path,
        destination: str | Path,
        create_parents: bool = True,
        overwrite: bool = False,
    ) -> Path:
        """
        Safely copy file with proper error handling.

        Args:
            source: Source file path
            destination: Destination file path
            create_parents: Create parent directories if needed
            overwrite: Overwrite existing destination

        Returns
        -------
            Path to destination file
        """
        source_path = Path(source)
        dest_path = Path(destination)

        if not source_path.exists():
            CIErrorHandler.fatal_error(
                f"Source file does not exist: {source_path}",
                error_code=4,  # FILE_NOT_FOUND
                file_path=source_path,
            )

        if dest_path.exists() and not overwrite:
            CIErrorHandler.fatal_error(
                f"Destination file already exists: {dest_path}",
                error_code=7,  # FILE_WRITE_ERROR
                file_path=dest_path,
                context="Use overwrite=True to replace existing file",
            )

        if create_parents:
            FileSystemUtils.ensure_directory(dest_path.parent)

        with CIErrorContext("copying file", f"{source_path} -> {dest_path}"):
            shutil.copy2(source_path, dest_path)

        return dest_path

    @staticmethod
    def get_file_hash(file_path: str | Path, algorithm: str = "md5") -> str:
        """
        Get hash of file contents.

        Args:
            file_path: Path to file
            algorithm: Hash algorithm (md5, sha1, sha256)

        Returns
        -------
            Hex digest of file hash
        """
        path_obj = Path(file_path)

        try:
            hasher = hashlib.new(algorithm)
        except ValueError:
            CIErrorHandler.validation_error(
                "algorithm", algorithm, "valid hash algorithm (md5, sha1, sha256, etc.)"
            )

        with CIErrorContext("computing file hash", str(path_obj)), open(
            path_obj, "rb"
        ) as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hasher.update(chunk)

        return hasher.hexdigest()

    @staticmethod
    def find_files(
        root_path: str | Path,
        patterns: list[str] | None = None,
        exclude_patterns: list[str] | None = None,
        extensions: list[str] | None = None,
        max_depth: int | None = None,
        follow_symlinks: bool = False,
    ) -> list[Path]:
        """
        Find files matching criteria with pattern support.

        Args:
            root_path: Root directory to search
            patterns: Include patterns (glob style)
            exclude_patterns: Exclude patterns (glob style)
            extensions: File extensions to include (e.g., ['.py', '.js'])
            max_depth: Maximum directory depth to search
            follow_symlinks: Follow symbolic links

        Returns
        -------
            List of matching file paths
        """
        root = Path(root_path)

        if not root.exists():
            CIErrorHandler.fatal_error(
                f"Root path does not exist: {root}",
                error_code=4,  # FILE_NOT_FOUND
                file_path=root,
            )

        files = []
        patterns = patterns or ["*"]
        exclude_patterns = exclude_patterns or []
        extensions = [ext.lower() for ext in (extensions or [])]

        def should_include_file(file_path: Path) -> bool:
            # Check extensions
            if extensions and file_path.suffix.lower() not in extensions:
                return False

            # Check include patterns
            path_str = str(file_path.relative_to(root))
            if not any(fnmatch.fnmatch(path_str, pattern) for pattern in patterns):
                return False

            # Check exclude patterns
            return not any(
                fnmatch.fnmatch(path_str, pattern) for pattern in exclude_patterns
            )

        def walk_directory(dir_path: Path, current_depth: int = 0):
            if max_depth is not None and current_depth > max_depth:
                return

            try:
                for item in dir_path.iterdir():
                    if item.is_file() or (item.is_symlink() and follow_symlinks):
                        if should_include_file(item):
                            files.append(item)
                    elif item.is_dir() and (not item.is_symlink() or follow_symlinks):
                        walk_directory(item, current_depth + 1)
            except PermissionError:
                # Skip directories we can't access
                pass

        walk_directory(root)
        return sorted(files)

    @staticmethod
    def get_directory_size(path: str | Path) -> int:
        """
        Get total size of directory in bytes.

        Args:
            path: Directory path

        Returns
        -------
            Total size in bytes
        """
        path_obj = Path(path)
        total_size = 0

        from contextlib import suppress

        for item in FileSystemUtils.find_files(path_obj):
            with suppress(OSError, PermissionError):
                total_size += item.stat().st_size

        return total_size

    @staticmethod
    def clean_directory(
        path: str | Path,
        patterns: list[str] | None = None,
        dry_run: bool = False,
    ) -> list[Path]:
        """
        Clean directory by removing files matching patterns.

        Args:
            path: Directory path to clean
            patterns: File patterns to remove (default: temp/cache patterns)
            dry_run: Show what would be removed without actually removing

        Returns
        -------
            List of files that were (or would be) removed
        """
        path_obj = Path(path)

        if patterns is None:
            patterns = [
                "*.tmp",
                "*.temp",
                "*.bak",
                "*.backup",
                "__pycache__",
                "*.pyc",
                "*.pyo",
                ".DS_Store",
                "Thumbs.db",
                "*.log",
            ]

        files_to_remove = FileSystemUtils.find_files(path_obj, patterns=patterns)

        if not dry_run:
            removed_files = []
            for file_path in files_to_remove:
                try:
                    if file_path.is_dir():
                        shutil.rmtree(file_path)
                    else:
                        file_path.unlink()
                    removed_files.append(file_path)
                except (PermissionError, OSError):
                    # Skip files we can't remove
                    pass
            return removed_files

        return files_to_remove


class TemporaryDirectory:
    """Enhanced temporary directory with cleanup guarantee."""

    def __init__(self, prefix: str = "ci_temp_", cleanup: bool = True):
        self.prefix = prefix
        self.cleanup = cleanup
        self.path: Path | None = None
        self._temp_dir: tempfile.TemporaryDirectory[str] | None = None

    def __enter__(self) -> Path:
        self._temp_dir = tempfile.TemporaryDirectory(prefix=self.prefix)
        self.path = Path(self._temp_dir.name)
        return self.path

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.cleanup and self._temp_dir:
            self._temp_dir.cleanup()


@contextmanager
def atomic_write(file_path: str | Path, encoding: str = "utf-8", backup: bool = False):
    """
    Context manager for atomic file writing.

    Args:
        file_path: Path to target file
        encoding: Text encoding
        backup: Create backup of existing file

    Yields
    ------
        File object for writing
    """
    path_obj = Path(file_path)
    temp_path = path_obj.with_suffix(f"{path_obj.suffix}.tmp")

    # Create backup if requested and file exists
    backup_path = None
    if backup and path_obj.exists():
        backup_path = path_obj.with_suffix(f"{path_obj.suffix}.backup")
        shutil.copy2(path_obj, backup_path)

    try:
        # Ensure parent directory exists
        FileSystemUtils.ensure_directory(path_obj.parent)

        with open(temp_path, "w", encoding=encoding) as f:
            yield f

        # Atomic move
        shutil.move(str(temp_path), str(path_obj))

    except Exception as e:
        # Clean up temp file if it exists
        if temp_path.exists():
            temp_path.unlink()

        # Restore from backup if available
        if backup_path and backup_path.exists():
            shutil.move(str(backup_path), str(path_obj))

        raise e

    finally:
        # Clean up backup file after successful operation
        if backup_path and backup_path.exists():
            backup_path.unlink()


class DirectoryWatcher:
    """Watch directory for file changes."""

    def __init__(self, directory: str | Path):
        self.directory = Path(directory)
        self._file_states: dict[Path, dict[str, Any]] = {}
        self._scan_directory()

    def _scan_directory(self):
        """Scan directory and record file states."""
        self._file_states.clear()

        for file_path in FileSystemUtils.find_files(self.directory):
            try:
                stat = file_path.stat()
                self._file_states[file_path] = {
                    "size": stat.st_size,
                    "mtime": stat.st_mtime,
                    "exists": True,
                }
            except (OSError, PermissionError):
                pass

    def get_changes(self) -> dict[str, list[Path]]:
        """
        Get changes since last scan.

        Returns
        -------
            Dictionary with 'added', 'modified', 'deleted' file lists
        """
        changes: dict[str, list[Path]] = {"added": [], "modified": [], "deleted": []}

        current_files = set()

        # Check for new and modified files
        for file_path in FileSystemUtils.find_files(self.directory):
            current_files.add(file_path)

            try:
                stat = file_path.stat()
                current_state = {
                    "size": stat.st_size,
                    "mtime": stat.st_mtime,
                    "exists": True,
                }

                if file_path not in self._file_states:
                    changes["added"].append(file_path)
                elif self._file_states[file_path] != current_state:
                    changes["modified"].append(file_path)

                self._file_states[file_path] = current_state

            except (OSError, PermissionError):
                pass

        # Check for deleted files
        for file_path in list(self._file_states.keys()):
            if file_path not in current_files:
                changes["deleted"].append(file_path)
                del self._file_states[file_path]

        return changes

    def reset(self):
        """Reset watcher state by re-scanning directory."""
        self._scan_directory()


@timed_operation("file_operations_batch")
def process_files_in_batches(
    files: list[Path],
    processor: Callable[[Path], Any],
    batch_size: int = 100,
    progress_callback: Callable[[int, int], None] | None = None,
) -> list[Any]:
    """
    Process files in batches with progress tracking.

    Args:
        files: List of files to process
        processor: Function to process each file
        batch_size: Size of processing batches
        progress_callback: Optional callback for progress updates (current, total)

    Returns
    -------
        List of processing results
    """
    results = []
    total_files = len(files)

    for i in range(0, total_files, batch_size):
        batch = files[i : i + batch_size]

        for j, file_path in enumerate(batch):
            result = processor(file_path)
            results.append(result)

            if progress_callback:
                current_file = i + j + 1
                progress_callback(current_file, total_files)

    return results
