"""
Pytest configuration and fixtures for the test suite.
"""

import pytest
import os


def pytest_configure(config):
    """Configure pytest with custom markers."""
    config.addinivalue_line(
        "markers", "integration: marks tests as integration tests (may require API keys)"
    )
    config.addinivalue_line(
        "markers", "slow: marks tests as slow (deselect with '-m \"not slow\"')"
    )


@pytest.fixture(scope="session")
def anthropic_api_key():
    """Get Anthropic API key from environment."""
    return os.getenv("ANTHROPIC_API_KEY")


@pytest.fixture(scope="session")
def has_api_key(anthropic_api_key):
    """Check if API key is available."""
    return anthropic_api_key is not None


@pytest.fixture
def sample_examples():
    """Sample examples for testing."""
    from prompt_optimizer.models import Example

    return [
        Example(input="test1", output="result1"),
        Example(input="test2", output="result2"),
        Example(input="test3", output="result3"),
    ]
