"""HTTP client for Parallel AI API."""

from __future__ import annotations

from typing import Any

import httpx

from .config import API_BASE, BETA_HEADER, get_api_key


def api_request(
    method: str,
    endpoint: str,
    json: dict[str, Any] | None = None,
    use_beta: bool = True,
) -> dict[str, Any]:
    """Make authenticated API request to Parallel AI.

    Args:
        method: HTTP method (GET, POST, etc.)
        endpoint: API endpoint path (e.g., "/v1beta/search")
        json: Optional JSON body for POST requests
        use_beta: Whether to include the beta header

    Returns
    -------
        JSON response from the API.

    Raises
    ------
        httpx.HTTPStatusError: If the request fails.
    """
    headers: dict[str, str] = {
        "x-api-key": get_api_key(),
        "Content-Type": "application/json",
    }
    if use_beta:
        headers["parallel-beta"] = BETA_HEADER

    with httpx.Client(timeout=60.0) as client:
        response = client.request(
            method,
            f"{API_BASE}{endpoint}",
            headers=headers,
            json=json,
        )
        response.raise_for_status()
        return response.json()  # type: ignore[no-any-return]
