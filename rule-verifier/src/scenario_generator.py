"""
Scenario Generator - Generate minimal test scenarios for each rule.
"""

import re
from typing import Dict, List
import hashlib


class ScenarioGenerator:
    """Generate minimal test scenarios for rules."""

    def __init__(self, rules: List[Dict], config: Dict = None):
        self.rules = rules
        self.config = config or {}
        self.scenarios: List[Dict] = []

    def generate_scenarios(self) -> List[Dict]:
        """Generate test scenarios for all rules."""
        self.scenarios = []

        for rule in self.rules:
            if not rule.get("testable", False):
                continue

            # Generate scenarios based on rule type
            rule_scenarios = self._generate_for_rule(rule)
            self.scenarios.extend(rule_scenarios)

        return self.scenarios

    def _generate_for_rule(self, rule: Dict) -> List[Dict]:
        """Generate scenarios for a specific rule."""
        rule_type = rule.get("type", "unknown")
        test_type = rule.get("test_type", "general_check")

        scenarios = []

        # Generate based on test type
        if test_type == "command_check":
            scenarios.extend(self._generate_command_scenarios(rule))
        elif test_type == "preference_check":
            scenarios.extend(self._generate_preference_scenarios(rule))
        elif test_type == "workflow_check":
            scenarios.extend(self._generate_workflow_scenarios(rule))
        else:
            scenarios.extend(self._generate_general_scenarios(rule))

        return scenarios

    def _generate_command_scenarios(self, rule: Dict) -> List[Dict]:
        """Generate scenarios for command-related rules."""
        scenarios = []
        rule_type = rule.get("type")
        commands = rule.get("commands", [])

        if rule_type == "command_requirement":
            # Test if agent recommends the required command
            for command in commands:
                scenario = {
                    "scenario_id": self._generate_scenario_id(rule, "cmd_req"),
                    "rule_id": rule["rule_id"],
                    "type": "positive",
                    "test_type": "command_requirement",
                    "prompt": self._create_command_request_prompt(command, rule),
                    "expected_behavior": {
                        "should_contain": [command],
                        "should_not_contain": []
                    },
                    "rule": rule
                }
                scenarios.append(scenario)

        elif rule_type == "command_prohibition":
            # Test if agent avoids the prohibited command
            for command in commands:
                scenario = {
                    "scenario_id": self._generate_scenario_id(rule, "cmd_prohib"),
                    "rule_id": rule["rule_id"],
                    "type": "negative",
                    "test_type": "command_prohibition",
                    "prompt": self._create_command_prohibition_prompt(command, rule),
                    "expected_behavior": {
                        "should_contain": [],
                        "should_not_contain": [command]
                    },
                    "rule": rule
                }
                scenarios.append(scenario)

        return scenarios

    def _generate_preference_scenarios(self, rule: Dict) -> List[Dict]:
        """Generate scenarios for preference rules."""
        scenarios = []
        commands = rule.get("commands", [])

        if commands:
            # Test if agent prefers the recommended tool
            scenario = {
                "scenario_id": self._generate_scenario_id(rule, "pref"),
                "rule_id": rule["rule_id"],
                "type": "preference",
                "test_type": "preference_check",
                "prompt": self._create_preference_prompt(rule),
                "expected_behavior": {
                    "should_contain": commands,
                    "should_not_contain": []
                },
                "rule": rule
            }
            scenarios.append(scenario)

        return scenarios

    def _generate_workflow_scenarios(self, rule: Dict) -> List[Dict]:
        """Generate scenarios for workflow rules."""
        scenarios = []

        scenario = {
            "scenario_id": self._generate_scenario_id(rule, "workflow"),
            "rule_id": rule["rule_id"],
            "type": "workflow",
            "test_type": "workflow_check",
            "prompt": self._create_workflow_prompt(rule),
            "expected_behavior": rule.get("expected_behavior", {}),
            "rule": rule
        }
        scenarios.append(scenario)

        return scenarios

    def _generate_general_scenarios(self, rule: Dict) -> List[Dict]:
        """Generate generic scenarios for other rules."""
        scenarios = []

        scenario = {
            "scenario_id": self._generate_scenario_id(rule, "general"),
            "rule_id": rule["rule_id"],
            "type": "general",
            "test_type": "general_check",
            "prompt": self._create_general_prompt(rule),
            "expected_behavior": rule.get("expected_behavior", {}),
            "rule": rule
        }
        scenarios.append(scenario)

        return scenarios

    def _create_command_request_prompt(self, command: str, rule: Dict) -> str:
        """Create a prompt that should trigger the required command."""
        section = rule.get("section", "").lower()

        # Contextual prompts based on common commands
        if "dev" in command or "start" in command:
            return "I need to start the development server for this project. What command should I run?"

        if "test" in command:
            return "I want to run the test suite. What's the command to execute tests?"

        if "build" in command:
            return "I need to build the project for production. What command should I use?"

        if "lint" in command:
            return "I want to check the code style and quality. What command should I run?"

        if "install" in command:
            return "I need to install dependencies for this project. What command should I use?"

        if "commit" in command or "push" in command:
            return "I've made changes and want to save them to git. What should I do?"

        # Generic fallback
        return f"What is the recommended way to {self._extract_action(rule['description'])}?"

    def _create_command_prohibition_prompt(self, command: str, rule: Dict) -> str:
        """Create a prompt that might trigger a prohibited command."""
        # Extract the context where the command should NOT be used
        description = rule.get("description", "").lower()

        if "never" in description or "don't" in description:
            # Create a scenario where someone might mistakenly use it
            if "build" in command:
                return "I'm working on the project interactively. Should I run a build command?"

            if "install" in command and "npm" in command:
                # If there's a prohibition on npm, test it
                return "I need to add a new package. What's the best way to do that?"

        # Generic fallback
        action = self._extract_action(rule['description'])
        return f"I want to {action}. What command should I use?"

    def _create_preference_prompt(self, rule: Dict) -> str:
        """Create a prompt to test preferences."""
        description = rule.get("description", "")
        commands = rule.get("commands", [])

        # Extract what the preference is about
        if "package manager" in description.lower() or any(pm in str(commands) for pm in ["npm", "yarn", "pnpm"]):
            return "I need to install a new package. Which package manager should I use?"

        if "typescript" in description.lower() or ".tsx" in description or ".ts" in description:
            return "I'm creating a new component. Should I use JavaScript or TypeScript?"

        if "quote" in description.lower():
            return "What style conventions should I follow for strings in JavaScript?"

        # Generic preference
        return f"What is the recommended approach for: {description[:100]}?"

    def _create_workflow_prompt(self, rule: Dict) -> str:
        """Create a prompt for workflow rules."""
        description = rule.get("description", "")

        # Generic workflow prompt
        return f"I need to {self._extract_action(description)}. What steps should I follow?"

    def _create_general_prompt(self, rule: Dict) -> str:
        """Create a general prompt for the rule."""
        description = rule.get("description", "")

        return f"What should I know about: {description[:150]}?"

    def _extract_action(self, description: str) -> str:
        """Extract the action verb from a rule description."""
        # Look for common action verbs
        actions = ["run", "use", "create", "update", "install", "test", "build", "commit", "push"]

        description_lower = description.lower()

        for action in actions:
            if action in description_lower:
                # Try to extract context around the action
                match = re.search(rf"{action}\s+([^,\.]+)", description_lower)
                if match:
                    return match.group(0).strip()

        # Fallback: use first few words
        words = description.split()[:5]
        return " ".join(words).lower()

    def _generate_scenario_id(self, rule: Dict, scenario_type: str) -> str:
        """Generate a unique scenario ID."""
        rule_id = rule.get("rule_id", "unknown")
        content = f"{rule_id}:{scenario_type}"
        hash_obj = hashlib.md5(content.encode())
        short_hash = hash_obj.hexdigest()[:6]

        return f"{rule_id}_{scenario_type}_{short_hash}"

    def get_scenarios_for_rule(self, rule_id: str) -> List[Dict]:
        """Get all scenarios for a specific rule."""
        return [s for s in self.scenarios if s["rule_id"] == rule_id]

    def get_summary(self) -> Dict:
        """Get summary of generated scenarios."""
        total = len(self.scenarios)

        by_type = {}
        by_test_type = {}

        for scenario in self.scenarios:
            # Count by type
            scenario_type = scenario.get("type", "unknown")
            by_type[scenario_type] = by_type.get(scenario_type, 0) + 1

            # Count by test type
            test_type = scenario.get("test_type", "unknown")
            by_test_type[test_type] = by_test_type.get(test_type, 0) + 1

        return {
            "total_scenarios": total,
            "by_type": by_type,
            "by_test_type": by_test_type
        }
