"""
Main application module.
"""

import os
from lib.utils import calculate_sum, format_output


def main():
    """
    Main entry point for the application.

    Example:
        >>> main()
        Result: 15
    """
    numbers = [1, 2, 3, 4, 5]
    result = calculate_sum(numbers)
    output = format_output(result)
    print(output)


if __name__ == "__main__":
    main()
