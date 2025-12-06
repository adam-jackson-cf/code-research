"""Command registrations for the Enaible CLI."""

from __future__ import annotations

import importlib
from collections.abc import Iterable

# Explicit command modules to import for side effects.
_COMMAND_MODULES: Iterable[str] = (
    "enaible.commands.root",
    "enaible.commands.analyzers",
    "enaible.commands.prompts",
    "enaible.commands.install",
    "enaible.commands.ci",
    "enaible.commands.setup",
)


def _register_commands() -> None:
    for module_name in _COMMAND_MODULES:
        importlib.import_module(module_name)


_register_commands()
