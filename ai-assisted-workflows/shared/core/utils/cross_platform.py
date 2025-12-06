#!/usr/bin/env python3
"""
Cross-platform utilities for AI-Assisted Workflows scriptable workflows.

Provides platform detection, path handling, and command execution.
"""

import platform
import subprocess
import sys
from pathlib import Path


class PlatformDetector:
    """Detect and handle platform-specific differences."""

    @staticmethod
    def get_platform() -> str:
        """Get standardized platform identifier."""
        system = platform.system().lower()
        return {
            "darwin": "macos",
            "windows": "windows",
            "linux": "linux",
        }.get(system, "unknown")

    @staticmethod
    def get_shell_command() -> str:
        """Get appropriate shell command for platform."""
        if PlatformDetector.get_platform() == "windows":
            return "powershell"
        else:
            return "bash"

    @staticmethod
    def get_python_command() -> str:
        """Return a Python 3.11+ interpreter command, preferring current interpreter.

        Order of preference:
        1) sys.executable if it's 3.11+
        2) 'python' if it's 3.11+
        3) 'python3' if it's 3.11+
        Fallback: raise RuntimeError
        """
        # Prefer the running interpreter if it already satisfies version
        return sys.executable or "python"

        def is_311_plus(cmd: str) -> bool:
            try:
                result = subprocess.run(
                    [
                        cmd,
                        "-c",
                        "import sys,sys;import sys;import sys;exit(0 if sys.version_info>=(3,11) else 1)",
                    ],
                    capture_output=True,
                )
                return result.returncode == 0
            except FileNotFoundError:
                return False

        for cmd in ["python", "python3"]:
            if is_311_plus(cmd):
                return cmd

        raise RuntimeError("Python 3.11+ not found as 'python' or 'python3'")

    @staticmethod
    def normalize_path(path: str) -> str:
        """Normalize path separators for current platform."""
        return str(Path(path).resolve())


class CommandExecutor:
    """Execute commands with cross-platform compatibility."""

    @staticmethod
    def run_command(
        command: list[str], cwd: str | None = None, timeout: int | None = None
    ) -> tuple[int, str, str]:
        """
        Execute command and return (return_code, stdout, stderr).

        Args:
            command: Command and arguments as list
            cwd: Working directory (optional)
            timeout: Command timeout in seconds (optional, no timeout if None)

        Returns
        -------
            Tuple of (return_code, stdout, stderr)
        """
        try:
            result = subprocess.run(
                command, cwd=cwd, capture_output=True, text=True, timeout=timeout
            )
            return result.returncode, result.stdout, result.stderr
        except subprocess.TimeoutExpired:
            return -1, "", f"Command timed out after {timeout} seconds"
        except FileNotFoundError:
            return -1, "", f"Command not found: {command[0]}"
        except Exception as e:
            return -1, "", f"Command execution failed: {str(e)}"

    @staticmethod
    def run_python_script(
        script_path: str, args: list[str] = None, cwd: str | None = None
    ) -> tuple[int, str, str]:
        """
        Execute Python script with cross-platform compatibility.

        Args:
            script_path: Path to Python script
            args: Script arguments (optional)
            cwd: Working directory (optional)

        Returns
        -------
            Tuple of (return_code, stdout, stderr)
        """
        python_cmd = PlatformDetector.get_python_command()
        command = [python_cmd, script_path]
        if args:
            command.extend(args)

        return CommandExecutor.run_command(command, cwd=cwd)


class PathUtils:
    """Utility functions for cross-platform path handling."""

    @staticmethod
    def find_project_root(start_path: str = ".") -> str | None:
        """
        Find project root by looking for .github directory.

        Args:
            start_path: Starting directory for search

        Returns
        -------
            Path to project root or None if not found
        """
        current = Path(start_path).resolve()

        while current != current.parent:
            if (current / ".github").exists():
                return str(current)
            current = current.parent

        return None

    @staticmethod
    def get_script_dir() -> str:
        """Get the directory containing analysis scripts."""
        project_root = PathUtils.find_project_root()
        if not project_root:
            raise RuntimeError("Project root not found")

        return str(Path(project_root) / ".github" / "scripts")

    @staticmethod
    def get_analyze_script_dir() -> str:
        """Get the directory containing analyze scripts."""
        return str(Path(PathUtils.get_script_dir()) / "analyze")


class DependencyChecker:
    """Check for required dependencies."""

    @staticmethod
    def check_python_version() -> bool:
        """Check if Python version is 3.11 or higher."""
        return sys.version_info >= (3, 11)

    @staticmethod
    def check_package_installed(package_name: str) -> bool:
        """Check if Python package is installed."""
        try:
            __import__(package_name)
            return True
        except ImportError:
            return False

    @staticmethod
    def check_command_available(command: str) -> bool:
        """Check if command is available on system."""
        try:
            subprocess.run([command, "--version"], capture_output=True, text=True)
            return True
        except FileNotFoundError:
            return False

    @staticmethod
    def get_missing_dependencies(required_packages: list[str]) -> list[str]:
        """Get list of missing required packages."""
        missing = []
        for package in required_packages:
            if not DependencyChecker.check_package_installed(package):
                missing.append(package)
        return missing


def main():
    """Test cross-platform utilities."""
    print("=== Cross-Platform Utilities Test ===")

    # Platform detection
    platform_info = PlatformDetector.get_platform()
    print(f"Platform: {platform_info}")
    print(f"Shell: {PlatformDetector.get_shell_command()}")
    print(f"Python: {PlatformDetector.get_python_command()}")

    # Path utilities
    try:
        project_root = PathUtils.find_project_root()
        print(f"Project root: {project_root}")

        script_dir = PathUtils.get_script_dir()
        print(f"Script directory: {script_dir}")

        analyze_dir = PathUtils.get_analyze_script_dir()
        print(f"Analyze script directory: {analyze_dir}")
    except RuntimeError as e:
        print(f"Path error: {e}")

    # Dependency checks
    print(f"Python version OK: {DependencyChecker.check_python_version()}")
    print(f"Git available: {DependencyChecker.check_command_available('git')}")

    # Test command execution
    return_code, stdout, stderr = CommandExecutor.run_command(["echo", "Hello, World!"])
    print(f"Test command - Return code: {return_code}, Output: {stdout.strip()}")


if __name__ == "__main__":
    main()
