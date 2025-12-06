#!/usr/bin/env python3
"""
Crawl4AI CLI for web scraping and crawling.

Provides command-line interface for scraping single pages and crawling websites.
"""

import asyncio
import json
import sys
from pathlib import Path

import click

from .crawler import crawl_website
from .scraper import scrape_url
from .utils import extract_filename_from_url


@click.group()
@click.option("--verbose", "-v", is_flag=True, help="Enable verbose logging")
def cli(verbose):
    """Crawl4AI Web Scraping and Crawling Tools."""
    if verbose:
        import logging

        logging.basicConfig(level=logging.INFO)


@cli.command()
@click.argument("url")
@click.argument("output_path")
@click.option(
    "--format",
    "output_format",
    default="json",
    type=click.Choice(["json", "markdown"]),
    help="Output format",
)
def scrape(url: str, output_path: str, output_format: str):
    r"""Scrape a single webpage and save to file.

    \b
    URL: The webpage URL to scrape
    OUTPUT_PATH: Path to save the scraped content
    """
    try:
        # Run the async scraping function
        result = asyncio.run(scrape_url(url))

        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)

        if output_format == "json":
            output.write_text(json.dumps(result, indent=2, ensure_ascii=False))
        else:  # markdown
            if result.get("success"):
                content = f"# {result.get('title', 'Scraped Page')}\n\n"
                content += f"**URL:** {result.get('url', url)}\n\n"
                content += result.get("markdown", "")
                output.write_text(content)
            else:
                click.echo(f"Error: {result.get('error', 'Unknown error')}", err=True)
                sys.exit(1)

        if result.get("success"):
            click.echo(f"✓ Scraped {url} → {output_path}")
        else:
            click.echo(
                f"✗ Failed to scrape {url}: {result.get('error', 'Unknown error')}",
                err=True,
            )
            sys.exit(1)

    except Exception as e:
        click.echo(f"✗ Error scraping {url}: {str(e)}", err=True)
        sys.exit(1)


@cli.command()
@click.argument("url")
@click.argument("output_dir")
@click.option("--depth", default=1, help="Maximum crawl depth")
@click.option("--max-pages", default=5, help="Maximum pages to crawl")
@click.option("--query", default="", help="Keywords for basic filtering")
@click.option(
    "--format",
    "output_format",
    default="json",
    type=click.Choice(["json", "markdown"]),
    help="Output format for each page",
)
def crawl(
    url: str,
    output_dir: str,
    depth: int,
    max_pages: int,
    query: str,
    output_format: str,
):
    r"""Crawl a website and save pages to directory.

    \b
    URL: The starting URL to crawl
    OUTPUT_DIR: Directory to save crawled pages
    """
    try:
        # Run the async crawling function
        results = asyncio.run(crawl_website(url, depth, max_pages, query))

        output = Path(output_dir)
        output.mkdir(parents=True, exist_ok=True)

        successful_pages = 0
        failed_pages = 0

        for i, page in enumerate(results):
            if page.get("success"):
                # Generate filename
                page_url = page.get("url", f"page_{i+1}")
                title = page.get("title", "")
                filename_base = (
                    extract_filename_from_url(page_url, title) or f"page_{i+1}"
                )

                if output_format == "json":
                    filename = f"{filename_base}.json"
                    (output / filename).write_text(
                        json.dumps(page, indent=2, ensure_ascii=False)
                    )
                else:  # markdown
                    filename = f"{filename_base}.md"
                    content = f"# {page.get('title', 'Crawled Page')}\n\n"
                    content += f"**URL:** {page.get('url', '')}\n"
                    content += f"**Depth:** {page.get('depth', 0)}\n\n"
                    content += page.get("markdown", "")
                    (output / filename).write_text(content)

                successful_pages += 1
            else:
                # Save error info for debugging
                error_file = output / f"error_page_{i+1}.json"
                error_file.write_text(json.dumps(page, indent=2, ensure_ascii=False))
                failed_pages += 1

        # Create summary
        summary = {
            "crawl_url": url,
            "total_pages": len(results),
            "successful_pages": successful_pages,
            "failed_pages": failed_pages,
            "crawl_depth": depth,
            "max_pages": max_pages,
            "query": query,
            "output_format": output_format,
        }

        (output / "crawl_summary.json").write_text(json.dumps(summary, indent=2))

        click.echo(f"✓ Crawled {successful_pages} pages successfully → {output_dir}/")
        if failed_pages > 0:
            click.echo(
                f"⚠ {failed_pages} pages failed to crawl (see error_page_*.json files)"
            )

    except Exception as e:
        click.echo(f"✗ Error crawling {url}: {str(e)}", err=True)
        sys.exit(1)


@cli.command()
@click.argument("url")
@click.argument("output_path")
@click.option("--title", default="", help="Custom title for the saved document")
def save_as_markdown(url: str, output_path: str, title: str):
    r"""Scrape a page and save as clean markdown (alias for scrape --format markdown).

    \b
    URL: The webpage URL to scrape
    OUTPUT_PATH: Path to save the markdown file
    """
    try:
        result = asyncio.run(scrape_url(url))

        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)

        if result.get("success"):
            # Use custom title or page title or default
            doc_title = title or result.get("title", "Scraped Page")

            content = f"# {doc_title}\n\n"
            content += f"**Source:** {result.get('url', url)}\n"
            content += f"**Scraped:** {asyncio.run(_get_current_timestamp())}\n\n"
            content += "---\n\n"
            content += result.get("markdown", "")

            output.write_text(content)
            click.echo(f"✓ Saved {url} as markdown → {output_path}")
        else:
            click.echo(
                f"✗ Failed to scrape {url}: {result.get('error', 'Unknown error')}",
                err=True,
            )
            sys.exit(1)

    except Exception as e:
        click.echo(f"✗ Error saving {url}: {str(e)}", err=True)
        sys.exit(1)


async def _get_current_timestamp():
    """Get current timestamp for documentation."""
    from datetime import datetime

    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


if __name__ == "__main__":
    cli()
