"""Gemini API client wrapper for file search operations."""

import mimetypes
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from google import genai
from google.genai import types

from .config import Config


class GeminiSearchClient:
    """Client for interacting with Gemini API file search."""

    def __init__(self, config: Config):
        """Initialize the Gemini search client.

        Args:
            config: Application configuration
        """
        self.config = config
        self.client = genai.Client(api_key=config.google_api_key)

    def create_store(self, display_name: str) -> Tuple[str, str]:
        """Create a new file search store.

        Args:
            display_name: Display name for the store

        Returns:
            Tuple of (store_id, store_name)
        """
        store = self.client.file_search_stores.create(display_name=display_name)
        # Extract ID from the resource name (format: "fileSearchStores/{id}")
        store_id = store.name.split("/")[-1]
        return store_id, store.name

    def get_store(self, store_name: str) -> Any:
        """Get a file search store by name.

        Args:
            store_name: Name of the store (format: fileSearchStores/{id})

        Returns:
            Store object
        """
        return self.client.file_search_stores.get(name=store_name)

    def list_files(self, store_name: str) -> List[Dict[str, Any]]:
        """List all files in a store.

        Args:
            store_name: Name of the store

        Returns:
            List of file information dictionaries
        """
        try:
            files = self.client.file_search_stores.list_files(file_search_store_name=store_name)
            return [
                {
                    "name": f.name,
                    "display_name": getattr(f, "display_name", ""),
                    "size_bytes": getattr(f, "size_bytes", 0),
                    "state": str(getattr(f, "state", "unknown")),
                }
                for f in files
            ]
        except Exception:
            return []

    def upload_file(
        self,
        file_path: Path,
        store_name: str,
        display_name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Upload a file to the file search store.

        Args:
            file_path: Path to the file to upload
            store_name: Name of the store
            display_name: Optional display name for the file
            metadata: Optional metadata for the file

        Returns:
            Uploaded file name
        """
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        config: Dict[str, Any] = {
            "display_name": display_name or file_path.name,
            "chunking_config": {
                "white_space_config": {
                    "max_tokens_per_chunk": self.config.max_tokens_per_chunk,
                    "max_overlap_tokens": self.config.max_overlap_tokens,
                }
            },
        }

        if metadata:
            config["custom_metadata"] = [
                {"key": k, "string_value": str(v)} for k, v in metadata.items()
            ]

        # Detect mime type
        mime_type, _ = mimetypes.guess_type(str(file_path))

        operation = self.client.file_search_stores.upload_to_file_search_store(
            file=str(file_path),
            file_search_store_name=store_name,
            config=config,
            mime_type=mime_type,
        )

        # Wait for operation to complete
        while not operation.done():
            operation = self.client.operations.get(name=operation.name)

        return operation.metadata.file_name

    def search(
        self,
        query: str,
        store_name: str,
        top_k: int = 5,
        metadata_filter: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Perform semantic search on the indexed codebase.

        Args:
            query: Search query (can be intent-based or phrase-based)
            store_name: Name of the store to search
            top_k: Number of results to return
            metadata_filter: Optional metadata filter string

        Returns:
            Dictionary containing search results and response
        """
        # Configure the file search tool
        file_search_params: Dict[str, Any] = {
            "file_search_store_names": [store_name],
            "top_k": top_k,
        }

        if metadata_filter:
            file_search_params["metadata_filter"] = metadata_filter

        # Generate content with file search
        response = self.client.models.generate_content(
            model=self.config.model_name,
            contents=query,
            config=types.GenerateContentConfig(
                tools=[types.Tool(file_search=types.FileSearch(**file_search_params))],
            ),
        )

        # Extract grounding metadata
        result = {
            "text": response.text if hasattr(response, "text") else "",
            "sources": [],
            "grounding_metadata": None,
        }

        if hasattr(response, "candidates") and len(response.candidates) > 0:
            candidate = response.candidates[0]
            if hasattr(candidate, "grounding_metadata"):
                result["grounding_metadata"] = candidate.grounding_metadata

                # Extract source information
                if hasattr(candidate.grounding_metadata, "grounding_chunks"):
                    for chunk in candidate.grounding_metadata.grounding_chunks:
                        if hasattr(chunk, "retrieved_context"):
                            ctx = chunk.retrieved_context
                            source_info = {
                                "uri": getattr(ctx, "uri", ""),
                                "title": getattr(ctx, "title", ""),
                            }
                            if source_info not in result["sources"]:
                                result["sources"].append(source_info)

        return result

    def delete_store(self, store_name: str) -> None:
        """Delete a file search store.

        Args:
            store_name: Name of the store to delete
        """
        self.client.file_search_stores.delete(name=store_name)
