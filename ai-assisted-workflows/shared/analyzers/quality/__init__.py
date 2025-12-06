"""
Code Quality analyzers package.

Note:
- Avoid importing analyzer submodules here to prevent side-effect registrations
  during package import (important when invoking modules via `python -m`).
- Import submodules explicitly where needed, e.g.:
  `from analyzers.quality import complexity_lizard as _ql`.
"""

__all__: list[str] = []
