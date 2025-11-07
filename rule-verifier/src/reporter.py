"""
Reporter - Generate test reports in multiple formats.
"""

import json
from pathlib import Path
from typing import Dict, List
from datetime import datetime
from colorama import Fore, Style, init
import textwrap

# Initialize colorama
init(autoreset=True)


class Reporter:
    """Generate test reports in multiple formats."""

    def __init__(self, config: Dict = None):
        self.config = config or {}
        self.output_dir = Path(config.get("reporting", {}).get("output_dir", "./results")) if config else Path("./results")
        self.formats = config.get("reporting", {}).get("formats", ["console", "json"]) if config else ["console", "json"]
        self.verbose = config.get("reporting", {}).get("verbose", True) if config else True

        # Ensure output directory exists
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_report(self, validations: List[Dict], execution_data: Dict) -> Dict:
        """
        Generate reports in all configured formats.

        Args:
            validations: List of validation results
            execution_data: Execution metadata

        Returns:
            Dictionary with paths to generated reports
        """
        generated_reports = {}

        # Prepare summary data
        summary = self._generate_summary(validations, execution_data)

        # Generate reports in each format
        if "console" in self.formats:
            self._print_console_report(summary, validations)
            generated_reports["console"] = "printed"

        if "json" in self.formats:
            json_path = self._generate_json_report(summary, validations, execution_data)
            generated_reports["json"] = str(json_path)

        if "markdown" in self.formats:
            md_path = self._generate_markdown_report(summary, validations, execution_data)
            generated_reports["markdown"] = str(md_path)

        if "html" in self.formats:
            html_path = self._generate_html_report(summary, validations, execution_data)
            generated_reports["html"] = str(html_path)

        return generated_reports

    def _generate_summary(self, validations: List[Dict], execution_data: Dict) -> Dict:
        """Generate summary statistics."""
        total = len(validations)
        passed = sum(1 for v in validations if v["validation"]["passed"])
        failed = total - passed

        # Group by scenario
        by_scenario = {}
        for v in validations:
            scenario_id = v["result"]["scenario_id"]
            if scenario_id not in by_scenario:
                by_scenario[scenario_id] = []
            by_scenario[scenario_id].append(v)

        # Calculate consistency
        consistent_scenarios = 0
        inconsistent_scenarios = 0

        for scenario_id, scenario_vals in by_scenario.items():
            scenario_passed = sum(1 for v in scenario_vals if v["validation"]["passed"])
            consistency_rate = scenario_passed / len(scenario_vals)

            if consistency_rate >= 0.8:
                consistent_scenarios += 1
            else:
                inconsistent_scenarios += 1

        # Group by rule
        by_rule = {}
        for v in validations:
            rule_id = v["scenario"].get("rule_id", "unknown")
            if rule_id not in by_rule:
                by_rule[rule_id] = []
            by_rule[rule_id].append(v)

        return {
            "total_tests": total,
            "passed": passed,
            "failed": failed,
            "pass_rate": passed / total if total > 0 else 0,
            "total_scenarios": len(by_scenario),
            "consistent_scenarios": consistent_scenarios,
            "inconsistent_scenarios": inconsistent_scenarios,
            "total_rules": len(by_rule),
            "by_scenario": by_scenario,
            "by_rule": by_rule,
            "execution_data": execution_data
        }

    def _print_console_report(self, summary: Dict, validations: List[Dict]):
        """Print report to console."""
        print("\n" + "=" * 80)
        print(f"{Fore.CYAN}{'RULE VERIFIER TEST REPORT':^80}{Style.RESET_ALL}")
        print("=" * 80 + "\n")

        # Overall summary
        total = summary["total_tests"]
        passed = summary["passed"]
        failed = summary["failed"]
        pass_rate = summary["pass_rate"] * 100

        print(f"{Fore.YELLOW}OVERALL RESULTS{Style.RESET_ALL}")
        print(f"  Total Tests:     {total}")
        print(f"  Passed:          {Fore.GREEN}{passed}{Style.RESET_ALL}")
        print(f"  Failed:          {Fore.RED}{failed}{Style.RESET_ALL}")
        print(f"  Pass Rate:       {self._colored_pass_rate(pass_rate)}")
        print()

        # Scenario summary
        print(f"{Fore.YELLOW}SCENARIO CONSISTENCY{Style.RESET_ALL}")
        print(f"  Total Scenarios:       {summary['total_scenarios']}")
        print(f"  Consistent (≥80%):     {Fore.GREEN}{summary['consistent_scenarios']}{Style.RESET_ALL}")
        print(f"  Inconsistent (<80%):   {Fore.RED}{summary['inconsistent_scenarios']}{Style.RESET_ALL}")
        print()

        # Rule-by-rule breakdown
        print(f"{Fore.YELLOW}RULE BREAKDOWN{Style.RESET_ALL}")
        print()

        for rule_id, rule_validations in summary["by_rule"].items():
            rule_passed = sum(1 for v in rule_validations if v["validation"]["passed"])
            rule_total = len(rule_validations)
            rule_pass_rate = (rule_passed / rule_total * 100) if rule_total > 0 else 0

            status_icon = "✓" if rule_pass_rate >= 80 else "✗"
            status_color = Fore.GREEN if rule_pass_rate >= 80 else Fore.RED

            print(f"  {status_color}{status_icon} {rule_id}{Style.RESET_ALL}")

            # Get rule description from first validation
            if rule_validations:
                rule_desc = rule_validations[0]["scenario"]["rule"]["description"]
                wrapped_desc = textwrap.fill(rule_desc, width=70, initial_indent="    ", subsequent_indent="    ")
                print(f"{Fore.LIGHTBLACK_EX}{wrapped_desc}{Style.RESET_ALL}")

            print(f"    Pass Rate: {self._colored_pass_rate(rule_pass_rate)} ({rule_passed}/{rule_total})")
            print()

        # Execution info
        exec_data = summary["execution_data"]
        duration = exec_data.get("total_duration", 0)
        print(f"{Fore.YELLOW}EXECUTION INFO{Style.RESET_ALL}")
        print(f"  Duration:        {duration:.2f} seconds")
        print(f"  Scenarios:       {exec_data.get('total_scenarios', 0)}")
        print(f"  Iterations:      {exec_data.get('iterations', 0)}")
        print()

        print("=" * 80 + "\n")

    def _colored_pass_rate(self, pass_rate: float) -> str:
        """Return colored pass rate string."""
        if pass_rate >= 80:
            color = Fore.GREEN
        elif pass_rate >= 60:
            color = Fore.YELLOW
        else:
            color = Fore.RED

        return f"{color}{pass_rate:.1f}%{Style.RESET_ALL}"

    def _generate_json_report(self, summary: Dict, validations: List[Dict], execution_data: Dict) -> Path:
        """Generate JSON report."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = self.output_dir / f"report_{timestamp}.json"

        # Convert data to JSON-serializable format
        report_data = {
            "timestamp": datetime.now().isoformat(),
            "summary": {
                "total_tests": summary["total_tests"],
                "passed": summary["passed"],
                "failed": summary["failed"],
                "pass_rate": summary["pass_rate"],
                "total_scenarios": summary["total_scenarios"],
                "consistent_scenarios": summary["consistent_scenarios"],
                "inconsistent_scenarios": summary["inconsistent_scenarios"],
                "total_rules": summary["total_rules"]
            },
            "execution_data": execution_data,
            "validations": []
        }

        # Add detailed validation results
        for v in validations:
            report_data["validations"].append({
                "scenario_id": v["result"]["scenario_id"],
                "rule_id": v["scenario"]["rule_id"],
                "iteration": v["result"]["iteration"],
                "passed": v["validation"]["passed"],
                "confidence": v["validation"].get("confidence", 1.0),
                "checks": v["validation"]["checks"],
                "duration": v["result"]["duration"],
                "error": v["result"].get("error")
            })

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, indent=2)

        print(f"JSON report saved to: {output_path}")
        return output_path

    def _generate_markdown_report(self, summary: Dict, validations: List[Dict], execution_data: Dict) -> Path:
        """Generate Markdown report."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = self.output_dir / f"report_{timestamp}.md"

        md_content = []

        # Header
        md_content.append("# Rule Verifier Test Report\n")
        md_content.append(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        md_content.append("---\n")

        # Overall Summary
        md_content.append("## Overall Results\n")
        md_content.append(f"- **Total Tests:** {summary['total_tests']}")
        md_content.append(f"- **Passed:** {summary['passed']}")
        md_content.append(f"- **Failed:** {summary['failed']}")
        md_content.append(f"- **Pass Rate:** {summary['pass_rate']*100:.1f}%\n")

        # Scenario Summary
        md_content.append("## Scenario Consistency\n")
        md_content.append(f"- **Total Scenarios:** {summary['total_scenarios']}")
        md_content.append(f"- **Consistent (≥80%):** {summary['consistent_scenarios']}")
        md_content.append(f"- **Inconsistent (<80%):** {summary['inconsistent_scenarios']}\n")

        # Rule Breakdown
        md_content.append("## Rule Breakdown\n")

        for rule_id, rule_validations in summary["by_rule"].items():
            rule_passed = sum(1 for v in rule_validations if v["validation"]["passed"])
            rule_total = len(rule_validations)
            rule_pass_rate = (rule_passed / rule_total * 100) if rule_total > 0 else 0

            status = "✅" if rule_pass_rate >= 80 else "❌"

            md_content.append(f"### {status} {rule_id}\n")

            if rule_validations:
                rule_desc = rule_validations[0]["scenario"]["rule"]["description"]
                md_content.append(f"**Description:** {rule_desc}\n")

            md_content.append(f"**Pass Rate:** {rule_pass_rate:.1f}% ({rule_passed}/{rule_total})\n")

        # Execution Info
        md_content.append("## Execution Information\n")
        duration = execution_data.get("total_duration", 0)
        md_content.append(f"- **Duration:** {duration:.2f} seconds")
        md_content.append(f"- **Scenarios:** {execution_data.get('total_scenarios', 0)}")
        md_content.append(f"- **Iterations per Scenario:** {execution_data.get('iterations', 0)}\n")

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(md_content))

        print(f"Markdown report saved to: {output_path}")
        return output_path

    def _generate_html_report(self, summary: Dict, validations: List[Dict], execution_data: Dict) -> Path:
        """Generate HTML report."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = self.output_dir / f"report_{timestamp}.html"

        pass_rate = summary['pass_rate'] * 100
        pass_rate_color = "#28a745" if pass_rate >= 80 else "#ffc107" if pass_rate >= 60 else "#dc3545"

        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rule Verifier Test Report</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        h1 {{
            color: #333;
            border-bottom: 3px solid #007bff;
            padding-bottom: 10px;
        }}
        h2 {{
            color: #555;
            margin-top: 30px;
        }}
        .summary-cards {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }}
        .card {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }}
        .card.success {{ background: linear-gradient(135deg, #28a745 0%, #20c997 100%); }}
        .card.danger {{ background: linear-gradient(135deg, #dc3545 0%, #fd7e14 100%); }}
        .card.info {{ background: linear-gradient(135deg, #17a2b8 0%, #007bff 100%); }}
        .card h3 {{
            margin: 0;
            font-size: 2em;
        }}
        .card p {{
            margin: 5px 0 0 0;
            opacity: 0.9;
        }}
        .rule-item {{
            background: #f8f9fa;
            border-left: 4px solid #007bff;
            padding: 15px;
            margin: 10px 0;
            border-radius: 4px;
        }}
        .rule-item.passed {{
            border-left-color: #28a745;
        }}
        .rule-item.failed {{
            border-left-color: #dc3545;
        }}
        .rule-description {{
            color: #666;
            font-size: 0.9em;
            margin: 5px 0;
        }}
        .pass-rate {{
            font-weight: bold;
            font-size: 1.1em;
        }}
        .timestamp {{
            color: #999;
            font-size: 0.9em;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>Rule Verifier Test Report</h1>
        <p class="timestamp">Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>

        <h2>Overall Results</h2>
        <div class="summary-cards">
            <div class="card info">
                <h3>{summary['total_tests']}</h3>
                <p>Total Tests</p>
            </div>
            <div class="card success">
                <h3>{summary['passed']}</h3>
                <p>Passed</p>
            </div>
            <div class="card danger">
                <h3>{summary['failed']}</h3>
                <p>Failed</p>
            </div>
            <div class="card" style="background: linear-gradient(135deg, {pass_rate_color} 0%, {pass_rate_color} 100%);">
                <h3>{pass_rate:.1f}%</h3>
                <p>Pass Rate</p>
            </div>
        </div>

        <h2>Scenario Consistency</h2>
        <div class="summary-cards">
            <div class="card info">
                <h3>{summary['total_scenarios']}</h3>
                <p>Total Scenarios</p>
            </div>
            <div class="card success">
                <h3>{summary['consistent_scenarios']}</h3>
                <p>Consistent (≥80%)</p>
            </div>
            <div class="card danger">
                <h3>{summary['inconsistent_scenarios']}</h3>
                <p>Inconsistent (&lt;80%)</p>
            </div>
        </div>

        <h2>Rule Breakdown</h2>
        <div class="rules-list">
"""

        # Add rule items
        for rule_id, rule_validations in summary["by_rule"].items():
            rule_passed = sum(1 for v in rule_validations if v["validation"]["passed"])
            rule_total = len(rule_validations)
            rule_pass_rate = (rule_passed / rule_total * 100) if rule_total > 0 else 0

            status_class = "passed" if rule_pass_rate >= 80 else "failed"
            status_icon = "✅" if rule_pass_rate >= 80 else "❌"

            rule_desc = rule_validations[0]["scenario"]["rule"]["description"] if rule_validations else ""

            html_content += f"""
            <div class="rule-item {status_class}">
                <div><strong>{status_icon} {rule_id}</strong></div>
                <div class="rule-description">{rule_desc}</div>
                <div class="pass-rate">Pass Rate: {rule_pass_rate:.1f}% ({rule_passed}/{rule_total})</div>
            </div>
"""

        html_content += """
        </div>

        <h2>Execution Information</h2>
        <ul>
"""
        duration = execution_data.get("total_duration", 0)
        html_content += f"""
            <li><strong>Duration:</strong> {duration:.2f} seconds</li>
            <li><strong>Scenarios:</strong> {execution_data.get('total_scenarios', 0)}</li>
            <li><strong>Iterations per Scenario:</strong> {execution_data.get('iterations', 0)}</li>
        </ul>
    </div>
</body>
</html>
"""

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html_content)

        print(f"HTML report saved to: {output_path}")
        return output_path
