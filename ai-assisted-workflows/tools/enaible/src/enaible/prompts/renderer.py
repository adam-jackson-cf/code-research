"""Prompt rendering engine."""

from __future__ import annotations

import difflib
import re
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, StrictUndefined

from ..constants import MANAGED_SENTINEL
from ..runtime.context import WorkspaceContext
from .adapters import SYSTEM_CONTEXTS, SystemRenderContext
from .catalog import CATALOG, PromptDefinition, SystemPromptConfig
from .utils import VariableSpec, extract_variables


@dataclass(frozen=True)
class RenderResult:
    prompt_id: str
    system: str
    content: str
    output_path: Path

    def write(self) -> None:
        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        self.output_path.write_text(self.content)

    def diff(self) -> str:
        if not self.output_path.exists():
            return ""
        current = self.output_path.read_text().splitlines(keepends=True)
        updated = self.content.splitlines(keepends=True)
        diff_lines = list(
            difflib.unified_diff(
                current,
                updated,
                fromfile=str(self.output_path),
                tofile=f"{self.output_path} (generated)",
            )
        )
        return "".join(diff_lines)


class PromptRenderer:
    def __init__(self, context: WorkspaceContext):
        self.context = context
        self.env = Environment(
            loader=FileSystemLoader(str(context.repo_root)),
            autoescape=False,
            trim_blocks=True,
            lstrip_blocks=True,
            undefined=StrictUndefined,
        )

    def list_prompts(self) -> Sequence[PromptDefinition]:
        return list(CATALOG.values())

    def render(
        self,
        prompt_ids: Iterable[str],
        systems: Iterable[str],
        output_override: dict[str, Path | None] | None = None,
    ) -> list[RenderResult]:
        results: list[RenderResult] = []
        for prompt_id in prompt_ids:
            definition = self._get_prompt(prompt_id)
            for system in systems:
                try:
                    config = self._get_system_config(definition, system)
                except ValueError:
                    continue
                system_context = self._get_system_context(system)
                rendered_body = self._render_body(definition, system_context, config)
                variables, stripped_body = extract_variables(rendered_body)
                content = self._render_wrapper(
                    definition,
                    system_context,
                    config,
                    stripped_body,
                    variables,
                )
                output_path = self._resolve_output_path(config, system, output_override)
                results.append(
                    RenderResult(
                        prompt_id=prompt_id,
                        system=system,
                        content=self._ensure_trailing_newline(content),
                        output_path=output_path,
                    )
                )
        return results

    def _get_prompt(self, prompt_id: str) -> PromptDefinition:
        try:
            return CATALOG[prompt_id]
        except KeyError as exc:
            available = ", ".join(sorted(CATALOG.keys()))
            raise ValueError(
                f"Unknown prompt '{prompt_id}'. Available: {available}"
            ) from exc

    def _get_system_config(
        self, definition: PromptDefinition, system: str
    ) -> SystemPromptConfig:
        try:
            return definition.systems[system]
        except KeyError as exc:
            available = ", ".join(sorted(definition.systems.keys()))
            raise ValueError(
                f"Prompt '{definition.prompt_id}' does not support system '{system}'. Available: {available}"
            ) from exc

    def _get_system_context(self, system: str) -> SystemRenderContext:
        try:
            return SYSTEM_CONTEXTS[system]
        except KeyError as exc:
            available = ", ".join(sorted(SYSTEM_CONTEXTS.keys()))
            raise ValueError(
                f"Unknown system '{system}'. Available: {available}"
            ) from exc

    def _render_body(
        self,
        definition: PromptDefinition,
        system: SystemRenderContext,
        config: SystemPromptConfig,
    ) -> str:
        source_path = (self.context.repo_root / definition.source_path).resolve()
        template_path = source_path.relative_to(self.context.repo_root).as_posix()
        template = self.env.get_template(template_path)
        rendered = template.render(
            prompt=definition,
            system=system,
            metadata=config.metadata,
        )
        # Replace @SYSTEMS.md placeholder with system-specific file
        systems_file = "CLAUDE.md" if system.name == "claude-code" else "AGENTS.md"
        rendered = rendered.replace("@SYSTEMS.md", systems_file)
        return rendered

    def _render_wrapper(
        self,
        definition: PromptDefinition,
        system: SystemRenderContext,
        config: SystemPromptConfig,
        body: str,
        variables: list[VariableSpec],
    ) -> str:
        body_cleaned, _ = self._strip_legacy_title(body)

        template_path = (
            (self.context.repo_root / Path(config.template))
            .resolve()
            .relative_to(self.context.repo_root)
            .as_posix()
        )
        template = self.env.get_template(template_path)
        argument_hint = _argument_hint_from_variables(variables)
        frontmatter = dict(config.frontmatter)
        if argument_hint:
            frontmatter.setdefault("argument-hint", argument_hint)
        return template.render(
            title=definition.title,
            body=body_cleaned.strip() + "\n" if body_cleaned.strip() else "",
            prompt=definition,
            system=system,
            frontmatter=frontmatter,
            metadata=config.metadata,
            variables=variables,
            managed_sentinel=MANAGED_SENTINEL,
        )

    def _resolve_output_path(
        self,
        config: SystemPromptConfig,
        system: str,
        overrides: dict[str, Path | None] | None,
    ) -> Path:
        base = None
        if overrides is not None:
            base = overrides.get(system)
        if base is None:
            return self.context.repo_root / config.output_path
        relative = self._system_relative_output_path(config.output_path, system)
        return base / relative

    @staticmethod
    def _system_relative_output_path(path: Path, system: str) -> Path:
        # Try standard systems/<system>/ structure
        system_root = Path("systems") / system
        try:
            return path.relative_to(system_root)
        except ValueError:
            pass

        # Try .build/rendered/<system>/ structure (used by catalog)
        rendered_root = Path(".build") / "rendered" / system
        try:
            return path.relative_to(rendered_root)
        except ValueError:
            pass

        # Try generic systems/ prefix
        try:
            return path.relative_to(Path("systems"))
        except ValueError:
            return Path(path.name)

    _LEGACY_TITLE_RE = re.compile(r"^#\s+.+?\bv\d+(?:\.\d+)*\s*$", re.IGNORECASE)

    @classmethod
    def _strip_legacy_title(cls, body: str) -> tuple[str, bool]:
        lines = body.splitlines()
        idx = 0
        while idx < len(lines) and not lines[idx].strip():
            idx += 1

        removed = False
        if idx < len(lines) and cls._LEGACY_TITLE_RE.match(lines[idx].strip()):
            lines.pop(idx)
            removed = True
            while idx < len(lines) and not lines[idx].strip():
                lines.pop(idx)

        cleaned = "\n".join(lines).strip("\n")
        if cleaned:
            cleaned += "\n"
        return cleaned, removed

    @staticmethod
    def _ensure_trailing_newline(value: str) -> str:
        return value if value.endswith("\n") else f"{value}\n"


def _argument_hint_from_variables(variables: list[VariableSpec]) -> str:
    tokens: list[str] = []

    positional = [var for var in variables if var.kind == "positional"]
    positional.sort(key=lambda var: var.positional_index or 0)

    flags = [var for var in variables if var.kind in {"flag", "named"}]
    flags.sort(key=lambda var: (var.flag_name or var.token).lower())

    def _format_label(var: VariableSpec, base: str) -> str:
        label = base
        if not var.required:
            label = f"{label}?"
        return f"[{label}]"

    for var in positional:
        label = var.token.lstrip("$").lstrip("@").lower().replace("_", "-")
        tokens.append(_format_label(var, label))

    for var in flags:
        base = var.flag_name or var.token.lstrip("$").lstrip("@")
        base = base.lower()
        tokens.append(_format_label(var, base))

    return " ".join(tokens)
