from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

from .utils import extract_variables

_DOLLAR_TOKEN = re.compile(r"\$[A-Z][A-Z0-9_]*")
_AT_TOKEN = re.compile(r"@([A-Z][A-Z0-9_]*)")


@dataclass(frozen=True)
class LintIssue:
    path: Path
    line: int
    message: str


def _strip_code_blocks(text: str) -> str:
    lines = text.splitlines()
    out: list[str] = []
    fenced = False
    for line in lines:
        if line.strip().startswith("```"):
            fenced = not fenced
            out.append("")
            continue
        if fenced:
            out.append("")
        else:
            # strip inline code spans as well
            out.append(re.sub(r"`[^`]*`", "", line))
    return "\n".join(out)


def lint_content(path: Path, content: str) -> list[LintIssue]:
    issues: list[LintIssue] = []
    variables, body = extract_variables(content)

    # 1) $-prefixed tokens are forbidden outside code blocks and mapping bullets
    scrubbed = _strip_code_blocks(content)
    for idx, line in enumerate(scrubbed.splitlines(), start=1):
        if line.strip().startswith(("- @", "###", "## ")):
            continue
        if _DOLLAR_TOKEN.search(line):
            issues.append(
                LintIssue(
                    path,
                    idx,
                    "Found forbidden $VAR token; use @TOKEN mapping in Variables.",
                )
            )

    # 2) Every @TOKEN in body must be declared in Variables
    declared = {v.token for v in variables}
    for idx, line in enumerate(body.splitlines(), start=1):
        for m in _AT_TOKEN.finditer(line):
            token = f"@{m.group(1)}"
            if token not in declared:
                issues.append(
                    LintIssue(path, idx, f"Undeclared token {token} used in body.")
                )

    # 3) Shape checks for variables
    for v in variables:
        if not v.token.startswith("@"):
            issues.append(
                LintIssue(path, 1, f"Variable token must start with @: {v.token}")
            )
        if v.kind == "positional" and not v.positional_index:
            issues.append(
                LintIssue(path, 1, f"Required {v.token} must map to $N index.")
            )
        if v.kind == "flag" and (not v.flag_name or not v.flag_name.startswith("--")):
            issues.append(
                LintIssue(path, 1, f"Optional {v.token} must map to a --flag.")
            )

    return issues


def lint_files(files: Iterable[Path]) -> list[LintIssue]:
    issues: list[LintIssue] = []
    for p in files:
        try:
            content = p.read_text()
        except Exception as exc:  # pragma: no cover
            issues.append(LintIssue(p, 1, f"Unable to read file: {exc}"))
            continue
        issues.extend(lint_content(p, content))
    return issues
