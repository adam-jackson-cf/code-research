"""Configuration and API key management for Parallel AI."""

from __future__ import annotations

import os
import sys

API_BASE = "https://api.parallel.ai"
BETA_HEADER = "search-extract-2025-10-10"


def get_api_key() -> str:
    """Get API key from environment.

    Returns
    -------
        The PARALLEL_API_KEY value.

    Raises
    ------
        SystemExit: If the API key is not set.
    """
    key = os.environ.get("PARALLEL_API_KEY")
    if not key:
        print(
            "Error: PARALLEL_API_KEY not set.\n"
            "Get your key from https://platform.parallel.ai",
            file=sys.stderr,
        )
        sys.exit(1)
    return key
