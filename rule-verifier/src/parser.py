"""
Parser for AGENTS.md and CLAUDE.md files.
Extracts structured content including sections and rules.
"""

import re
from pathlib import Path
from typing import Dict, List, Optional
import frontmatter


class MarkdownParser:
    """Parse AGENTS.md/CLAUDE.md files and extract structured content."""

    def __init__(self, file_path: str):
        self.file_path = Path(file_path)
        self.content: str = ""
        self.metadata: Dict = {}
        self.sections: List[Dict] = []

    def parse(self) -> Dict:
        """Parse the markdown file and return structured data."""
        if not self.file_path.exists():
            raise FileNotFoundError(f"File not found: {self.file_path}")

        # Read file with frontmatter support
        with open(self.file_path, 'r', encoding='utf-8') as f:
            post = frontmatter.load(f)
            self.metadata = post.metadata
            self.content = post.content

        # Extract sections
        self.sections = self._extract_sections()

        return {
            "file_path": str(self.file_path),
            "metadata": self.metadata,
            "sections": self.sections,
            "raw_content": self.content
        }

    def _extract_sections(self) -> List[Dict]:
        """Extract sections with headings and their content."""
        sections = []
        current_section = None

        lines = self.content.split('\n')

        for line in lines:
            # Check for heading
            heading_match = re.match(r'^(#{1,6})\s+(.+)$', line)

            if heading_match:
                # Save previous section if exists
                if current_section:
                    sections.append(current_section)

                # Start new section
                level = len(heading_match.group(1))
                title = heading_match.group(2).strip()

                current_section = {
                    "heading": title,
                    "level": level,
                    "content": [],
                    "rules": []
                }
            elif current_section is not None:
                # Add content to current section
                current_section["content"].append(line)

        # Add last section
        if current_section:
            sections.append(current_section)

        # Extract rules from each section
        for section in sections:
            section["rules"] = self._extract_rules(section["content"])

        return sections

    def _extract_rules(self, content_lines: List[str]) -> List[Dict]:
        """Extract rule statements from content lines."""
        rules = []

        # Join lines and look for patterns
        content = '\n'.join(content_lines)

        # Pattern 1: Bullet points with bold/italic emphasis
        bullet_pattern = r'^[\s]*[-*]\s+\*\*(.+?)\*\*(.*)$'

        # Pattern 2: Simple bullet points
        simple_bullet_pattern = r'^[\s]*[-*]\s+(.+)$'

        # Pattern 3: Numbered lists
        numbered_pattern = r'^[\s]*\d+\.\s+(.+)$'

        for line in content_lines:
            if not line.strip():
                continue

            # Check for bold bullet points (most common for rules)
            match = re.match(bullet_pattern, line, re.MULTILINE)
            if match:
                rule_text = match.group(1) + match.group(2)
                rules.append(self._analyze_rule(rule_text.strip()))
                continue

            # Check for simple bullet points
            match = re.match(simple_bullet_pattern, line, re.MULTILINE)
            if match:
                rule_text = match.group(1)
                rules.append(self._analyze_rule(rule_text.strip()))
                continue

            # Check for numbered lists
            match = re.match(numbered_pattern, line, re.MULTILINE)
            if match:
                rule_text = match.group(1)
                rules.append(self._analyze_rule(rule_text.strip()))
                continue

        return rules

    def _analyze_rule(self, rule_text: str) -> Dict:
        """Analyze a rule statement and extract metadata."""
        rule = {
            "text": rule_text,
            "type": "unknown",
            "priority": "medium",
            "testable": True,
            "commands": [],
            "keywords": []
        }

        # Extract commands in backticks
        commands = re.findall(r'`([^`]+)`', rule_text)
        rule["commands"] = commands

        # Determine rule type based on keywords
        text_lower = rule_text.lower()

        if any(word in text_lower for word in ["always", "must", "should", "run"]):
            if commands:
                rule["type"] = "command_requirement"
                rule["priority"] = "high"

        if any(word in text_lower for word in ["never", "don't", "do not", "avoid"]):
            if commands:
                rule["type"] = "command_prohibition"
                rule["priority"] = "high"
            else:
                rule["type"] = "behavior_prohibition"

        if any(word in text_lower for word in ["prefer", "use", "choose"]):
            rule["type"] = "preference"
            rule["priority"] = "medium"

        if any(word in text_lower for word in ["place", "organize", "structure"]):
            rule["type"] = "file_structure"
            rule["priority"] = "low"

        if any(word in text_lower for word in ["document", "comment", "jsdoc"]):
            rule["type"] = "documentation"
            rule["priority"] = "medium"

        if any(word in text_lower for word in ["format", "style", "convention"]):
            rule["type"] = "code_style"
            rule["priority"] = "low"

        # Extract keywords
        keywords = ["always", "never", "must", "should", "prefer", "use",
                   "avoid", "run", "execute", "create", "update"]
        rule["keywords"] = [kw for kw in keywords if kw in text_lower]

        return rule


def parse_agents_file(file_path: str) -> Dict:
    """Convenience function to parse an AGENTS.md or CLAUDE.md file."""
    parser = MarkdownParser(file_path)
    return parser.parse()
