"""Rule extractor with deterministic feature IDs and trace metadata."""

from __future__ import annotations

import hashlib
import re
from typing import Dict, List


class RuleExtractor:
    def __init__(self, parsed_data: Dict):
        self.parsed_data = parsed_data
        self.rules: List[Dict] = []

    def extract_rules(self) -> List[Dict]:
        self.rules = []
        for section in self.parsed_data.get("sections", []):
            for rule_data in section.get("rules", []):
                text = rule_data.get("text", "")
                if len(text) < 5:
                    continue
                rule_id = self._rule_id(section.get("heading", "root"), text)
                feature_id = self._feature_id(text)
                self.rules.append(
                    {
                        "rule_id": rule_id,
                        "feature_id": feature_id,
                        "section": section.get("heading", "root"),
                        "description": text,
                        "type": rule_data.get("type", "unknown"),
                        "priority": rule_data.get("priority", "medium"),
                        "testable": True,
                        "commands": rule_data.get("commands", []),
                        "trace": {"source": self.parsed_data.get("file_path"), "section": section.get("heading", "root")},
                    }
                )
        return self.rules

    def _rule_id(self, section: str, text: str) -> str:
        digest = hashlib.sha1(f"{section}:{text}".encode("utf-8")).hexdigest()[:10]
        slug = re.sub(r"[^a-z0-9]+", "", section.lower())[:12]
        return f"{slug}_{digest}"

    def _feature_id(self, text: str) -> str:
        normalized = re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
        return f"feature_{normalized[:48]}"

    def filter_by_priority(self, levels: List[str]) -> List[Dict]:
        return [rule for rule in self.rules if rule["priority"] in levels]

    def filter_by_type(self, rule_types: List[str]) -> List[Dict]:
        return [rule for rule in self.rules if rule["type"] in rule_types]

    def get_summary(self) -> Dict:
        by_type: Dict[str, int] = {}
        by_priority: Dict[str, int] = {}
        for rule in self.rules:
            by_type[rule["type"]] = by_type.get(rule["type"], 0) + 1
            by_priority[rule["priority"]] = by_priority.get(rule["priority"], 0) + 1
        return {
            "total_rules": len(self.rules),
            "testable_rules": len(self.rules),
            "by_type": by_type,
            "by_priority": by_priority,
        }
