"""Tests for Tmux backend - Hello World test."""

import pytest
import subprocess
import time


def tmux_available():
    """Check if tmux is available."""
    try:
        result = subprocess.run(
            ["tmux", "-V"],
            capture_output=True,
            timeout=5,
        )
        return result.returncode == 0
    except Exception:
        return False


@pytest.mark.skipif(not tmux_available(), reason="tmux not available")
class TestTmuxBackend:
    """Test Tmux backend functionality."""

    def test_hello_world(self, tmux_config):
        """
        Test creating a sandbox, executing 'echo hello world', and verifying output.

        This is the main acceptance test for the Tmux backend.
        """
        from src.backends.tmux.backend import TmuxBackend

        backend = TmuxBackend(tmux_config)
        sandbox_id = None

        try:
            # 1. Create sandbox
            sandbox_id = backend.create_sandbox()
            assert sandbox_id is not None
            assert sandbox_id.startswith("sbx_")

            # 2. Verify sandbox is running
            assert backend.is_sandbox_running(sandbox_id)

            # 3. Execute hello world command
            result = backend.run_command(sandbox_id, "echo 'hello world'")

            # 4. Verify output
            assert result.exit_code == 0
            assert "hello world" in result.stdout

            print(f"\n✓ Tmux Hello World Test Passed!")
            print(f"  Sandbox ID: {sandbox_id}")
            print(f"  Output: {result.stdout}")

        finally:
            # 5. Cleanup - destroy sandbox
            if sandbox_id:
                backend.kill_sandbox(sandbox_id)
                # Give tmux a moment to clean up
                time.sleep(0.5)
                assert not backend.is_sandbox_running(sandbox_id)

    def test_file_operations(self, tmux_config):
        """Test file read/write operations."""
        from src.backends.tmux.backend import TmuxBackend

        backend = TmuxBackend(tmux_config)
        sandbox_id = None

        try:
            sandbox_id = backend.create_sandbox()

            # Write a file
            content = "Hello from test!"
            backend.write_file(sandbox_id, "test.txt", content)

            # Verify file exists
            assert backend.file_exists(sandbox_id, "test.txt")

            # Read the file
            read_content = backend.read_file(sandbox_id, "test.txt")
            assert read_content == content

            print(f"\n✓ Tmux File Operations Test Passed!")

        finally:
            if sandbox_id:
                backend.kill_sandbox(sandbox_id)

    def test_health_check(self, tmux_config):
        """Test backend health check."""
        from src.backends.tmux.backend import TmuxBackend

        backend = TmuxBackend(tmux_config)
        health = backend.health_check()

        assert health["status"] == "healthy"
        assert health["backend"] == "tmux"
        assert "version" in health

        print(f"\n✓ Tmux Health Check Passed!")
        print(f"  Tmux version: {health.get('version')}")

    def test_multiple_commands(self, tmux_config):
        """Test running multiple commands sequentially."""
        from src.backends.tmux.backend import TmuxBackend

        backend = TmuxBackend(tmux_config)
        sandbox_id = None

        try:
            sandbox_id = backend.create_sandbox()

            # Run multiple commands
            result1 = backend.run_command(sandbox_id, "echo 'first'")
            assert "first" in result1.stdout

            result2 = backend.run_command(sandbox_id, "echo 'second'")
            assert "second" in result2.stdout

            result3 = backend.run_command(sandbox_id, "echo 'third'")
            assert "third" in result3.stdout

            print(f"\n✓ Tmux Multiple Commands Test Passed!")

        finally:
            if sandbox_id:
                backend.kill_sandbox(sandbox_id)


@pytest.mark.skipif(not tmux_available(), reason="tmux not available")
def test_tmux_hello_world_standalone(tmp_path):
    """
    Standalone hello world test that can be run independently.

    This test:
    1. Creates a Tmux sandbox
    2. Executes 'echo hello world'
    3. Verifies output contains 'hello world'
    4. Destroys the sandbox
    """
    from src.backends.tmux.backend import TmuxBackend

    config = {
        "workspace_dir": str(tmp_path / "workspaces"),
        "capture_dir": str(tmp_path / "captures"),
    }

    backend = TmuxBackend(config)
    sandbox_id = backend.create_sandbox()

    try:
        result = backend.run_command(sandbox_id, "echo 'hello world'")

        assert "hello world" in result.stdout, f"Expected 'hello world' in output, got: {result.stdout}"
        assert result.exit_code == 0, f"Expected exit code 0, got: {result.exit_code}"

        print(f"\n{'='*50}")
        print(f"Tmux Hello World Test: PASSED")
        print(f"{'='*50}")
        print(f"Sandbox ID: {sandbox_id}")
        print(f"Command: echo 'hello world'")
        print(f"Output: {result.stdout}")
        print(f"Exit Code: {result.exit_code}")
        print(f"{'='*50}")

    finally:
        backend.kill_sandbox(sandbox_id)
        time.sleep(0.5)  # Give tmux time to clean up
