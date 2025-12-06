"""Enaible CLI package."""

# Import side-effect module registrations.
from . import commands as _commands  # noqa: F401
from .app import app

__all__ = ["app"]
