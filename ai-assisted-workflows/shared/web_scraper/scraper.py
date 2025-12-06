"""
Simplified web scraper without MCP dependencies.

Provides basic webpage scraping functionality using Crawl4AI.
"""

import logging
from typing import Any

from .session_manager import session_manager
from .utils import validate_and_normalize_url

logger = logging.getLogger(__name__)


async def scrape_url(url: str) -> dict[str, Any]:
    """
    Scrape content and metadata from a single webpage using Crawl4AI.

    Args:
        url: The URL to scrape

    Returns
    -------
        Dictionary containing page content and metadata
    """
    session_id = None
    try:
        # Validate and normalize URL
        url = validate_and_normalize_url(url)

        # Get crawler and unique session config
        crawler = await session_manager.get_crawler()
        config = await session_manager.get_session_config("scrape")
        session_id = config.session_id

        logger.info(f"Scraping {url} with session {session_id}")

        # Perform the crawl
        result = await crawler.arun(url=url, config=config)

        if result.success:
            # Prepare response data
            response_data = {
                "success": True,
                "url": result.url,
                "title": result.metadata.get("title", "") if result.metadata else "",
                "status_code": result.status_code,
                "markdown": result.markdown.raw_markdown if result.markdown else "",
                "cleaned_html": result.cleaned_html[:5000]
                if result.cleaned_html
                else "",  # Limit size
                "links": {
                    "internal": result.links.get("internal", [])[:20]
                    if result.links
                    else [],  # Limit to 20
                    "external": result.links.get("external", [])[:20]
                    if result.links
                    else [],  # Limit to 20
                },
                "media": {
                    "images": len(result.media.get("images", []))
                    if result.media
                    else 0,
                    "videos": len(result.media.get("videos", []))
                    if result.media
                    else 0,
                    "audios": len(result.media.get("audios", []))
                    if result.media
                    else 0,
                },
                "metadata": result.metadata if result.metadata else {},
                "session_id": session_id,  # Include session ID for debugging
            }

            logger.info(f"Successfully scraped {url} with session {session_id}")

        else:
            # Handle crawl failure
            response_data = {
                "success": False,
                "url": url,
                "error": result.error_message or "Unknown error occurred",
                "status_code": result.status_code
                if hasattr(result, "status_code")
                else None,
                "session_id": session_id,
            }

            logger.warning(f"Failed to scrape {url}: {response_data['error']}")

        # Mark session as inactive (don't immediately clean up)
        if session_id:
            await session_manager.cleanup_session(session_id)

        # Periodically clean up old sessions (only when threshold is reached)
        await session_manager.cleanup_old_sessions()

        return response_data

    except Exception as e:
        # Handle session errors
        logger.error(f"Error scraping {url}: {str(e)}")
        if session_id:
            await session_manager.handle_session_error(session_id)

        error_response = {
            "success": False,
            "url": url,
            "error": f"Scraping failed: {str(e)}",
            "error_type": type(e).__name__,
            "session_id": session_id,
        }

        return error_response
