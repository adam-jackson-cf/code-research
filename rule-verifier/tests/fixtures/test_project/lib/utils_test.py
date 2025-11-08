"""
Tests for utility functions.
"""

import pytest
from lib.utils import calculate_sum, format_output


def test_calculate_sum():
    """Test calculate_sum with various inputs."""
    assert calculate_sum([1, 2, 3]) == 6
    assert calculate_sum([]) == 0
    assert calculate_sum([10]) == 10


def test_format_output():
    """Test format_output function."""
    assert format_output(42) == "Result: 42"
    assert format_output("test") == "Result: test"
