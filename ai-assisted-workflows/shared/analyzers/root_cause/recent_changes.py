#!/usr/bin/env python3
"""
Recent Changes Analyzer - Root Cause Analysis Through Git History.

PURPOSE: Analyzes recent code changes using git history to identify potential root causes.
Part of the shared/analyzers/root_cause suite using BaseAnalyzer infrastructure.

APPROACH:
- Git commit analysis for risky change patterns (hotfixes, rollbacks, temp fixes)
- File change frequency analysis to identify hotspots
- Commit timing pattern analysis (weekend/late night commits indicating emergencies)
- Authentication, database, API, and critical file change detection

EXTENDS: BaseAnalyzer for common analyzer infrastructure
- Inherits file scanning, CLI, configuration, and result formatting
- Implements git history analysis logic in analyze_target()
- Uses shared timing, logging, and error handling patterns
"""

import re
import subprocess
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

# Import base analyzer (package root must be on PYTHONPATH)
from core.base.analyzer_base import AnalyzerConfig, BaseAnalyzer
from core.base.analyzer_registry import register_analyzer


@register_analyzer("root_cause:recent_changes")
class RecentChangesAnalyzer(BaseAnalyzer):
    """Analyze recent code changes using git history to identify potential root causes."""

    def __init__(
        self,
        config: AnalyzerConfig | None = None,
        days_back: int = 30,
        max_commits: int = 100,
        error_info: str = "",
    ):
        # Create recent changes specific configuration
        # Git analysis doesn't use file extensions - we analyze repos directly
        changes_config = config or AnalyzerConfig(
            code_extensions={
                ".py",
                ".js",
                ".ts",
                ".java",
                ".go",
                ".rs",
            },  # Dummy extensions for BaseAnalyzer
            skip_patterns=set(),  # Don't skip anything for git analysis
        )

        # Store error information for targeted analysis
        self.error_info = error_info

        # Initialize base analyzer
        super().__init__("root_cause", changes_config)

        # Git analysis parameters
        self.days_back = days_back
        self.max_commits = max_commits

        # Initialize change pattern definitions
        self._init_change_patterns()

    def _init_change_patterns(self):
        """Initialize change pattern definitions."""
        self.change_patterns = {
            "auth_changes": {
                "patterns": [r"auth", r"login", r"session", r"token", r"permission"],
                "severity": "high",
                "description": "Authentication/authorization changes",
            },
            "database_changes": {
                "patterns": [r"database", r"query", r"sql", r"migration", r"schema"],
                "severity": "high",
                "description": "Database-related changes",
            },
            "api_changes": {
                "patterns": [r"api", r"endpoint", r"route", r"controller", r"handler"],
                "severity": "medium",
                "description": "API endpoint changes",
            },
            "config_changes": {
                "patterns": [
                    r"config",
                    r"settings",
                    r"environment",
                    r"\.env",
                    r"constants",
                ],
                "severity": "medium",
                "description": "Configuration changes",
            },
            "dependency_changes": {
                "patterns": [
                    r"package\.json",
                    r"requirements\.txt",
                    r"Gemfile",
                    r"pom\.xml",
                    r"Cargo\.toml",
                ],
                "severity": "medium",
                "description": "Dependency changes",
            },
            "critical_file_changes": {
                "patterns": [
                    r"main\.",
                    r"app\.",
                    r"index\.",
                    r"server\.",
                    r"__init__\.",
                ],
                "severity": "high",
                "description": "Critical application file changes",
            },
        }

    def get_analyzer_metadata(self) -> dict[str, Any]:
        """Return metadata about this analyzer."""
        return {
            "name": "Recent Changes Analyzer",
            "version": "2.0.0",
            "description": "Analyzes recent code changes using git history to identify potential root causes",
            "category": "root_cause",
            "priority": "high",
            "capabilities": [
                "Git commit risk pattern analysis (hotfixes, rollbacks, temp fixes)",
                "File change frequency analysis and hotspot detection",
                "Commit timing pattern analysis (emergency commits)",
                "Authentication and authorization change detection",
                "Database and schema change analysis",
                "API endpoint change tracking",
                "Configuration and dependency change detection",
                "Critical application file change monitoring",
                "Commit author and collaboration pattern analysis",
                "Change correlation and root cause identification",
            ],
            "supported_formats": ["git"],
            "pattern_categories": {
                "change_patterns": len(self.change_patterns),
                "analysis_period_days": self.days_back,
                "max_commits_analyzed": self.max_commits,
            },
        }

    def analyze_target(self, target_path: str) -> list[dict[str, Any]]:
        """
        Analyze git repository for recent changes related to a specific error.

        Args:
            target_path: Path to git repository to analyze

        Returns
        -------
            List of findings with standardized structure
        """
        # REQUIRED: Must have error information to investigate
        if not self.error_info:
            return [
                {
                    "title": "Error Information Required",
                    "description": "Root cause analysis requires an error message or issue to investigate. Please provide: error message, stack trace, or specific issue description.",
                    "severity": "critical",
                    "file_path": target_path,
                    "line_number": 0,
                    "recommendation": "Run with --error parameter: python recent_changes.py --error 'your error message here'",
                    "metadata": {
                        "error_type": "missing_error_context",
                        "confidence": "high",
                    },
                }
            ]

        all_findings = []
        repo_path = Path(target_path)

        # Parse the error to understand what files we should focus on
        error_context = self.parse_error(self.error_info)

        # Check if we're in a git repository
        if not (repo_path / ".git").exists() and not self._find_git_root(repo_path):
            all_findings.append(
                {
                    "title": "No Git Repository Found",
                    "description": "Not in a git repository - cannot analyze recent changes",
                    "severity": "low",
                    "file_path": str(repo_path),
                    "line_number": 0,
                    "recommendation": "Initialize git repository or run analysis from within a git repository",
                    "metadata": {"error_type": "no_git_repo", "confidence": "high"},
                }
            )
            return all_findings

        try:
            # Use git root for analysis
            git_root = self._find_git_root(repo_path) or repo_path

            # Analyze recent commits related to the error
            if error_context.get("file"):
                # Focus on commits that changed the error file
                commits = self.get_recent_commits_for_file(
                    git_root, error_context["file"]
                )
            else:
                # No specific file, analyze all recent commits
                commits = self.get_recent_commits(git_root)

            if not commits:
                all_findings.append(
                    {
                        "title": "No Recent Commits Found",
                        "description": f"No relevant commits found in the last {self.days_back} days for the error investigation",
                        "severity": "low",
                        "file_path": str(git_root),
                        "line_number": 0,
                        "recommendation": "Check git history or increase analysis period",
                        "metadata": {
                            "analysis_period": self.days_back,
                            "investigated_error": self.error_info,
                            "error_context": error_context,
                            "confidence": "medium",
                        },
                    }
                )
                return all_findings

            # Analyze commit risks
            risky_commits = self.analyze_change_risk(commits)
            for risk_commit in risky_commits:
                finding = self._create_risky_commit_finding(risk_commit)
                all_findings.append(finding)

            # Analyze timing patterns
            timing_issues = self.analyze_commit_timing_patterns(commits)
            for timing_issue in timing_issues:
                finding = self._create_timing_issue_finding(timing_issue)
                all_findings.append(finding)

            # Analyze changed files and hotspots
            changed_files = self.get_changed_files(git_root)
            hotspots = self.analyze_file_change_frequency(changed_files)
            for hotspot in hotspots:
                finding = self._create_hotspot_finding(hotspot)
                all_findings.append(finding)

        except Exception as e:
            all_findings.append(
                {
                    "title": "Git Analysis Error",
                    "description": f"Could not analyze git repository: {str(e)}",
                    "severity": "medium",
                    "file_path": str(repo_path),
                    "line_number": 0,
                    "recommendation": "Check git repository integrity and permissions",
                    "metadata": {
                        "error_type": "git_analysis_error",
                        "confidence": "high",
                    },
                }
            )

        return all_findings

    def analyze(self, target_path: str | None = None) -> Any:
        """
        Override analyze method to handle git repository analysis directly.

        Git analysis doesn't follow the typical file-by-file pattern,
        so we analyze the repository as a whole.
        """
        self.start_analysis()

        analyze_path = target_path or self.config.target_path
        result = self.create_result("git_analysis")

        try:
            # Analyze the git repository directly
            all_findings = self.analyze_target(analyze_path)

            # Convert findings to Finding objects
            self._add_findings_to_result(result, all_findings)

            # Add git-specific metadata
            result.metadata = {
                "analyzer_type": self.analyzer_type,
                "target_path": analyze_path,
                "total_findings": len(all_findings),
                "analysis_period_days": self.days_back,
                "max_commits_limit": self.max_commits,
                "severity_breakdown": self._calculate_severity_breakdown(all_findings),
                **self.get_analyzer_metadata(),
            }

        except Exception as e:
            result.set_error(f"Git analysis failed: {str(e)}")
            self.logger.error(f"Git analysis failed: {e}")

        return self.complete_analysis(result)

    def _find_git_root(self, path: Path) -> Path | None:
        """Find the git repository root directory."""
        current = path.resolve()
        while current != current.parent:
            if (current / ".git").exists():
                return current
            current = current.parent
        return None

    def _create_risky_commit_finding(
        self, risk_commit: dict[str, Any]
    ) -> dict[str, Any]:
        """Create a finding for a risky commit."""
        commit = risk_commit["commit"]
        risks = risk_commit["risks"]
        risk_level = risk_commit["risk_level"]

        return {
            "title": f"Risky Commit: {commit['hash'][:8]}",
            "description": f"Commit contains risk factors: {', '.join(risks)} - {commit['message'][:100]}",
            "severity": risk_level,
            "file_path": "git_history",
            "line_number": 0,
            "recommendation": self._get_risk_recommendation(risks),
            "metadata": {
                "commit_hash": commit["hash"],
                "author": commit["author"],
                "date": commit["date"],
                "message": commit["message"],
                "risk_factors": risks,
                "risk_level": risk_level,
                "confidence": "high",
            },
        }

    def _create_timing_issue_finding(
        self, timing_issue: dict[str, Any]
    ) -> dict[str, Any]:
        """Create a finding for a suspicious timing issue."""
        commit = timing_issue["commit"]
        concern = timing_issue["timing_concern"]
        risk_level = timing_issue["risk_level"]

        description = (
            f"Commit {commit['hash'][:8]} made during {concern.replace('_', ' ')}"
        )
        if "time_diff_minutes" in timing_issue:
            description += (
                f" ({timing_issue['time_diff_minutes']:.1f} minutes after previous)"
            )

        return {
            "title": "Suspicious Commit Timing",
            "description": description,
            "severity": risk_level,
            "file_path": "git_history",
            "line_number": 0,
            "recommendation": self._get_timing_recommendation(concern),
            "metadata": {
                "commit_hash": commit["hash"],
                "author": commit["author"],
                "date": commit["date"],
                "message": commit["message"],
                "timing_concern": concern,
                "risk_level": risk_level,
                "confidence": "medium",
                **{
                    k: v
                    for k, v in timing_issue.items()
                    if k not in ["commit", "timing_concern", "risk_level"]
                },
            },
        }

    def _create_hotspot_finding(self, hotspot: dict[str, Any]) -> dict[str, Any]:
        """Create a finding for a file change hotspot."""
        return {
            "title": "File Change Hotspot",
            "description": f"File {hotspot['file_path']} changed {hotspot['change_count']} times recently - potential instability",
            "severity": hotspot["risk_level"],
            "file_path": hotspot["file_path"],
            "line_number": 0,
            "recommendation": "Review file stability, consider refactoring or additional testing",
            "metadata": {
                "change_count": hotspot["change_count"],
                "change_types": hotspot["change_types"],
                "recent_commits": hotspot["recent_commits"],
                "confidence": "high",
            },
        }

    def _get_risk_recommendation(self, risks: list[str]) -> str:
        """Get recommendations for risky commits."""
        recommendations = {
            "hotfix": "Review the urgency and consider adding automated tests to prevent similar issues",
            "rollback": "Investigate root cause of the issue that required rollback",
            "temp_fix": "Ensure temporary fixes are properly tracked and replaced with permanent solutions",
            "major_change": "Ensure adequate testing and monitoring for major changes",
            "merge_conflict": "Review merge resolution for potential integration issues",
            "auth_changes": "Thoroughly test authentication flows and security implications",
            "database_changes": "Verify database migration safety and backup procedures",
            "api_changes": "Ensure API compatibility and update documentation",
            "config_changes": "Verify configuration changes across all environments",
            "dependency_changes": "Test for breaking changes and security vulnerabilities",
            "critical_file_changes": "Extra scrutiny needed for changes to critical application files",
        }

        primary_recommendations = [
            recommendations.get(risk, f"Review {risk} implications")
            for risk in risks[:3]
        ]
        return "; ".join(primary_recommendations)

    def _get_timing_recommendation(self, concern: str) -> str:
        """Get recommendations for timing concerns."""
        recommendations = {
            "weekend": "Weekend commits may indicate emergency fixes - review for proper testing and monitoring",
            "late_night": "Late night commits may indicate emergency fixes - ensure proper code review process",
            "rapid_consecutive": "Rapid consecutive commits may indicate incomplete initial fix - review change sequence",
        }
        return recommendations.get(
            concern, "Review commit timing context for emergency fix patterns"
        )

    def run_git_command(
        self, command: list[str], cwd: Path | None = None
    ) -> str | None:
        """Run a git command and return output."""
        import os

        try:
            result = subprocess.run(
                command,
                cwd=cwd or os.getcwd(),
                capture_output=True,
                text=True,
                timeout=30,
            )
            return result.stdout if result.returncode == 0 else None
        except (subprocess.TimeoutExpired, subprocess.SubprocessError):
            return None

    def get_recent_commits(self, repo_path: Path) -> list[dict[str, Any]]:
        """Get recent commits with details and file changes."""
        since_date = (datetime.now() - timedelta(days=self.days_back)).strftime(
            "%Y-%m-%d"
        )

        # Get commit log with details
        command = [
            "git",
            "log",
            "--oneline",
            "--since",
            since_date,
            "--pretty=format:%H|%an|%ad|%s",
            "--date=iso",
            f"--max-count={self.max_commits}",
        ]

        output = self.run_git_command(command, repo_path)
        if not output:
            return []

        commits = []
        for line in output.strip().split("\n"):
            if "|" in line:
                parts = line.split("|", 3)
                if len(parts) >= 4:
                    commit_data = {
                        "hash": parts[0],
                        "author": parts[1],
                        "date": parts[2],
                        "message": parts[3],
                        "files_changed": [],
                    }

                    # Get files changed in this commit
                    files_command = [
                        "git",
                        "show",
                        "--name-only",
                        "--pretty=format:",
                        parts[0],
                    ]
                    files_output = self.run_git_command(files_command, repo_path)
                    if files_output:
                        commit_data["files_changed"] = [
                            f.strip() for f in files_output.split("\n") if f.strip()
                        ]

                    commits.append(commit_data)

        return commits

    def get_file_blame_info(self, file_path: Path, repo_path: Path) -> dict[str, Any]:
        """Get git blame information for a file."""
        relative_path = file_path.relative_to(repo_path)

        command = ["git", "blame", "--line-porcelain", str(relative_path)]
        output = self.run_git_command(command, repo_path)

        if not output:
            return {}

        blame_info = {
            "recent_changes": [],
            "authors": defaultdict(int),
            "commit_dates": [],
        }

        current_commit = {}
        line_number = 0

        for line in output.split("\n"):
            if line.startswith("\t"):
                # This is the actual code line
                line_number += 1
                if current_commit:
                    current_commit["line_number"] = line_number
                    current_commit["code"] = line[1:]  # Remove tab

                    # Check if this is a recent change
                    if "author-time" in current_commit:
                        commit_date = datetime.fromtimestamp(
                            int(current_commit["author-time"])
                        )
                        if commit_date > datetime.now() - timedelta(
                            days=self.days_back
                        ):
                            blame_info["recent_changes"].append(current_commit.copy())
                        blame_info["commit_dates"].append(commit_date)

                    if "author" in current_commit:
                        blame_info["authors"][current_commit["author"]] += 1

                current_commit = {}
            elif " " in line:
                key, value = line.split(" ", 1)
                current_commit[key] = value

        return blame_info

    def analyze_change_risk(
        self, commits: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """Analyze commits for potential risk factors."""
        risk_findings = []

        for commit in commits:
            commit_risks = []
            message = commit["message"].lower()

            # Check for risky commit patterns
            risky_patterns = {
                "hotfix": r"\b(hotfix|urgent|emergency|critical)\b",
                "rollback": r"\b(rollback|revert|undo)\b",
                "temp_fix": r"\b(temp|temporary|quick|hack)\b",
                "major_change": r"\b(refactor|rewrite|major|breaking)\b",
                "merge_conflict": r"\b(merge|conflict|resolution)\b",
            }

            for risk_type, pattern in risky_patterns.items():
                if re.search(pattern, message):
                    commit_risks.append(risk_type)

            # Check for specific change categories
            for category, info in self.change_patterns.items():
                for pattern in info["patterns"]:
                    if re.search(pattern, message, re.IGNORECASE):
                        commit_risks.append(category)

            if commit_risks:
                risk_findings.append(
                    {
                        "commit": commit,
                        "risks": commit_risks,
                        "risk_level": self._calculate_risk_level(commit_risks),
                    }
                )

        return risk_findings

    def _calculate_risk_level(self, risks: list[str]) -> str:
        """Calculate overall risk level based on detected risks."""
        critical_risks = [
            "hotfix",
            "rollback",
            "temp_fix",
            "auth_changes",
            "database_changes",
        ]
        high_risks = ["major_change", "merge_conflict", "critical_file_changes"]

        if any(risk in critical_risks for risk in risks):
            return "critical"
        elif any(risk in high_risks for risk in risks):
            return "high"
        elif len(risks) > 2:
            return "medium"
        else:
            return "low"

    def get_changed_files(self, repo_path: Path) -> list[dict[str, Any]]:
        """Get files changed in recent commits."""
        since_date = (datetime.now() - timedelta(days=self.days_back)).strftime(
            "%Y-%m-%d"
        )

        command = [
            "git",
            "log",
            "--name-status",
            "--since",
            since_date,
            "--pretty=format:%H|%ad",
            "--date=iso",
        ]

        output = self.run_git_command(command, repo_path)
        if not output:
            return []

        changed_files = defaultdict(list)
        current_commit = None

        for line in output.split("\n"):
            if "|" in line and not line.startswith(("A\t", "M\t", "D\t", "R\t")):
                current_commit = line.split("|")[0]
            elif line.startswith(("A\t", "M\t", "D\t", "R\t")) and current_commit:
                parts = line.split("\t")
                if len(parts) >= 2:
                    change_type = parts[0]
                    file_path = parts[1]
                    changed_files[file_path].append(
                        {"commit": current_commit, "change_type": change_type}
                    )

        return dict(changed_files)

    def analyze_file_change_frequency(
        self, changed_files: dict[str, list[dict[str, Any]]]
    ) -> list[dict[str, Any]]:
        """Analyze files that change frequently (potential hotspots)."""
        hotspots = []

        for file_path, changes in changed_files.items():
            change_count = len(changes)

            # Files changed more than threshold might be hotspots
            if change_count >= 5:
                # Analyze change types
                change_types = [change["change_type"] for change in changes]

                hotspots.append(
                    {
                        "file_path": file_path,
                        "change_count": change_count,
                        "change_types": change_types,
                        "recent_commits": [change["commit"] for change in changes[:5]],
                        "risk_level": "high" if change_count >= 10 else "medium",
                    }
                )

        return hotspots

    def analyze_commit_timing_patterns(
        self, commits: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """Analyze commit timing to detect emergency patterns."""
        timing_issues = []

        for i, commit in enumerate(commits):
            try:
                commit_time = datetime.fromisoformat(
                    commit["date"].replace(" ", "T").split("+")[0]
                )

                # Check for late night/weekend commits (potential emergency fixes)
                is_weekend = commit_time.weekday() >= 5  # Saturday = 5, Sunday = 6
                is_late_night = commit_time.hour < 6 or commit_time.hour > 22

                if is_weekend or is_late_night:
                    timing_issues.append(
                        {
                            "commit": commit,
                            "timing_concern": "weekend" if is_weekend else "late_night",
                            "risk_level": "medium",
                        }
                    )

                # Check for rapid consecutive commits (potential hotfix sequence)
                if i > 0:
                    prev_commit_time = datetime.fromisoformat(
                        commits[i - 1]["date"].replace(" ", "T").split("+")[0]
                    )
                    time_diff = abs((commit_time - prev_commit_time).total_seconds())

                    # Commits within 10 minutes might indicate emergency hotfixes
                    if time_diff < 600 and commit["author"] == commits[i - 1]["author"]:
                        timing_issues.append(
                            {
                                "commit": commit,
                                "timing_concern": "rapid_consecutive",
                                "time_diff_minutes": time_diff / 60,
                                "previous_commit": commits[i - 1]["hash"][:8],
                                "risk_level": "high",
                            }
                        )

            except (ValueError, KeyError, IndexError):
                continue

        return timing_issues

    def parse_error(self, error_info: str) -> dict[str, Any]:
        """Parse error information to extract actionable context."""
        if not error_info:
            return {}

        error_context = {
            "error_type": "unknown",
            "message": error_info,
            "file": None,
            "line": None,
        }

        # JavaScript/TypeScript error patterns
        js_error_pattern = r"(\w+Error): (.+?) at (.+?):(\d+)"
        js_match = re.search(js_error_pattern, error_info)
        if js_match:
            error_context.update(
                {
                    "error_type": js_match.group(1),
                    "message": js_match.group(2),
                    "file": js_match.group(3),
                    "line": int(js_match.group(4)),
                }
            )

        # Python error patterns
        python_error_pattern = r'File "(.+?)", line (\d+).+\n\s*(.+)'
        python_match = re.search(python_error_pattern, error_info, re.MULTILINE)
        if python_match:
            error_context.update(
                {
                    "file": python_match.group(1),
                    "line": int(python_match.group(2)),
                    "message": python_match.group(3),
                }
            )

        # General file:line pattern
        general_pattern = r"([a-zA-Z_./\\]+\.\w+):?(\d+)?"
        general_match = re.search(general_pattern, error_info)
        if general_match and not error_context["file"]:
            error_context["file"] = general_match.group(1)
            if general_match.group(2):
                error_context["line"] = int(general_match.group(2))

        return error_context

    def get_recent_commits_for_file(
        self, git_root: Path, target_file: str
    ) -> list[dict[str, Any]]:
        """Get recent commits that modified a specific file."""
        try:
            # Git command to get commits for specific file
            result = self.run_git_command(
                [
                    "git",
                    "log",
                    "--oneline",
                    "--since",
                    f"{self.days_back} days ago",
                    "--",
                    target_file,
                ],
                git_root,
            )

            if result.returncode != 0:
                return []

            commits = []
            for line in result.stdout.strip().split("\n"):
                if not line.strip():
                    continue

                parts = line.split(" ", 1)
                if len(parts) >= 2:
                    commit_hash = parts[0]
                    commit_message = parts[1]

                    # Get detailed commit info
                    detail_result = self.run_git_command(
                        ["git", "show", "--stat", "--format=%ct|%an|%ae", commit_hash],
                        git_root,
                    )

                    if detail_result.returncode == 0:
                        detail_lines = detail_result.stdout.strip().split("\n")
                        if detail_lines:
                            info_parts = detail_lines[0].split("|")
                            if len(info_parts) >= 3:
                                commits.append(
                                    {
                                        "hash": commit_hash,
                                        "message": commit_message,
                                        "timestamp": int(info_parts[0]),
                                        "author": info_parts[1],
                                        "email": info_parts[2],
                                        "target_file": target_file,
                                    }
                                )

            return commits[: self.max_commits]

        except Exception:
            return []


def main():
    """Run recent changes analyzer from the command line."""
    import argparse
    import os

    # Parse arguments first to get error info
    parser = argparse.ArgumentParser(
        description="Root cause analysis through recent git changes"
    )
    parser.add_argument("target_path", help="Path to git repository to analyze")
    parser.add_argument(
        "--error",
        required=True,
        help="Error message, stack trace, or issue description to investigate",
    )
    parser.add_argument(
        "--output-format",
        choices=["json", "console"],
        default="json",
        help="Output format",
    )
    parser.add_argument(
        "--days-back",
        type=int,
        default=int(os.environ.get("DAYS_BACK", "30")),
        help="Number of days back to analyze commits",
    )
    parser.add_argument(
        "--max-commits",
        type=int,
        default=int(os.environ.get("MAX_COMMITS", "100")),
        help="Maximum commits to analyze",
    )

    args = parser.parse_args()

    # Create analyzer with error info
    analyzer = RecentChangesAnalyzer(
        days_back=args.days_back, max_commits=args.max_commits, error_info=args.error
    )

    # Set up basic config
    analyzer.config.target_path = args.target_path
    analyzer.config.output_format = args.output_format

    # Run analysis
    try:
        result = analyzer.analyze()

        if args.output_format == "console":
            print(f"Recent Changes Analysis for: {args.error}")
            print("=" * 60)
            for finding in result.findings:
                print(f"\n{finding.title}")
                print(f"Severity: {finding.severity}")
                print(f"Description: {finding.description}")
                print(f"Recommendation: {finding.recommendation}")
        else:
            print(result.to_json(indent=2))

        sys.exit(0)

    except Exception as e:
        print(f"Error during analysis: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
