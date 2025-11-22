"""Unit tests for Gemini client module."""

from pathlib import Path
from unittest.mock import MagicMock, Mock

import pytest

from codebase_search_cli.config import Config
from codebase_search_cli.gemini_client import GeminiSearchClient


def test_create_store(mock_config: Config, mock_genai_client: Mock, mocker: Mock) -> None:
    """Test creating a file search store."""
    mocker.patch("codebase_search_cli.gemini_client.genai.Client", return_value=mock_genai_client)

    client = GeminiSearchClient(mock_config)
    store_id, store_name = client.create_store("test_store")

    assert store_id == "test_store_123"
    assert store_name == "fileSearchStores/test_store_123"
    mock_genai_client.file_search_stores.create.assert_called_once_with(display_name="test_store")


def test_get_store(mock_config: Config, mock_genai_client: Mock, mocker: Mock) -> None:
    """Test getting a file search store."""
    mocker.patch("codebase_search_cli.gemini_client.genai.Client", return_value=mock_genai_client)

    client = GeminiSearchClient(mock_config)
    store = client.get_store("fileSearchStores/test_store_123")

    assert store is not None
    mock_genai_client.file_search_stores.get.assert_called_once_with(
        name="fileSearchStores/test_store_123"
    )


def test_list_files(mock_config: Config, mock_genai_client: Mock, mocker: Mock) -> None:
    """Test listing files in a store."""
    mocker.patch("codebase_search_cli.gemini_client.genai.Client", return_value=mock_genai_client)

    # Mock file list
    mock_file = MagicMock()
    mock_file.name = "test_file.py"
    mock_file.display_name = "test_file.py"
    mock_file.size_bytes = 1024
    mock_file.state = "ACTIVE"

    mock_genai_client.file_search_stores.list_files.return_value = [mock_file]

    client = GeminiSearchClient(mock_config)
    files = client.list_files("fileSearchStores/test_store_123")

    assert len(files) == 1
    assert files[0]["name"] == "test_file.py"
    assert files[0]["display_name"] == "test_file.py"
    assert files[0]["size_bytes"] == 1024


def test_upload_file(
    mock_config: Config, mock_genai_client: Mock, sample_codebase: Path, mocker: Mock
) -> None:
    """Test uploading a file to the store."""
    mocker.patch("codebase_search_cli.gemini_client.genai.Client", return_value=mock_genai_client)

    client = GeminiSearchClient(mock_config)
    file_path = sample_codebase / "main.py"

    file_name = client.upload_file(
        file_path=file_path,
        store_name="fileSearchStores/test_store_123",
        display_name="main.py",
        metadata={"test": "value"},
    )

    assert file_name == "test_file.py"
    mock_genai_client.file_search_stores.upload_to_file_search_store.assert_called_once()


def test_upload_file_not_found(mock_config: Config, mocker: Mock) -> None:
    """Test uploading a non-existent file raises error."""
    mock_client = MagicMock()
    mocker.patch("codebase_search_cli.gemini_client.genai.Client", return_value=mock_client)

    client = GeminiSearchClient(mock_config)

    with pytest.raises(FileNotFoundError):
        client.upload_file(
            file_path=Path("/nonexistent/file.py"),
            store_name="fileSearchStores/test_store_123",
        )


def test_search(mock_config: Config, mock_genai_client: Mock, mocker: Mock) -> None:
    """Test semantic search."""
    mocker.patch("codebase_search_cli.gemini_client.genai.Client", return_value=mock_genai_client)

    client = GeminiSearchClient(mock_config)
    result = client.search(
        query="find authentication code",
        store_name="fileSearchStores/test_store_123",
        top_k=5,
    )

    assert result["text"] == "Test search result"
    assert "sources" in result
    assert "grounding_metadata" in result
    mock_genai_client.models.generate_content.assert_called_once()


def test_search_with_metadata_filter(
    mock_config: Config, mock_genai_client: Mock, mocker: Mock
) -> None:
    """Test search with metadata filter."""
    mocker.patch("codebase_search_cli.gemini_client.genai.Client", return_value=mock_genai_client)

    client = GeminiSearchClient(mock_config)
    result = client.search(
        query="find functions",
        store_name="fileSearchStores/test_store_123",
        top_k=3,
        metadata_filter="extension=.py",
    )

    assert result["text"] == "Test search result"


def test_delete_store(mock_config: Config, mock_genai_client: Mock, mocker: Mock) -> None:
    """Test deleting a file search store."""
    mocker.patch("codebase_search_cli.gemini_client.genai.Client", return_value=mock_genai_client)

    client = GeminiSearchClient(mock_config)
    client.delete_store("fileSearchStores/test_store_123")

    mock_genai_client.file_search_stores.delete.assert_called_once_with(
        name="fileSearchStores/test_store_123"
    )
