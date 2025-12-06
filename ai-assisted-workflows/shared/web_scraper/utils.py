"""Simplified utilities for crawl4ai integration."""

import logging
import re

logger = logging.getLogger(__name__)


def validate_and_normalize_url(url: str) -> str:
    """Validate and normalize a URL.

    Args:
        url: The URL string to validate.

    Returns
    -------
        The normalized URL with https scheme if valid.

    Raises
    ------
        ValueError: If URL is invalid.
    """
    # Simple validation for domains/subdomains with http(s)
    # Allows for optional paths
    url_pattern = re.compile(
        r"^(?:https?://)?(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+(?:[A-Z]{2,6}\.?|[A-Z0-9-]{2,}\.?)|"  # domain...
        r"localhost|"  # localhost...
        r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})"  # ...or ip
        r"(?::\d+)?"  # optional port
        r"(?:/?|[/?]\S+)$",
        re.IGNORECASE,
    )

    if not url_pattern.match(url):
        raise ValueError(f"Invalid URL format: {url}")

    # Add https:// if missing
    if not url.startswith("http://") and not url.startswith("https://"):
        url = f"https://{url}"

    return url


def extract_filename_from_url(url: str, title: str = "") -> str:
    """
    Extract a meaningful filename from a URL or title.

    Args:
        url: The URL to extract filename from
        title: Optional page title to use

    Returns
    -------
        A kebab-case filename without extension
    """
    # Try to use title first
    if title:
        filename = re.sub(r"[^a-zA-Z0-9\s-]", "", title)
        filename = re.sub(r"\s+", "-", filename.strip())
        filename = filename.lower()[:50]  # Limit length
        if filename:
            return filename

    # Fall back to URL path
    try:
        from urllib.parse import urlparse

        parsed = urlparse(url)
        path = parsed.path.strip("/")

        if path:
            # Remove extension and convert to kebab-case
            path_parts = path.split("/")
            filename = path_parts[-1]
            filename = re.sub(r"\.[^.]*$", "", filename)  # Remove extension
            filename = re.sub(r"[^a-zA-Z0-9\s-]", "", filename)
            filename = re.sub(r"\s+", "-", filename)
            filename = filename.lower()[:50]
            if filename:
                return filename
    except Exception:
        pass

    # Final fallback - use domain
    try:
        from urllib.parse import urlparse

        parsed = urlparse(url)
        domain = parsed.netloc.replace(".", "-").replace(":", "-")
        return domain[:30]
    except Exception:
        return "scraped-page"
