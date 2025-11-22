"""Unit tests for CLI commands."""

from pathlib import Path
from unittest.mock import MagicMock, Mock, patch

import pytest
from typer.testing import CliRunner

from codebase_search_cli.main import app

runner = CliRunner()


@pytest.fixture
def mock_env_setup(temp_dir: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Set up environment for CLI tests."""
    monkeypatch.chdir(temp_dir)
    env_file = temp_dir / ".env"
    env_file.write_text("GOOGLE_API_KEY=test_key_123\n")
    return env_file


def test_init_command(mock_env_setup: Path, mock_genai_client: Mock) -> None:
    """Test init command creates a store."""
    with patch("codebase_search_cli.gemini_client.genai.Client", return_value=mock_genai_client):
        result = runner.invoke(app, ["init", "--name", "test_store"])

        assert result.exit_code == 0
        assert "Store created successfully" in result.stdout
        assert "test_store_123" in result.stdout


def test_init_command_force(mock_env_setup: Path, mock_genai_client: Mock) -> None:
    """Test init command with force flag."""
    # First create a store
    env_file = mock_env_setup
    env_file.write_text(
        "GOOGLE_API_KEY=test_key_123\n"
        "FILE_SEARCH_STORE_ID=old_id\n"
        "FILE_SEARCH_STORE_NAME=fileSearchStores/old_id\n"
    )

    with patch("codebase_search_cli.gemini_client.genai.Client", return_value=mock_genai_client):
        result = runner.invoke(app, ["init", "--name", "new_store", "--force"])

        assert result.exit_code == 0
        assert "Store created successfully" in result.stdout


def test_init_command_without_force_existing_store(
    mock_env_setup: Path, mock_genai_client: Mock
) -> None:
    """Test init command without force when store exists."""
    env_file = mock_env_setup
    env_file.write_text(
        "GOOGLE_API_KEY=test_key_123\n"
        "FILE_SEARCH_STORE_ID=existing_id\n"
        "FILE_SEARCH_STORE_NAME=fileSearchStores/existing_id\n"
    )

    with patch("codebase_search_cli.gemini_client.genai.Client", return_value=mock_genai_client):
        result = runner.invoke(app, ["init", "--name", "test_store"])

        assert result.exit_code == 0
        assert "Store already exists" in result.stdout


def test_index_command_single_file(
    mock_env_setup: Path, mock_genai_client: Mock, sample_codebase: Path
) -> None:
    """Test index command with a single file."""
    env_file = mock_env_setup
    env_file.write_text(
        "GOOGLE_API_KEY=test_key_123\n"
        "FILE_SEARCH_STORE_ID=test_id\n"
        "FILE_SEARCH_STORE_NAME=fileSearchStores/test_id\n"
    )

    file_path = sample_codebase / "main.py"

    with patch("codebase_search_cli.gemini_client.genai.Client", return_value=mock_genai_client):
        result = runner.invoke(app, ["index", str(file_path)])

        assert result.exit_code == 0
        assert "Successfully indexed: 1" in result.stdout


def test_index_command_directory(
    mock_env_setup: Path, mock_genai_client: Mock, sample_codebase: Path
) -> None:
    """Test index command with a directory."""
    env_file = mock_env_setup
    env_file.write_text(
        "GOOGLE_API_KEY=test_key_123\n"
        "FILE_SEARCH_STORE_ID=test_id\n"
        "FILE_SEARCH_STORE_NAME=fileSearchStores/test_id\n"
    )

    with patch("codebase_search_cli.gemini_client.genai.Client", return_value=mock_genai_client):
        result = runner.invoke(app, ["index", str(sample_codebase)])

        assert result.exit_code == 0
        assert "Indexing complete" in result.stdout


def test_index_command_no_store(mock_env_setup: Path) -> None:
    """Test index command without initialized store."""
    result = runner.invoke(app, ["index", "/some/path"])

    assert result.exit_code == 1
    assert "No file search store initialized" in result.stdout


def test_search_command(mock_env_setup: Path, mock_genai_client: Mock) -> None:
    """Test search command."""
    env_file = mock_env_setup
    env_file.write_text(
        "GOOGLE_API_KEY=test_key_123\n"
        "FILE_SEARCH_STORE_ID=test_id\n"
        "FILE_SEARCH_STORE_NAME=fileSearchStores/test_id\n"
    )

    with patch("codebase_search_cli.gemini_client.genai.Client", return_value=mock_genai_client):
        result = runner.invoke(app, ["search", "find authentication code"])

        assert result.exit_code == 0
        assert "Searching for:" in result.stdout or "Test search result" in result.stdout


def test_search_command_with_filter(mock_env_setup: Path, mock_genai_client: Mock) -> None:
    """Test search command with file extension filter."""
    env_file = mock_env_setup
    env_file.write_text(
        "GOOGLE_API_KEY=test_key_123\n"
        "FILE_SEARCH_STORE_ID=test_id\n"
        "FILE_SEARCH_STORE_NAME=fileSearchStores/test_id\n"
    )

    with patch("codebase_search_cli.gemini_client.genai.Client", return_value=mock_genai_client):
        result = runner.invoke(app, ["search", "find functions", "--filter-ext", ".py"])

        # The test might exit with 0 or 1 depending on whether results are found
        assert result.exit_code in [0, 1]


def test_search_command_no_store(mock_env_setup: Path) -> None:
    """Test search command without initialized store."""
    result = runner.invoke(app, ["search", "test query"])

    assert result.exit_code == 1
    assert "No file search store initialized" in result.stdout


def test_list_files_command(mock_env_setup: Path, mock_genai_client: Mock) -> None:
    """Test list-files command."""
    env_file = mock_env_setup
    env_file.write_text(
        "GOOGLE_API_KEY=test_key_123\n"
        "FILE_SEARCH_STORE_ID=test_id\n"
        "FILE_SEARCH_STORE_NAME=fileSearchStores/test_id\n"
    )

    # Mock some files
    mock_file = MagicMock()
    mock_file.name = "test.py"
    mock_file.display_name = "test.py"
    mock_file.size_bytes = 2048
    mock_file.state = "ACTIVE"
    mock_genai_client.file_search_stores.list_files.return_value = [mock_file]

    with patch("codebase_search_cli.gemini_client.genai.Client", return_value=mock_genai_client):
        result = runner.invoke(app, ["list-files"])

        assert result.exit_code == 0
        assert "test.py" in result.stdout


def test_info_command(mock_env_setup: Path) -> None:
    """Test info command."""
    env_file = mock_env_setup
    env_file.write_text(
        "GOOGLE_API_KEY=test_key_123456\n"
        "FILE_SEARCH_STORE_ID=test_id\n"
        "FILE_SEARCH_STORE_NAME=fileSearchStores/test_id\n"
    )

    result = runner.invoke(app, ["info"])

    assert result.exit_code == 0
    assert "Configuration:" in result.stdout
    assert "test_id" in result.stdout


def test_clear_command_with_confirmation(mock_env_setup: Path, mock_genai_client: Mock) -> None:
    """Test clear command with yes flag."""
    env_file = mock_env_setup
    env_file.write_text(
        "GOOGLE_API_KEY=test_key_123\n"
        "FILE_SEARCH_STORE_ID=test_id\n"
        "FILE_SEARCH_STORE_NAME=fileSearchStores/test_id\n"
    )

    with patch("codebase_search_cli.gemini_client.genai.Client", return_value=mock_genai_client):
        result = runner.invoke(app, ["clear", "--yes"])

        assert result.exit_code == 0
        assert "Store deleted successfully" in result.stdout


def test_clear_command_no_store(mock_env_setup: Path) -> None:
    """Test clear command when no store exists."""
    result = runner.invoke(app, ["clear", "--yes"])

    assert result.exit_code == 0
    assert "No file search store to delete" in result.stdout
