"""
Rule Extractor - Extract and classify testable rules from parsed content.
"""

import re
from typing import Dict, List, Optional
import hashlib


class RuleExtractor:
    """Extract and classify testable rules from parsed markdown content."""

    def __init__(self, parsed_data: Dict):
        self.parsed_data = parsed_data
        self.rules: List[Dict] = []

    def extract_rules(self) -> List[Dict]:
        """Extract all testable rules from the parsed data."""
        self.rules = []

        for section in self.parsed_data.get("sections", []):
            section_name = section.get("heading", "Unknown")

            for rule_data in section.get("rules", []):
                rule = self._create_rule(rule_data, section_name)
                if rule and rule["testable"]:
                    self.rules.append(rule)

        return self.rules

    def _create_rule(self, rule_data: Dict, section: str) -> Optional[Dict]:
        """Create a structured rule object."""
        text = rule_data.get("text", "")

        if not text or len(text) < 10:  # Skip very short rules
            return None

        # Generate unique rule ID
        rule_id = self._generate_rule_id(text, section)

        rule = {
            "rule_id": rule_id,
            "section": section,
            "description": text,
            "type": rule_data.get("type", "unknown"),
            "priority": rule_data.get("priority", "medium"),
            "testable": self._is_testable(rule_data),
            "commands": rule_data.get("commands", []),
            "keywords": rule_data.get("keywords", []),
            "test_type": self._determine_test_type(rule_data),
            "expected_behavior": self._extract_expected_behavior(rule_data),
            "negative_rules": self._extract_negative_rules(rule_data)
        }

        return rule

    def _generate_rule_id(self, text: str, section: str) -> str:
        """Generate a unique ID for a rule."""
        # Create a short hash from text and section
        content = f"{section}:{text}"
        hash_obj = hashlib.md5(content.encode())
        short_hash = hash_obj.hexdigest()[:8]

        # Create readable prefix from section
        prefix = re.sub(r'[^a-z0-9]', '', section.lower())[:10]

        return f"{prefix}_{short_hash}"

    def _is_testable(self, rule_data: Dict) -> bool:
        """Determine if a rule can be tested automatically."""
        rule_type = rule_data.get("type", "unknown")

        # Highly testable rule types
        testable_types = [
            "command_requirement",
            "command_prohibition",
            "preference",
            "workflow"
        ]

        if rule_type in testable_types:
            return True

        # Check if rule has commands (usually testable)
        if rule_data.get("commands"):
            return True

        # Documentation and style rules are less testable
        if rule_type in ["documentation", "code_style", "file_structure"]:
            return False

        return True

    def _determine_test_type(self, rule_data: Dict) -> str:
        """Determine what type of test should be used."""
        rule_type = rule_data.get("type", "unknown")

        if rule_type in ["command_requirement", "command_prohibition"]:
            return "command_check"

        if rule_type == "preference":
            return "preference_check"

        if rule_type == "workflow":
            return "workflow_check"

        if rule_type in ["code_style", "documentation"]:
            return "code_analysis"

        return "general_check"

    def _extract_expected_behavior(self, rule_data: Dict) -> Dict:
        """Extract expected behavior from the rule."""
        text = rule_data.get("text", "")
        rule_type = rule_data.get("type", "unknown")

        expected = {
            "should_contain": [],
            "should_not_contain": [],
            "should_execute": [],
            "should_not_execute": []
        }

        # Extract commands that should be used
        if rule_type == "command_requirement":
            expected["should_contain"] = rule_data.get("commands", [])
            expected["should_execute"] = rule_data.get("commands", [])

        # Extract commands that should be avoided
        if rule_type == "command_prohibition":
            expected["should_not_contain"] = rule_data.get("commands", [])
            expected["should_not_execute"] = rule_data.get("commands", [])

        # Extract preferences
        if rule_type == "preference":
            # Look for preferred tools/methods
            commands = rule_data.get("commands", [])
            if commands:
                expected["should_contain"] = commands

        return expected

    def _extract_negative_rules(self, rule_data: Dict) -> List[str]:
        """Extract prohibitions or things to avoid."""
        text = rule_data.get("text", "").lower()
        negative_rules = []

        # Look for negative keywords
        negative_patterns = [
            r"never\s+([^,\.]+)",
            r"don't\s+([^,\.]+)",
            r"do not\s+([^,\.]+)",
            r"avoid\s+([^,\.]+)"
        ]

        for pattern in negative_patterns:
            matches = re.findall(pattern, text)
            negative_rules.extend([m.strip() for m in matches])

        return negative_rules

    def filter_by_priority(self, priority_levels: List[str]) -> List[Dict]:
        """Filter rules by priority levels."""
        return [r for r in self.rules if r["priority"] in priority_levels]

    def filter_by_type(self, rule_types: List[str]) -> List[Dict]:
        """Filter rules by type."""
        return [r for r in self.rules if r["type"] in rule_types]

    def get_summary(self) -> Dict:
        """Get summary statistics of extracted rules."""
        total = len(self.rules)

        by_type = {}
        by_priority = {}
        testable_count = 0

        for rule in self.rules:
            # Count by type
            rule_type = rule["type"]
            by_type[rule_type] = by_type.get(rule_type, 0) + 1

            # Count by priority
            priority = rule["priority"]
            by_priority[priority] = by_priority.get(priority, 0) + 1

            # Count testable
            if rule["testable"]:
                testable_count += 1

        return {
            "total_rules": total,
            "testable_rules": testable_count,
            "by_type": by_type,
            "by_priority": by_priority
        }
