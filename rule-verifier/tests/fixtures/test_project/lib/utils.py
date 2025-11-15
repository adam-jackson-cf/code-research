"""
Utility functions for the application.
"""


def calculate_sum(numbers):
    """
    Calculate the sum of a list of numbers.

    Args:
        numbers: List of numbers to sum

    Returns:
        The sum of all numbers

    Example:
        >>> calculate_sum([1, 2, 3])
        6
    """
    return sum(numbers)


async def async_fetch_data(url):
    """
    Fetch data from a URL asynchronously.

    Args:
        url: The URL to fetch from

    Returns:
        The fetched data

    Example:
        >>> import asyncio
        >>> data = asyncio.run(async_fetch_data("https://example.com"))
    """
    # Simulated async operation
    await asyncio.sleep(0.1)
    return f"Data from {url}"


def format_output(value):
    """
    Format a value for output.

    Args:
        value: Value to format

    Returns:
        Formatted string
    """
    return f"Result: {value}"
