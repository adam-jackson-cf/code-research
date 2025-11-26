"""Tests for OrbStack backend - Hello World test."""

import pytest
import subprocess

# Check if Docker is available
def docker_available():
    try:
        result = subprocess.run(
            ["docker", "info"],
            capture_output=True,
            timeout=5,
        )
        return result.returncode == 0
    except Exception:
        return False


# Check if the base image exists
def image_exists():
    try:
        result = subprocess.run(
            ["docker", "images", "-q", "agent-sandbox-base"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        return bool(result.stdout.strip())
    except Exception:
        return False


@pytest.mark.skipif(not docker_available(), reason="Docker not available")
class TestOrbStackBackend:
    """Test OrbStack backend functionality."""

    def test_hello_world(self, orbstack_config):
        """
        Test creating a sandbox, executing 'echo hello world', and verifying output.

        This is the main acceptance test for the OrbStack backend.
        """
        from src.backends.orbstack.backend import OrbStackBackend

        # Skip if image doesn't exist (need to build first)
        if not image_exists():
            pytest.skip("Docker image 'agent-sandbox-base' not found. Run docker/build.sh first.")

        backend = OrbStackBackend(orbstack_config)
        sandbox_id = None

        try:
            # 1. Create sandbox
            sandbox_id = backend.create_sandbox(template="base")
            assert sandbox_id is not None
            assert sandbox_id.startswith("sbx_")

            # 2. Verify sandbox is running
            assert backend.is_sandbox_running(sandbox_id)

            # 3. Execute hello world command
            result = backend.run_command(sandbox_id, "echo 'hello world'")

            # 4. Verify output
            assert result.exit_code == 0
            assert "hello world" in result.stdout

            print(f"\n✓ OrbStack Hello World Test Passed!")
            print(f"  Sandbox ID: {sandbox_id}")
            print(f"  Output: {result.stdout}")

        finally:
            # 5. Cleanup - destroy sandbox
            if sandbox_id:
                backend.kill_sandbox(sandbox_id)
                assert not backend.is_sandbox_running(sandbox_id)

    def test_file_operations(self, orbstack_config):
        """Test file read/write operations."""
        from src.backends.orbstack.backend import OrbStackBackend

        if not image_exists():
            pytest.skip("Docker image 'agent-sandbox-base' not found.")

        backend = OrbStackBackend(orbstack_config)
        sandbox_id = None

        try:
            sandbox_id = backend.create_sandbox(template="base")

            # Write a file
            content = "Hello from test!"
            backend.write_file(sandbox_id, "/workspace/test.txt", content)

            # Verify file exists
            assert backend.file_exists(sandbox_id, "/workspace/test.txt")

            # Read the file
            read_content = backend.read_file(sandbox_id, "/workspace/test.txt")
            assert read_content == content

            print(f"\n✓ OrbStack File Operations Test Passed!")

        finally:
            if sandbox_id:
                backend.kill_sandbox(sandbox_id)

    def test_health_check(self, orbstack_config):
        """Test backend health check."""
        from src.backends.orbstack.backend import OrbStackBackend

        backend = OrbStackBackend(orbstack_config)
        health = backend.health_check()

        assert health["status"] == "healthy"
        assert health["backend"] == "orbstack"
        assert "docker_version" in health

        print(f"\n✓ OrbStack Health Check Passed!")
        print(f"  Docker version: {health.get('docker_version')}")


@pytest.mark.skipif(not docker_available(), reason="Docker not available")
def test_orbstack_hello_world_standalone(tmp_path):
    """
    Standalone hello world test that can be run independently.

    This test:
    1. Creates an OrbStack sandbox
    2. Executes 'echo hello world'
    3. Verifies output contains 'hello world'
    4. Destroys the sandbox
    """
    from src.backends.orbstack.backend import OrbStackBackend

    if not image_exists():
        pytest.skip("Docker image not found. Build with: cd docker && ./build.sh")

    config = {
        "image_prefix": "agent-sandbox",
        "workspace_dir": str(tmp_path / "workspaces"),
    }

    backend = OrbStackBackend(config)
    sandbox_id = backend.create_sandbox()

    try:
        result = backend.run_command(sandbox_id, "echo 'hello world'")

        assert "hello world" in result.stdout, f"Expected 'hello world' in output, got: {result.stdout}"
        assert result.exit_code == 0, f"Expected exit code 0, got: {result.exit_code}"

        print(f"\n{'='*50}")
        print(f"OrbStack Hello World Test: PASSED")
        print(f"{'='*50}")
        print(f"Sandbox ID: {sandbox_id}")
        print(f"Command: echo 'hello world'")
        print(f"Output: {result.stdout}")
        print(f"Exit Code: {result.exit_code}")
        print(f"{'='*50}")

    finally:
        backend.kill_sandbox(sandbox_id)
