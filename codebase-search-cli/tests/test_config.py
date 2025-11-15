"""Unit tests for configuration module."""

from pathlib import Path

import pytest

from codebase_search_cli.config import Config


def test_config_load_from_env(sample_env_file: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Test loading configuration from .env file."""
    monkeypatch.chdir(sample_env_file.parent)

    config = Config.load_from_env()

    assert config.google_api_key == "test_api_key_123456"
    assert config.file_search_store_id == "test_store_id"
    assert config.file_search_store_name == "fileSearchStores/test_store_id"
    assert config.model_name == "gemini-2.0-flash-exp"


def test_config_defaults() -> None:
    """Test default configuration values."""
    config = Config(google_api_key="test_key")

    assert config.google_api_key == "test_key"
    assert config.file_search_store_name is None
    assert config.file_search_store_id is None
    assert config.model_name == "gemini-2.0-flash-exp"
    assert config.max_tokens_per_chunk == 500
    assert config.max_overlap_tokens == 50


def test_config_save_store_info(temp_dir: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Test saving store information to .env file."""
    monkeypatch.chdir(temp_dir)

    config = Config(google_api_key="test_key")
    config.save_store_info("new_store_id", "fileSearchStores/new_store_id")

    env_file = temp_dir / ".env"
    assert env_file.exists()

    content = env_file.read_text()
    assert "FILE_SEARCH_STORE_ID=new_store_id" in content
    assert "FILE_SEARCH_STORE_NAME=fileSearchStores/new_store_id" in content

    # Verify config is updated
    assert config.file_search_store_id == "new_store_id"
    assert config.file_search_store_name == "fileSearchStores/new_store_id"


def test_config_save_store_info_updates_existing(
    sample_env_file: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Test that saving store info updates existing entries."""
    monkeypatch.chdir(sample_env_file.parent)

    config = Config.load_from_env()
    config.save_store_info("updated_id", "fileSearchStores/updated_id")

    content = sample_env_file.read_text()
    assert "FILE_SEARCH_STORE_ID=updated_id" in content
    assert "FILE_SEARCH_STORE_NAME=fileSearchStores/updated_id" in content

    # Should not have duplicate entries
    assert content.count("FILE_SEARCH_STORE_ID") == 1
    assert content.count("FILE_SEARCH_STORE_NAME") == 1
