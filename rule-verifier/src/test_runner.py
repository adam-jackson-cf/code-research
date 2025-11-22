"""
Test Runner - Execute test scenarios using Claude CLI.
"""

import subprocess
import time
from typing import Dict, List, Optional
from pathlib import Path


class TestRunner:
    """Execute test scenarios using Claude CLI."""

    def __init__(self, config: Dict, session_manager=None):
        self.config = config
        self.session_manager = session_manager
        self.claude_cli = config.get("claude", {}).get("cli_path", "claude")
        self.timeout = config.get("test", {}).get("timeout", 60)
        self.model = config.get("claude", {}).get("model", "sonnet")

    def run_scenario(self, scenario: Dict, iteration: int = 0) -> Dict:
        """
        Run a single test scenario.

        Args:
            scenario: Scenario dictionary
            iteration: Iteration number (for tracking multiple runs)

        Returns:
            Test result dictionary
        """
        scenario_id = scenario.get("scenario_id", "unknown")
        prompt = scenario.get("prompt", "")

        start_time = time.time()

        try:
            # Execute Claude CLI in print mode
            result = self._execute_claude(prompt)

            end_time = time.time()
            duration = end_time - start_time

            return {
                "scenario_id": scenario_id,
                "iteration": iteration,
                "success": True,
                "response": result.get("response", ""),
                "error": None,
                "duration": duration,
                "timestamp": start_time,
            }

        except subprocess.TimeoutExpired:
            end_time = time.time()
            return {
                "scenario_id": scenario_id,
                "iteration": iteration,
                "success": False,
                "response": "",
                "error": "Timeout",
                "duration": end_time - start_time,
                "timestamp": start_time,
            }

        except Exception as e:
            end_time = time.time()
            return {
                "scenario_id": scenario_id,
                "iteration": iteration,
                "success": False,
                "response": "",
                "error": str(e),
                "duration": end_time - start_time,
                "timestamp": start_time,
            }

    def run_batch(self, scenarios: List[Dict], iterations: int = 5) -> List[Dict]:
        """
        Run multiple scenarios with N iterations each.

        Args:
            scenarios: List of scenario dictionaries
            iterations: Number of times to run each scenario

        Returns:
            List of test results
        """
        results = []

        for scenario in scenarios:
            for i in range(iterations):
                print(
                    f"  Running scenario {scenario['scenario_id']} (iteration {i+1}/{iterations})"
                )
                result = self.run_scenario(scenario, iteration=i)
                results.append(result)

                # Small delay between iterations to avoid rate limiting
                if i < iterations - 1:
                    time.sleep(1)

        return results

    def _execute_claude(self, prompt: str) -> Dict:
        """
        Execute Claude CLI with the given prompt.

        Args:
            prompt: The prompt to send to Claude

        Returns:
            Dictionary with response and metadata
        """
        # Create a temporary file for the prompt if needed
        # Use print mode (-p flag) for non-interactive execution

        cmd = [self.claude_cli, "-p", prompt]  # Print mode

        # Execute the command
        process = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=self.timeout,
            cwd=None,  # Use current directory
        )

        if process.returncode != 0:
            raise RuntimeError(f"Claude CLI failed: {process.stderr}")

        # Parse the output
        response = process.stdout.strip()

        return {"response": response, "exit_code": process.returncode, "stderr": process.stderr}

    def run_with_isolation(self, scenario: Dict, agents_file: str, iteration: int = 0) -> Dict:
        """
        Run a scenario with full session isolation using tmux.

        Args:
            scenario: Scenario dictionary
            agents_file: Path to AGENTS.md/CLAUDE.md file
            iteration: Iteration number

        Returns:
            Test result dictionary
        """
        if not self.session_manager:
            raise ValueError("Session manager not provided")

        scenario_id = scenario.get("scenario_id", "unknown")
        session_id = f"{scenario_id}_iter{iteration}_{int(time.time())}"

        try:
            # Create isolated session
            session_info = self.session_manager.create_session(session_id, agents_file)
            session_dir = session_info["session_dir"]

            # Create a temporary script to run Claude
            script_path = Path(session_dir) / "run_test.sh"
            prompt = scenario.get("prompt", "")

            # Escape quotes in prompt
            prompt_escaped = prompt.replace('"', '\\"')

            script_content = f"""#!/bin/bash
cd {session_dir}
{self.claude_cli} -p "{prompt_escaped}"
"""

            script_path.write_text(script_content)
            script_path.chmod(0o755)

            # Run the script in the tmux session
            start_time = time.time()

            self.session_manager.execute_command(
                session_id, f"bash {script_path}", capture_output=False
            )

            # Wait for completion and capture output
            time.sleep(2)  # Give it time to execute

            output = self.session_manager.execute_command(session_id, "", capture_output=True)

            end_time = time.time()
            duration = end_time - start_time

            # Cleanup session
            self.session_manager.cleanup_session(session_id)

            return {
                "scenario_id": scenario_id,
                "iteration": iteration,
                "success": True,
                "response": output or "",
                "error": None,
                "duration": duration,
                "timestamp": start_time,
                "isolated": True,
            }

        except Exception as e:
            # Cleanup on error
            if self.session_manager.get_session_info(session_id):
                self.session_manager.cleanup_session(session_id)

            return {
                "scenario_id": scenario_id,
                "iteration": iteration,
                "success": False,
                "response": "",
                "error": str(e),
                "duration": 0,
                "timestamp": time.time(),
                "isolated": True,
            }


class TestExecutor:
    """High-level test execution orchestrator."""

    def __init__(self, config: Dict, session_manager=None):
        self.config = config
        self.session_manager = session_manager
        self.runner = TestRunner(config, session_manager)
        self.iterations = config.get("test", {}).get("iterations", 5)

    def execute_all(self, scenarios: List[Dict], agents_file: Optional[str] = None) -> Dict:
        """
        Execute all test scenarios.

        Args:
            scenarios: List of scenarios to execute
            agents_file: Optional path to AGENTS.md/CLAUDE.md file

        Returns:
            Dictionary with all results and metadata
        """
        print(f"\nExecuting {len(scenarios)} scenarios with {self.iterations} iterations each...")
        print(f"Total tests to run: {len(scenarios) * self.iterations}\n")

        all_results = []
        start_time = time.time()

        for i, scenario in enumerate(scenarios, 1):
            scenario_id = scenario.get("scenario_id", "unknown")
            rule_id = scenario.get("rule_id", "unknown")

            print(f"[{i}/{len(scenarios)}] Testing rule: {rule_id}")
            print(f"  Scenario: {scenario_id}")

            scenario_results = []

            for iteration in range(self.iterations):
                print(f"  Iteration {iteration + 1}/{self.iterations}...", end=" ")

                if agents_file and self.session_manager:
                    # Run with isolation
                    result = self.runner.run_with_isolation(scenario, agents_file, iteration)
                else:
                    # Run without isolation
                    result = self.runner.run_scenario(scenario, iteration)

                scenario_results.append(result)

                if result["success"]:
                    print("✓")
                else:
                    print(f"✗ ({result.get('error', 'Unknown error')})")

                # Small delay between iterations
                time.sleep(1)

            all_results.extend(scenario_results)
            print()

        end_time = time.time()
        total_duration = end_time - start_time

        return {
            "results": all_results,
            "total_tests": len(all_results),
            "total_scenarios": len(scenarios),
            "iterations": self.iterations,
            "total_duration": total_duration,
            "started_at": start_time,
            "completed_at": end_time,
        }
