#!/usr/bin/env python3
"""
Root Cause Analysis Evaluator (CLI).

Runs the reactive root cause analysis workflow end-to-end and reports results.
This script is intended for direct execution and is placed in
shared/integration/cli outside pytest's test discovery path.
"""

import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Any

# Setup import paths and import utilities
try:
    import core.base.registry_bootstrap  # noqa: F401 - ensure registration
    from core.base import AnalyzerRegistry, create_analyzer_config
except ImportError as e:
    print(f"Import error: {e}", file=sys.stderr)
    sys.exit(1)


class RootCauseAnalysisIntegrationTest:
    """Test reactive root cause analysis workflow with various error scenarios."""

    def __init__(self):
        pass

        # Test scenarios with different error types
        self.test_scenarios = [
            {
                "name": "JavaScript TypeError",
                "error": "TypeError: Cannot read property 'name' of undefined at user.js:45",
                "expected_error_type": "TypeError",
                "expected_file": "user.js",
                "expected_line": 45,
                "expected_patterns": ["null_pointer"],
            },
            {
                "name": "Python AttributeError",
                "error": "File \"/app/models.py\", line 123, in get_user\n    AttributeError: 'NoneType' object has no attribute 'name'",
                "expected_error_type": "AttributeError",
                "expected_file": "/app/models.py",
                "expected_line": 123,
                "expected_patterns": ["null_pointer"],
            },
            {
                "name": "Generic Error with File",
                "error": "Database connection failed in database.py:67",
                "expected_error_type": "unknown",
                "expected_file": "database.py",
                "expected_line": 67,
                "expected_patterns": ["null_pointer", "poor_error_handling"],
            },
            {
                "name": "Security Error",
                "error": "SecurityError: Unauthorized access attempt at auth.ts:89",
                "expected_error_type": "SecurityError",
                "expected_file": "auth.ts",
                "expected_line": 89,
                "expected_patterns": ["injection_vulnerability", "auth_bypass"],
            },
        ]

    def test_analyzer_without_error_info(self) -> dict[str, Any]:
        """Without error context, analyzer should produce minimal/no findings but not crash."""
        with tempfile.TemporaryDirectory() as temp_dir:
            cfg = create_analyzer_config(target_path=temp_dir, output_format="json")
            analyzer = AnalyzerRegistry.create(
                "root_cause:error_patterns", config=cfg, error_info=""
            )
            result = analyzer.analyze(temp_dir).to_dict()
            return {
                "test": "error_patterns_without_error",
                "status": "PASS",
                "findings_count": len(result.get("findings", [])),
            }

    def test_error_parsing(
        self, analyzer_script: str, scenario: dict[str, Any]
    ) -> dict[str, Any]:
        """Test that analyzer correctly parses error information."""
        print(f"Testing {analyzer_script} error parsing for {scenario['name']}...")

        # Create a test file that matches the error scenario
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create a dummy file if the error references one
            if scenario["expected_file"]:
                file_name = Path(scenario["expected_file"]).name
                test_file = Path(temp_dir) / file_name
                test_file.write_text(
                    f"""
// Test file for {scenario['name']}
function testFunction() {{
    // Line {scenario.get('expected_line', 45)}
    console.log('test line');
    try {{
        // Some code that might fail
        var result = someObject.property;
    }} catch (error) {{
        console.error('Error occurred:', error);
    }}
}}
"""
                )

            # Run analyzer with error parameter via registry
            cfg = create_analyzer_config(target_path=temp_dir, output_format="json")
            analyzer = AnalyzerRegistry.create(
                "root_cause:error_patterns", config=cfg, error_info=scenario["error"]
            )
            result = analyzer.analyze(temp_dir).to_dict()

            # Verify result structure
            if "findings" not in result:
                return {
                    "test": f"{analyzer_script}_parse_{scenario['name'].replace(' ', '_')}",
                    "status": "FAIL",
                    "reason": "Missing 'findings' in result",
                    "result": result,
                }

            # Check if error context is included in findings
            has_error_context = False
            for finding in result["findings"]:
                if "metadata" in finding:
                    metadata = finding["metadata"]
                    if "investigated_error" in metadata:
                        has_error_context = True
                        investigated_error = metadata["investigated_error"]
                        if investigated_error != scenario["error"]:
                            return {
                                "test": f"{analyzer_script}_parse_{scenario['name'].replace(' ', '_')}",
                                "status": "FAIL",
                                "reason": f"Investigated error mismatch: {investigated_error} != {scenario['error']}",
                            }

                    if "error_context" in metadata:
                        error_context = metadata["error_context"]
                        # Verify error type parsing
                        if scenario["expected_error_type"] != "unknown" and (
                            error_context.get("error_type")
                            != scenario["expected_error_type"]
                        ):
                            return {
                                "test": f"{analyzer_script}_parse_{scenario['name'].replace(' ', '_')}",
                                "status": "FAIL",
                                "reason": f"Error type mismatch: {error_context.get('error_type')} != {scenario['expected_error_type']}",
                            }

            return {
                "test": f"{analyzer_script}_parse_{scenario['name'].replace(' ', '_')}",
                "status": "PASS",
                "message": "Correctly parsed error information",
                "findings_count": len(result["findings"]),
                "has_error_context": has_error_context,
            }

    def test_targeted_file_scanning(self, scenario: dict[str, Any]) -> dict[str, Any]:
        """Test that analyzers only scan files related to the error."""
        print(f"Testing targeted file scanning for {scenario['name']}...")

        with tempfile.TemporaryDirectory() as temp_dir:
            # Create multiple files, only one should be scanned
            target_file = (
                Path(scenario["expected_file"]).name
                if scenario["expected_file"]
                else "error.js"
            )
            unrelated_file = "unrelated.js"

            # Create target file with content
            (Path(temp_dir) / target_file).write_text(
                """
function problematicFunction() {
    var user = getUser();
    console.log(user.name); // Potential null pointer
}
"""
            )

            # Create unrelated file with content that would normally trigger patterns
            (Path(temp_dir) / unrelated_file).write_text(
                """
function otherFunction() {
    var params = request.params;  // Would normally trigger null_pointer pattern
    eval(userInput);  // Would normally trigger injection pattern
}
"""
            )

            cfg = create_analyzer_config(target_path=temp_dir, output_format="json")
            analyzer = AnalyzerRegistry.create(
                "root_cause:error_patterns", config=cfg, error_info=scenario["error"]
            )
            result = analyzer.analyze(temp_dir).to_dict()

            try:
                findings = result.get("findings", [])

                # Check that findings only relate to the target file
                unrelated_findings = []
                target_findings = []

                for finding in findings:
                    file_path = finding.get("file_path", "")
                    if unrelated_file in file_path:
                        unrelated_findings.append(finding)
                    elif (
                        target_file in file_path
                        or target_file == Path(scenario["expected_file"]).name
                    ):
                        target_findings.append(finding)

                if unrelated_findings:
                    return {
                        "test": f"targeted_scanning_{scenario['name'].replace(' ', '_')}",
                        "status": "FAIL",
                        "reason": f"Found {len(unrelated_findings)} findings in unrelated files",
                        "unrelated_findings": unrelated_findings,
                    }

                return {
                    "test": f"targeted_scanning_{scenario['name'].replace(' ', '_')}",
                    "status": "PASS",
                    "message": "Correctly focused on target file only",
                    "target_findings": len(target_findings),
                    "total_findings": len(findings),
                }

            except Exception as e:
                return {
                    "test": f"targeted_scanning_{scenario['name'].replace(' ', '_')}",
                    "status": "FAIL",
                    "reason": str(e),
                }

    def test_complete_workflow(self, scenario: dict[str, Any]) -> dict[str, Any]:
        """Test complete root cause analysis workflow with all three analyzers."""
        print(f"Testing complete workflow for {scenario['name']}...")

        with tempfile.TemporaryDirectory() as temp_dir:
            # Initialize git repo for recent_changes analyzer
            os.system(
                f"cd {temp_dir} && git init && git config user.email 'test@example.com' && git config user.name 'Test User'"
            )

            # Create test file
            if scenario["expected_file"]:
                file_name = Path(scenario["expected_file"]).name
                test_file = Path(temp_dir) / file_name
                test_file.write_text(
                    f"""
// Test file for error investigation
function errorProneFunction() {{
    try {{
        var user = getUser();
        return user.name; // Line around {scenario.get('expected_line', 45)}
    }} catch (error) {{
        console.error('Error:', error);
        throw error;
    }}
}}
"""
                )
                # Commit the file
                os.system(
                    f"cd {temp_dir} && git add . && git commit -m 'Initial commit with test file'"
                )

            workflow_results = {}

            mapping = {
                "Error Pattern Analysis": ("root_cause:error_patterns", {}),
                "Recent Changes Analysis": ("root_cause:recent_changes", {}),
                "Execution Trace Analysis": ("root_cause:trace_execution", {}),
            }
            for analyzer_name, (key, extra) in mapping.items():
                try:
                    cfg2 = create_analyzer_config(
                        target_path=temp_dir, output_format="json"
                    )
                    analyzer2 = AnalyzerRegistry.create(
                        key, config=cfg2, error_info=scenario["error"], **extra
                    )
                    result2 = analyzer2.analyze(temp_dir).to_dict()
                    workflow_results[analyzer_name] = {
                        "status": "PASS",
                        "findings_count": len(result2.get("findings", [])),
                        "execution_time": result2.get("execution_time", 0),
                    }
                except Exception as e:
                    workflow_results[analyzer_name] = {
                        "status": "FAIL",
                        "error": str(e),
                    }

            # Check if at least one analyzer produced findings
            total_findings = sum(
                r.get("findings_count", 0)
                for r in workflow_results.values()
                if r.get("status") == "PASS"
            )

            all_passed = all(
                r.get("status") == "PASS" for r in workflow_results.values()
            )

            return {
                "test": f"complete_workflow_{scenario['name'].replace(' ', '_')}",
                "status": "PASS" if all_passed else "FAIL",
                "message": f"Workflow completed with {total_findings} total findings",
                "analyzer_results": workflow_results,
                "total_findings": total_findings,
            }

    def run_all_tests(self) -> dict[str, Any]:
        """Run all integration tests for root cause analysis."""
        print("🚀 Root Cause Analysis Integration Tests")
        print("=" * 60)

        all_results = []

        # Test 1: Verify all analyzers require error input
        print("\n📋 Testing Error Input Requirements...")
        all_results.append(self.test_analyzer_without_error_info())

        # Test 2: Verify error parsing for different scenarios
        print("\n🔍 Testing Error Parsing...")
        for scenario in self.test_scenarios:
            result = self.test_error_parsing("error_patterns.py", scenario)
            all_results.append(result)

        # Test 3: Verify targeted file scanning
        print("\n🎯 Testing Targeted File Scanning...")
        for scenario in self.test_scenarios[:2]:  # Test subset for performance
            result = self.test_targeted_file_scanning(scenario)
            all_results.append(result)

        # Test 4: Test complete workflow
        print("\n🔄 Testing Complete Workflow...")
        for scenario in self.test_scenarios[:2]:  # Test subset for performance
            result = self.test_complete_workflow(scenario)
            all_results.append(result)

        # Generate summary
        passed = sum(1 for r in all_results if r.get("status") == "PASS")
        failed = sum(1 for r in all_results if r.get("status") == "FAIL")

        summary = {
            "total_tests": len(all_results),
            "passed": passed,
            "failed": failed,
            "success_rate": f"{(passed / len(all_results) * 100):.1f}%",
            "detailed_results": all_results,
        }

        return summary


def main():
    """Run integration test for root cause analysis."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Integration tests for reactive root cause analysis"
    )
    parser.add_argument(
        "--output-format",
        choices=["json", "console"],
        default="console",
        help="Output format",
    )
    parser.add_argument(
        "--verbose", action="store_true", help="Show detailed test output"
    )

    args = parser.parse_args()

    # Set testing environment flag
    os.environ["TESTING"] = "true"

    # Run tests
    tester = RootCauseAnalysisIntegrationTest()
    results = tester.run_all_tests()

    # Output results
    if args.output_format == "console":
        print("\n" + "=" * 60)
        print("🎯 ROOT CAUSE ANALYSIS INTEGRATION TEST RESULTS")
        print("=" * 60)
        print(f"Total Tests: {results['total_tests']}")
        print(f"Passed: {results['passed']} ✅")
        print(f"Failed: {results['failed']} ❌")
        print(f"Success Rate: {results['success_rate']}")

        if args.verbose or results["failed"] > 0:
            print("\nDetailed Results:")
            for result in results["detailed_results"]:
                status_emoji = "✅" if result["status"] == "PASS" else "❌"
                print(f"{status_emoji} {result['test']}: {result['status']}")
                if result["status"] == "FAIL":
                    print(f"   Reason: {result.get('reason', 'Unknown')}")
                elif args.verbose and "message" in result:
                    print(f"   {result['message']}")

        # Exit with appropriate code
        sys.exit(0 if results["failed"] == 0 else 1)

    else:  # json
        print(json.dumps(results, indent=2))
        sys.exit(0 if results["failed"] == 0 else 1)


if __name__ == "__main__":
    main()
