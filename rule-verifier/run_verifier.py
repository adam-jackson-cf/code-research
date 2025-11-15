#!/usr/bin/env python3
"""
Rule Verifier - Test AGENTS.md/CLAUDE.md rule compliance

This tool verifies that rules specified in AGENTS.md or CLAUDE.md files
are being followed by Claude. It generates test scenarios, runs them
multiple times in isolated environments, and reports on compliance.
"""

import sys
import argparse
import yaml
from pathlib import Path
from colorama import Fore, Style

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from parser import parse_agents_file
from rule_extractor import RuleExtractor
from scenario_generator import ScenarioGenerator
from session_manager import SessionManager
from test_runner import TestExecutor
from validator import ResponseValidator, ConsistencyAnalyzer
from reporter import Reporter


def load_config(config_path: str) -> dict:
    """Load configuration from YAML file."""
    config_file = Path(config_path)

    if not config_file.exists():
        print(f"{Fore.YELLOW}Warning: Config file not found at {config_path}{Style.RESET_ALL}")
        print(f"{Fore.YELLOW}Using default configuration{Style.RESET_ALL}\n")
        return {}

    with open(config_file, 'r') as f:
        return yaml.safe_load(f)


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Verify AGENTS.md/CLAUDE.md rule compliance",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Test rules in AGENTS.md with default settings
  python run_verifier.py examples/example_AGENTS.md

  # Run with 10 iterations per scenario
  python run_verifier.py examples/example_AGENTS.md --iterations 10

  # Use custom config and output directory
  python run_verifier.py examples/example_AGENTS.md --config my_config.yaml --output ./my_results

  # Run without tmux isolation (faster, but less accurate)
  python run_verifier.py examples/example_AGENTS.md --no-isolation

  # Test only high-priority rules
  python run_verifier.py examples/example_AGENTS.md --priority high critical

  # Generate only JSON report
  python run_verifier.py examples/example_AGENTS.md --format json
        """
    )

    parser.add_argument(
        "file",
        help="Path to AGENTS.md or CLAUDE.md file"
    )

    parser.add_argument(
        "--config",
        default="config.yaml",
        help="Path to config file (default: config.yaml)"
    )

    parser.add_argument(
        "--iterations",
        type=int,
        help="Number of test iterations per scenario (overrides config)"
    )

    parser.add_argument(
        "--output",
        help="Output directory for reports (overrides config)"
    )

    parser.add_argument(
        "--format",
        nargs="+",
        choices=["console", "json", "html", "markdown"],
        help="Report formats to generate (overrides config)"
    )

    parser.add_argument(
        "--no-isolation",
        action="store_true",
        help="Run tests without tmux session isolation (faster but less accurate)"
    )

    parser.add_argument(
        "--priority",
        nargs="+",
        choices=["critical", "high", "medium", "low"],
        help="Test only rules with specified priority levels"
    )

    parser.add_argument(
        "--type",
        nargs="+",
        help="Test only specific rule types (e.g., command_requirement, preference)"
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse rules and generate scenarios without running tests"
    )

    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose output"
    )

    args = parser.parse_args()

    # Print header
    print("\n" + "=" * 80)
    print(f"{Fore.CYAN}{'RULE VERIFIER':^80}{Style.RESET_ALL}")
    print("=" * 80 + "\n")

    # Load configuration
    config = load_config(args.config)

    # Override config with command-line arguments
    if args.iterations:
        config.setdefault("test", {})["iterations"] = args.iterations

    if args.output:
        config.setdefault("reporting", {})["output_dir"] = args.output

    if args.format:
        config.setdefault("reporting", {})["formats"] = args.format

    if args.verbose:
        config.setdefault("reporting", {})["verbose"] = True

    # Check if file exists
    agents_file = Path(args.file)
    if not agents_file.exists():
        print(f"{Fore.RED}Error: File not found: {args.file}{Style.RESET_ALL}")
        sys.exit(1)

    print(f"{Fore.GREEN}✓{Style.RESET_ALL} Testing rules from: {agents_file}\n")

    # Step 1: Parse the file
    print(f"{Fore.YELLOW}[1/6] Parsing file...{Style.RESET_ALL}")
    try:
        parsed_data = parse_agents_file(str(agents_file))
        print(f"  Found {len(parsed_data['sections'])} sections")
    except Exception as e:
        print(f"{Fore.RED}Error parsing file: {e}{Style.RESET_ALL}")
        sys.exit(1)

    # Step 2: Extract rules
    print(f"\n{Fore.YELLOW}[2/6] Extracting rules...{Style.RESET_ALL}")
    try:
        extractor = RuleExtractor(parsed_data)
        rules = extractor.extract_rules()

        # Filter by priority if specified
        if args.priority:
            rules = extractor.filter_by_priority(args.priority)

        # Filter by type if specified
        if args.type:
            rules = extractor.filter_by_type(args.type)

        summary = extractor.get_summary()
        print(f"  Extracted {len(rules)} testable rules")
        print(f"  Types: {summary['by_type']}")
        print(f"  Priorities: {summary['by_priority']}")

        if not rules:
            print(f"{Fore.RED}No testable rules found!{Style.RESET_ALL}")
            sys.exit(1)

    except Exception as e:
        print(f"{Fore.RED}Error extracting rules: {e}{Style.RESET_ALL}")
        sys.exit(1)

    # Step 3: Generate scenarios
    print(f"\n{Fore.YELLOW}[3/6] Generating test scenarios...{Style.RESET_ALL}")
    try:
        generator = ScenarioGenerator(rules, config)
        scenarios = generator.generate_scenarios()

        scenario_summary = generator.get_summary()
        print(f"  Generated {len(scenarios)} test scenarios")
        print(f"  By type: {scenario_summary['by_type']}")

        if not scenarios:
            print(f"{Fore.RED}No test scenarios generated!{Style.RESET_ALL}")
            sys.exit(1)

    except Exception as e:
        print(f"{Fore.RED}Error generating scenarios: {e}{Style.RESET_ALL}")
        sys.exit(1)

    # Dry run: stop here
    if args.dry_run:
        print(f"\n{Fore.GREEN}Dry run complete!{Style.RESET_ALL}")
        print(f"\nScenarios generated (not executed):")
        for i, scenario in enumerate(scenarios, 1):
            print(f"  {i}. {scenario['scenario_id']}")
            print(f"     Prompt: {scenario['prompt'][:80]}...")
        sys.exit(0)

    # Step 4: Run tests
    print(f"\n{Fore.YELLOW}[4/6] Running tests...{Style.RESET_ALL}")

    session_manager = None
    if not args.no_isolation:
        session_manager = SessionManager(config)

    executor = TestExecutor(config, session_manager)

    try:
        execution_results = executor.execute_all(
            scenarios,
            agents_file=str(agents_file) if not args.no_isolation else None
        )

        print(f"\n{Fore.GREEN}✓{Style.RESET_ALL} Tests completed!")
        print(f"  Total tests: {execution_results['total_tests']}")
        print(f"  Duration: {execution_results['total_duration']:.2f} seconds")

    except Exception as e:
        print(f"{Fore.RED}Error running tests: {e}{Style.RESET_ALL}")
        if session_manager:
            session_manager.cleanup_all()
        sys.exit(1)
    finally:
        # Cleanup sessions
        if session_manager:
            cleaned = session_manager.cleanup_all()
            if cleaned > 0:
                print(f"  Cleaned up {cleaned} tmux sessions")

    # Step 5: Validate results
    print(f"\n{Fore.YELLOW}[5/6] Validating results...{Style.RESET_ALL}")
    try:
        validator = ResponseValidator(config)
        validations = validator.validate_batch(
            execution_results['results'],
            scenarios
        )

        # Analyze consistency
        analyzer = ConsistencyAnalyzer()
        consistency = analyzer.analyze_iterations(validations)

        passed_count = sum(1 for v in validations if v["validation"]["passed"])
        total_count = len(validations)

        print(f"  Validated {total_count} results")
        print(f"  Passed: {passed_count}/{total_count}")

    except Exception as e:
        print(f"{Fore.RED}Error validating results: {e}{Style.RESET_ALL}")
        sys.exit(1)

    # Step 6: Generate reports
    print(f"\n{Fore.YELLOW}[6/6] Generating reports...{Style.RESET_ALL}")
    try:
        reporter = Reporter(config)
        reports = reporter.generate_report(validations, execution_results)

        for format_name, path in reports.items():
            if format_name != "console":
                print(f"  {format_name}: {path}")

    except Exception as e:
        print(f"{Fore.RED}Error generating reports: {e}{Style.RESET_ALL}")
        sys.exit(1)

    # Final status
    pass_rate = passed_count / total_count * 100 if total_count > 0 else 0

    print()
    if pass_rate >= 80:
        print(f"{Fore.GREEN}✓ PASSED{Style.RESET_ALL} - Rule compliance: {pass_rate:.1f}%")
        sys.exit(0)
    else:
        print(f"{Fore.RED}✗ FAILED{Style.RESET_ALL} - Rule compliance: {pass_rate:.1f}%")
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n\n{Fore.YELLOW}Interrupted by user{Style.RESET_ALL}")
        sys.exit(130)
    except Exception as e:
        print(f"\n{Fore.RED}Unexpected error: {e}{Style.RESET_ALL}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
