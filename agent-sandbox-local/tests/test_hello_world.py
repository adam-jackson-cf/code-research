"""
Combined Hello World tests for both backends.

Run with: pytest tests/test_hello_world.py -v

This file contains the definitive hello world tests that verify
each backend can:
1. Create a sandbox
2. Execute 'echo hello world'
3. Return output containing 'hello world'
4. Clean up the sandbox
"""

import pytest
import subprocess
import sys
import time
from pathlib import Path

# Add sandbox_cli to path
sandbox_cli_path = Path(__file__).parent.parent / "sandbox_cli"
sys.path.insert(0, str(sandbox_cli_path))


def docker_available():
    """Check if Docker is available."""
    try:
        result = subprocess.run(["docker", "info"], capture_output=True, timeout=5)
        return result.returncode == 0
    except Exception:
        return False


def tmux_available():
    """Check if tmux is available."""
    try:
        result = subprocess.run(["tmux", "-V"], capture_output=True, timeout=5)
        return result.returncode == 0
    except Exception:
        return False


def docker_image_exists(image_name="agent-sandbox-base"):
    """Check if Docker image exists."""
    try:
        result = subprocess.run(
            ["docker", "images", "-q", image_name],
            capture_output=True,
            text=True,
            timeout=5,
        )
        return bool(result.stdout.strip())
    except Exception:
        return False


class TestHelloWorld:
    """Hello World tests for all backends."""

    @pytest.mark.skipif(
        not docker_available() or not docker_image_exists(),
        reason="Docker not available or image not built"
    )
    def test_orbstack_hello_world(self, tmp_path):
        """
        OrbStack Backend Hello World Test

        Verifies that OrbStack backend can:
        - Create a Docker container sandbox
        - Execute echo command
        - Return 'hello world' output
        - Clean up container
        """
        from src.backends.orbstack.backend import OrbStackBackend

        config = {
            "image_prefix": "agent-sandbox",
            "workspace_dir": str(tmp_path / "orbstack-workspaces"),
        }

        backend = OrbStackBackend(config)
        sandbox_id = None

        try:
            # Create sandbox
            sandbox_id = backend.create_sandbox(template="base")
            assert sandbox_id.startswith("sbx_"), f"Invalid sandbox ID: {sandbox_id}"

            # Execute command
            result = backend.run_command(sandbox_id, "echo 'hello world'")

            # Verify
            assert result.exit_code == 0, f"Command failed with exit code: {result.exit_code}"
            assert "hello world" in result.stdout, f"Output missing 'hello world': {result.stdout}"

            print(f"\n{'='*60}")
            print(f"  ORBSTACK HELLO WORLD TEST: PASSED")
            print(f"{'='*60}")
            print(f"  Backend:    OrbStack (Docker)")
            print(f"  Sandbox ID: {sandbox_id}")
            print(f"  Command:    echo 'hello world'")
            print(f"  Output:     {result.stdout.strip()}")
            print(f"  Exit Code:  {result.exit_code}")
            print(f"{'='*60}\n")

        finally:
            if sandbox_id:
                backend.kill_sandbox(sandbox_id)

    @pytest.mark.skipif(not tmux_available(), reason="tmux not available")
    def test_tmux_hello_world(self, tmp_path):
        """
        Tmux Backend Hello World Test

        Verifies that Tmux backend can:
        - Create a tmux session sandbox
        - Execute echo command
        - Return 'hello world' output
        - Clean up session
        """
        from src.backends.tmux.backend import TmuxBackend

        config = {
            "workspace_dir": str(tmp_path / "tmux-workspaces"),
            "capture_dir": str(tmp_path / "tmux-captures"),
        }

        backend = TmuxBackend(config)
        sandbox_id = None

        try:
            # Create sandbox
            sandbox_id = backend.create_sandbox()
            assert sandbox_id.startswith("sbx_"), f"Invalid sandbox ID: {sandbox_id}"

            # Execute command
            result = backend.run_command(sandbox_id, "echo 'hello world'")

            # Verify
            assert result.exit_code == 0, f"Command failed with exit code: {result.exit_code}"
            assert "hello world" in result.stdout, f"Output missing 'hello world': {result.stdout}"

            print(f"\n{'='*60}")
            print(f"  TMUX HELLO WORLD TEST: PASSED")
            print(f"{'='*60}")
            print(f"  Backend:    Tmux")
            print(f"  Sandbox ID: {sandbox_id}")
            print(f"  Command:    echo 'hello world'")
            print(f"  Output:     {result.stdout.strip()}")
            print(f"  Exit Code:  {result.exit_code}")
            print(f"{'='*60}\n")

        finally:
            if sandbox_id:
                backend.kill_sandbox(sandbox_id)
                time.sleep(0.5)  # Allow tmux to clean up


def test_backend_availability():
    """Test which backends are available."""
    print("\n" + "="*60)
    print("  BACKEND AVAILABILITY CHECK")
    print("="*60)

    # Check Docker
    docker_ok = docker_available()
    docker_status = "✓ Available" if docker_ok else "✗ Not available"
    print(f"  Docker:      {docker_status}")

    if docker_ok:
        image_ok = docker_image_exists()
        image_status = "✓ Built" if image_ok else "✗ Not built (run docker/build.sh)"
        print(f"  Docker Image: {image_status}")

    # Check tmux
    tmux_ok = tmux_available()
    tmux_status = "✓ Available" if tmux_ok else "✗ Not available"
    print(f"  Tmux:        {tmux_status}")

    print("="*60 + "\n")

    # At least one backend should be available
    assert docker_ok or tmux_ok, "At least one backend (Docker or tmux) must be available"


if __name__ == "__main__":
    # Run tests directly
    pytest.main([__file__, "-v", "-s"])
