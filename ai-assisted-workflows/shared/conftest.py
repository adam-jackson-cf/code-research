#!/usr/bin/env python3
"""Global pytest configuration for the shared package.

Ensures the `shared` package root is on `sys.path` so absolute imports like
`from core...` and `from setup...` work from any test location.
"""

import sys
from pathlib import Path

# Load .env file to ensure environment variables are available to tests
try:
    from dotenv import load_dotenv

    # Look for .env in the project root (parent of shared/)
    project_root = Path(__file__).resolve().parent.parent
    env_file = project_root / ".env"
    if env_file.exists():
        load_dotenv(dotenv_path=env_file)
except ImportError:
    # python-dotenv not available - tests requiring .env will be skipped
    pass

_shared_dir = Path(__file__).resolve().parent
if str(_shared_dir) not in sys.path:
    sys.path.insert(0, str(_shared_dir))
