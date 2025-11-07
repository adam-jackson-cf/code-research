"""
Validator - Validate Claude's responses against expected behavior.
"""

import re
from typing import Dict, List, Optional
from difflib import SequenceMatcher


class ResponseValidator:
    """Validate Claude responses against rule expectations."""

    def __init__(self, config: Dict = None):
        self.config = config or {}
        self.strict_mode = config.get("validation", {}).get("strict_mode", False) if config else False
        self.case_sensitive = config.get("validation", {}).get("case_sensitive", False) if config else False
        self.min_confidence = config.get("validation", {}).get("min_confidence", 0.7) if config else 0.7

    def validate_result(self, result: Dict, scenario: Dict) -> Dict:
        """
        Validate a test result against scenario expectations.

        Args:
            result: Test result from TestRunner
            scenario: Original scenario with expected behavior

        Returns:
            Validation result dictionary
        """
        if not result.get("success"):
            return {
                "passed": False,
                "reason": "Test execution failed",
                "error": result.get("error"),
                "checks": []
            }

        response = result.get("response", "")
        expected = scenario.get("expected_behavior", {})

        checks = []

        # Check should_contain
        for item in expected.get("should_contain", []):
            check_result = self._check_contains(response, item)
            checks.append({
                "type": "should_contain",
                "target": item,
                "passed": check_result["found"],
                "confidence": check_result.get("confidence", 1.0),
                "details": check_result.get("details", "")
            })

        # Check should_not_contain
        for item in expected.get("should_not_contain", []):
            check_result = self._check_not_contains(response, item)
            checks.append({
                "type": "should_not_contain",
                "target": item,
                "passed": check_result["not_found"],
                "confidence": check_result.get("confidence", 1.0),
                "details": check_result.get("details", "")
            })

        # Check should_execute (commands mentioned/recommended)
        for cmd in expected.get("should_execute", []):
            check_result = self._check_command_mentioned(response, cmd)
            checks.append({
                "type": "should_execute",
                "target": cmd,
                "passed": check_result["found"],
                "confidence": check_result.get("confidence", 1.0),
                "details": check_result.get("details", "")
            })

        # Check should_not_execute (commands not mentioned/discouraged)
        for cmd in expected.get("should_not_execute", []):
            check_result = self._check_command_not_mentioned(response, cmd)
            checks.append({
                "type": "should_not_execute",
                "target": cmd,
                "passed": check_result["not_found"],
                "confidence": check_result.get("confidence", 1.0),
                "details": check_result.get("details", "")
            })

        # Determine overall pass/fail
        all_passed = all(check["passed"] for check in checks)

        # Calculate average confidence
        confidences = [check["confidence"] for check in checks if "confidence" in check]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 1.0

        return {
            "passed": all_passed,
            "confidence": avg_confidence,
            "checks": checks,
            "checks_passed": sum(1 for c in checks if c["passed"]),
            "checks_failed": sum(1 for c in checks if not c["passed"]),
            "total_checks": len(checks)
        }

    def _check_contains(self, response: str, target: str) -> Dict:
        """Check if response contains the target string."""
        response_text = response if self.case_sensitive else response.lower()
        target_text = target if self.case_sensitive else target.lower()

        if self.strict_mode:
            # Exact match
            found = target_text in response_text
            return {
                "found": found,
                "confidence": 1.0 if found else 0.0,
                "details": "Exact match" if found else "Not found"
            }
        else:
            # Fuzzy match
            found = target_text in response_text

            if found:
                return {
                    "found": True,
                    "confidence": 1.0,
                    "details": "Exact match"
                }

            # Try fuzzy matching
            confidence = self._fuzzy_match(target_text, response_text)

            if confidence >= self.min_confidence:
                return {
                    "found": True,
                    "confidence": confidence,
                    "details": f"Fuzzy match (confidence: {confidence:.2f})"
                }

            return {
                "found": False,
                "confidence": confidence,
                "details": f"Not found (best match confidence: {confidence:.2f})"
            }

    def _check_not_contains(self, response: str, target: str) -> Dict:
        """Check if response does NOT contain the target string."""
        response_text = response if self.case_sensitive else response.lower()
        target_text = target if self.case_sensitive else target.lower()

        found = target_text in response_text

        if found:
            return {
                "not_found": False,
                "confidence": 0.0,
                "details": f"Found '{target}' but it should not be present"
            }

        return {
            "not_found": True,
            "confidence": 1.0,
            "details": "Correctly not present"
        }

    def _check_command_mentioned(self, response: str, command: str) -> Dict:
        """Check if a command is mentioned or recommended in the response."""
        # Look for the command in code blocks or inline code
        code_pattern = r'`([^`]+)`'
        code_blocks = re.findall(code_pattern, response)

        command_base = command.split()[0] if command else ""

        for code in code_blocks:
            if command in code or command_base in code:
                return {
                    "found": True,
                    "confidence": 1.0,
                    "details": f"Command found in code: `{code}`"
                }

        # Check in plain text
        response_lower = response.lower()
        command_lower = command.lower()

        if command_lower in response_lower:
            return {
                "found": True,
                "confidence": 0.9,
                "details": "Command mentioned in text"
            }

        # Try to find command components
        command_parts = command_lower.split()
        parts_found = sum(1 for part in command_parts if part in response_lower)

        if parts_found >= len(command_parts) * 0.7:
            confidence = parts_found / len(command_parts)
            return {
                "found": True,
                "confidence": confidence,
                "details": f"Command components found ({parts_found}/{len(command_parts)})"
            }

        return {
            "found": False,
            "confidence": 0.0,
            "details": "Command not mentioned"
        }

    def _check_command_not_mentioned(self, response: str, command: str) -> Dict:
        """Check if a command is NOT mentioned in the response."""
        result = self._check_command_mentioned(response, command)

        if result["found"]:
            return {
                "not_found": False,
                "confidence": 0.0,
                "details": f"Command should not be mentioned but was found: {result['details']}"
            }

        return {
            "not_found": True,
            "confidence": 1.0,
            "details": "Correctly not mentioned"
        }

    def _fuzzy_match(self, target: str, text: str) -> float:
        """
        Calculate fuzzy match confidence between target and text.

        Uses sliding window to find best match.
        """
        target_len = len(target)
        best_ratio = 0.0

        # Try to find best matching substring
        for i in range(len(text) - target_len + 1):
            substring = text[i:i + target_len]
            ratio = SequenceMatcher(None, target, substring).ratio()
            best_ratio = max(best_ratio, ratio)

        # Also try matching against whole text for short targets
        if target_len < 50:
            ratio = SequenceMatcher(None, target, text).ratio()
            best_ratio = max(best_ratio, ratio)

        return best_ratio

    def validate_batch(self, results: List[Dict], scenarios: List[Dict]) -> List[Dict]:
        """
        Validate a batch of test results.

        Args:
            results: List of test results
            scenarios: List of scenarios (matched by scenario_id)

        Returns:
            List of validation results
        """
        # Create scenario lookup
        scenario_map = {s["scenario_id"]: s for s in scenarios}

        validations = []

        for result in results:
            scenario_id = result.get("scenario_id")
            scenario = scenario_map.get(scenario_id)

            if not scenario:
                validations.append({
                    "result": result,
                    "validation": {
                        "passed": False,
                        "reason": "Scenario not found",
                        "checks": []
                    }
                })
                continue

            validation = self.validate_result(result, scenario)
            validations.append({
                "result": result,
                "scenario": scenario,
                "validation": validation
            })

        return validations


class ConsistencyAnalyzer:
    """Analyze consistency across multiple iterations."""

    def __init__(self):
        pass

    def analyze_iterations(self, validations: List[Dict]) -> Dict:
        """
        Analyze consistency across multiple iterations of the same scenario.

        Args:
            validations: List of validation results for the same scenario

        Returns:
            Consistency analysis
        """
        if not validations:
            return {"error": "No validations provided"}

        # Group by scenario_id
        by_scenario = {}

        for v in validations:
            scenario_id = v["result"]["scenario_id"]

            if scenario_id not in by_scenario:
                by_scenario[scenario_id] = []

            by_scenario[scenario_id].append(v)

        # Analyze each scenario
        consistency_results = {}

        for scenario_id, scenario_validations in by_scenario.items():
            passed_count = sum(1 for v in scenario_validations if v["validation"]["passed"])
            total_count = len(scenario_validations)
            consistency_rate = passed_count / total_count if total_count > 0 else 0

            consistency_results[scenario_id] = {
                "scenario_id": scenario_id,
                "total_iterations": total_count,
                "passed": passed_count,
                "failed": total_count - passed_count,
                "consistency_rate": consistency_rate,
                "is_consistent": consistency_rate >= 0.8,  # 80% threshold
                "iterations": scenario_validations
            }

        return consistency_results
