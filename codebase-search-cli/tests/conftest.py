"""Pytest configuration and fixtures."""

import tempfile
from pathlib import Path
from typing import Generator
from unittest.mock import MagicMock, Mock

import pytest

from codebase_search_cli.config import Config
from codebase_search_cli.gemini_client import GeminiSearchClient


@pytest.fixture
def temp_dir() -> Generator[Path, None, None]:
    """Create a temporary directory for tests."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        yield Path(tmp_dir)


@pytest.fixture
def sample_env_file(temp_dir: Path) -> Path:
    """Create a sample .env file."""
    env_file = temp_dir / ".env"
    env_file.write_text(
        "GOOGLE_API_KEY=test_api_key_123456\n"
        "FILE_SEARCH_STORE_ID=test_store_id\n"
        "FILE_SEARCH_STORE_NAME=fileSearchStores/test_store_id\n"
        "MODEL_NAME=gemini-2.0-flash-exp\n"
    )
    return env_file


@pytest.fixture
def mock_config() -> Config:
    """Create a mock configuration."""
    return Config(
        google_api_key="test_api_key_123456",
        file_search_store_id="test_store_id",
        file_search_store_name="fileSearchStores/test_store_id",
        model_name="gemini-2.0-flash-exp",
        max_tokens_per_chunk=500,
        max_overlap_tokens=50,
    )


@pytest.fixture
def mock_genai_client(mocker: Mock) -> Mock:
    """Create a mock genai client."""
    mock_client = MagicMock()

    # Mock file search stores
    mock_store = MagicMock()
    mock_store.name = "fileSearchStores/test_store_123"
    mock_client.file_search_stores.create.return_value = mock_store
    mock_client.file_search_stores.get.return_value = mock_store
    mock_client.file_search_stores.list_files.return_value = []
    mock_client.file_search_stores.delete.return_value = None

    # Mock file upload
    mock_operation = MagicMock()
    mock_operation.done.return_value = True
    mock_operation.metadata.file_name = "test_file.py"
    mock_client.file_search_stores.upload_to_file_search_store.return_value = mock_operation
    mock_client.operations.get.return_value = mock_operation

    # Mock search
    mock_response = MagicMock()
    mock_response.text = "Test search result"
    mock_candidate = MagicMock()
    mock_grounding = MagicMock()
    mock_grounding.grounding_chunks = []
    mock_candidate.grounding_metadata = mock_grounding
    mock_response.candidates = [mock_candidate]
    mock_client.models.generate_content.return_value = mock_response

    return mock_client


@pytest.fixture
def mock_gemini_client(
    mock_config: Config, mock_genai_client: Mock, mocker: Mock
) -> GeminiSearchClient:
    """Create a mock Gemini search client."""
    mocker.patch("codebase_search_cli.gemini_client.genai.Client", return_value=mock_genai_client)
    return GeminiSearchClient(mock_config)


@pytest.fixture
def sample_codebase(temp_dir: Path) -> Path:
    """Create a sample codebase directory with files."""
    codebase = temp_dir / "sample_code"
    codebase.mkdir()

    # Create some sample files
    (codebase / "main.py").write_text(
        "def main():\n    print('Hello, world!')\n\nif __name__ == '__main__':\n    main()\n"
    )

    (codebase / "utils.py").write_text(
        "def add(a, b):\n    return a + b\n\ndef multiply(a, b):\n    return a * b\n"
    )

    (codebase / "README.md").write_text("# Sample Project\n\nThis is a sample project.")

    # Create a subdirectory
    subdir = codebase / "subdir"
    subdir.mkdir()
    (subdir / "helper.py").write_text("def helper():\n    return 'helper'\n")

    return codebase
