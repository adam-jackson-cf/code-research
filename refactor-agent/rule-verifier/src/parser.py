"""Parser for markdown rules and deterministic capability inventory."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Dict, List

try:
    import frontmatter
except ModuleNotFoundError:  # pragma: no cover - exercised in offline environments
    frontmatter = None


class MarkdownParser:
    def __init__(self, file_path: str):
        self.file_path = Path(file_path)

    def parse(self) -> Dict:
        if not self.file_path.exists():
            raise FileNotFoundError(f"File not found: {self.file_path}")
        with self.file_path.open("r", encoding="utf-8") as handle:
            raw = handle.read()

        if frontmatter is None:
            metadata = {}
            content = raw
        else:
            post = frontmatter.loads(raw)
            metadata = post.metadata
            content = post.content

        sections = self._extract_sections(content)
        return {
            "file_path": str(self.file_path),
            "metadata": metadata,
            "sections": sections,
            "raw_content": content,
        }

    def _extract_sections(self, content: str) -> List[Dict]:
        sections: List[Dict] = []
        current: Dict | None = None
        for line in content.splitlines():
            heading = re.match(r"^(#{1,6})\s+(.+)$", line)
            if heading:
                if current:
                    sections.append(current)
                current = {
                    "heading": heading.group(2).strip(),
                    "level": len(heading.group(1)),
                    "content": [],
                    "rules": [],
                }
                continue
            if current is not None:
                current["content"].append(line)
        if current:
            sections.append(current)

        for section in sections:
            section["rules"] = self._extract_rules(section["content"])
        return sections

    def _extract_rules(self, lines: List[str]) -> List[Dict]:
        rules: List[Dict] = []
        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue
            match = re.match(r"^[-*]\s+(.+)$", stripped) or re.match(r"^\d+\.\s+(.+)$", stripped)
            if not match:
                continue
            text = match.group(1)
            commands = re.findall(r"`([^`]+)`", text)
            lower = text.lower()
            rule_type = "command_requirement" if "always" in lower or "must" in lower else "unknown"
            if "never" in lower or "do not" in lower:
                rule_type = "command_prohibition"
            rules.append({"text": text, "commands": commands, "type": rule_type, "priority": "high"})
        return rules


def parse_agents_file(file_path: str) -> Dict:
    return MarkdownParser(file_path).parse()


def build_capability_inventory(target_project_path: str) -> List[Dict]:
    root = Path(target_project_path)
    features: List[Dict] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(root)
        stem = re.sub(r"[^a-z0-9]+", "_", str(rel).lower()).strip("_")
        feature_id = f"cap_{stem[:48]}"
        keywords = [part for part in stem.split("_") if part][:6]
        features.append({"feature_id": feature_id, "path": str(rel), "keywords": keywords})
    return features
