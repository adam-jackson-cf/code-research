"""Configuration management for the codebase search CLI."""

from pathlib import Path
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Config(BaseSettings):
    """Application configuration loaded from environment variables and .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    google_api_key: str = Field(..., description="Google API key for Gemini")
    file_search_store_name: Optional[str] = Field(None, description="Name of the file search store")
    file_search_store_id: Optional[str] = Field(None, description="ID of the file search store")
    model_name: str = Field(default="gemini-2.0-flash-exp", description="Gemini model to use")
    max_tokens_per_chunk: int = Field(
        default=500, description="Maximum tokens per chunk when indexing"
    )
    max_overlap_tokens: int = Field(default=50, description="Maximum overlap tokens between chunks")

    @classmethod
    def load_from_env(cls, env_path: Optional[Path] = None) -> "Config":
        """Load configuration from environment and .env file.

        Args:
            env_path: Optional path to .env file. If None, looks in current directory.

        Returns:
            Config instance
        """
        if env_path:
            return cls(_env_file=str(env_path))
        return cls()

    def save_store_info(self, store_id: str, store_name: str) -> None:
        """Save file search store information to .env file.

        Args:
            store_id: The store ID
            store_name: The store name
        """
        env_path = Path(".env")
        lines = []

        # Read existing content if file exists
        if env_path.exists():
            with open(env_path, "r") as f:
                lines = [
                    line for line in f.readlines() if not line.startswith("FILE_SEARCH_STORE_")
                ]

        # Add new store info
        lines.append(f"FILE_SEARCH_STORE_ID={store_id}\n")
        lines.append(f"FILE_SEARCH_STORE_NAME={store_name}\n")

        # Write back
        with open(env_path, "w") as f:
            f.writelines(lines)

        # Update current instance
        self.file_search_store_id = store_id
        self.file_search_store_name = store_name
