"""Integration tests for the codebase search CLI.

These tests require a valid Google API key set in the GOOGLE_API_KEY environment variable.
They can be skipped if the API key is not available.
"""

import os
from pathlib import Path

import pytest
from typer.testing import CliRunner

from codebase_search_cli.config import Config
from codebase_search_cli.gemini_client import GeminiSearchClient
from codebase_search_cli.main import app

# Skip integration tests if no API key is available
pytestmark = pytest.mark.skipif(
    not os.getenv("GOOGLE_API_KEY"),
    reason="GOOGLE_API_KEY not set - skipping integration tests",
)

runner = CliRunner()


@pytest.fixture
def integration_env(temp_dir: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Set up integration test environment."""
    monkeypatch.chdir(temp_dir)
    env_file = temp_dir / ".env"
    api_key = os.getenv("GOOGLE_API_KEY")
    env_file.write_text(f"GOOGLE_API_KEY={api_key}\n")
    return env_file


@pytest.fixture
def cleanup_store() -> None:
    """Cleanup fixture to delete test store after tests."""
    yield
    # Cleanup code runs after test
    try:
        config = Config.load_from_env()
        if config.file_search_store_name:
            client = GeminiSearchClient(config)
            client.delete_store(config.file_search_store_name)
    except Exception:
        pass  # Ignore cleanup errors


def test_integration_full_workflow(
    integration_env: Path, sample_codebase: Path, cleanup_store: None
) -> None:
    """Test complete workflow: init, index, search, list, clear."""
    # 1. Initialize store
    result = runner.invoke(app, ["init", "--name", "test_integration_store"])
    assert result.exit_code == 0
    assert "Store created successfully" in result.stdout

    # 2. Index codebase
    result = runner.invoke(app, ["index", str(sample_codebase), "--pattern", "*.py"])
    assert result.exit_code == 0
    assert "Indexing complete" in result.stdout

    # 3. List files
    result = runner.invoke(app, ["list-files"])
    assert result.exit_code == 0

    # 4. Search
    result = runner.invoke(app, ["search", "find functions that add or multiply numbers"])
    assert result.exit_code == 0

    # 5. Info
    result = runner.invoke(app, ["info"])
    assert result.exit_code == 0
    assert "test_integration_store" in result.stdout

    # 6. Clear store
    result = runner.invoke(app, ["clear", "--yes"])
    assert result.exit_code == 0
    assert "Store deleted successfully" in result.stdout


def test_integration_create_and_delete_store(integration_env: Path) -> None:
    """Test creating and deleting a store."""
    # Create store
    config = Config.load_from_env()
    client = GeminiSearchClient(config)

    store_id, store_name = client.create_store("test_store_create_delete")
    assert store_id
    assert store_name

    # Verify we can get the store
    store = client.get_store(store_name)
    assert store

    # Delete store
    client.delete_store(store_name)


def test_integration_upload_and_search(integration_env: Path, sample_codebase: Path) -> None:
    """Test uploading files and searching."""
    config = Config.load_from_env()
    client = GeminiSearchClient(config)

    try:
        # Create store
        store_id, store_name = client.create_store("test_upload_search")
        config.save_store_info(store_id, store_name)

        # Upload a file
        file_path = sample_codebase / "utils.py"
        file_name = client.upload_file(
            file_path=file_path,
            store_name=store_name,
            metadata={"language": "python"},
        )
        assert file_name

        # List files
        files = client.list_files(store_name)
        assert len(files) > 0

        # Search
        result = client.search(
            query="find a function that adds two numbers",
            store_name=store_name,
        )
        assert "text" in result

    finally:
        # Cleanup
        try:
            client.delete_store(store_name)
        except Exception:
            pass


def test_integration_search_with_metadata_filter(
    integration_env: Path, sample_codebase: Path
) -> None:
    """Test search with metadata filtering."""
    config = Config.load_from_env()
    client = GeminiSearchClient(config)

    try:
        # Create store
        store_id, store_name = client.create_store("test_metadata_filter")

        # Upload files with different metadata
        py_file = sample_codebase / "main.py"
        client.upload_file(
            file_path=py_file,
            store_name=store_name,
            metadata={"language": "python", "type": "main"},
        )

        md_file = sample_codebase / "README.md"
        client.upload_file(
            file_path=md_file,
            store_name=store_name,
            metadata={"language": "markdown", "type": "docs"},
        )

        # Search with filter
        result = client.search(
            query="find documentation",
            store_name=store_name,
            metadata_filter="language=markdown",
        )
        assert "text" in result

    finally:
        # Cleanup
        try:
            client.delete_store(store_name)
        except Exception:
            pass
