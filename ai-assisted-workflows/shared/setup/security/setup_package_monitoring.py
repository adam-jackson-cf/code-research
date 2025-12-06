#!/usr/bin/env python3
"""
Package Monitoring Setup Script.

Configures Dependabot for automated dependency updates and minimal CI auditing
that only triggers when package files change.
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

# Import base framework components for import validation
try:
    # Import modules to validate environment but don't use them
    import core.base.analyzer_base  # noqa: F401
    import core.utils.output_formatter  # noqa: F401
except ImportError as e:
    print(f"❌ Failed to import framework components: {e}")
    print("Ensure PYTHONPATH is set to the package root")
    sys.exit(1)


class PackageMonitoringSetup:
    """Setup package monitoring via Dependabot + smart CI auditing."""

    def __init__(
        self,
        audit_level: str = "critical",
        setup_branch_protection: bool = False,
        package_file: str = None,
        exclude_paths: list = None,
    ):
        self.audit_level = audit_level
        self.setup_branch_protection = setup_branch_protection
        self.package_file = package_file
        self.exclude_paths = exclude_paths or []
        self.templates_dir = Path(__file__).parent / "templates"

        # Detect all package ecosystems
        self.detected_ecosystems = self.detect_package_ecosystems()

        # Validate audit level
        valid_levels = ["info", "low", "moderate", "high", "critical"]
        if self.audit_level not in valid_levels:
            raise ValueError(
                f"Invalid audit level: {self.audit_level}. Valid levels: {valid_levels}"
            )

    def detect_package_ecosystems(self) -> dict:
        """Detect all package ecosystems in the project."""
        # If specific package file is provided, detect from that file only
        if self.package_file:
            return self._detect_from_package_file(self.package_file)

        # Otherwise, perform full ecosystem detection with exclusions
        return self._detect_all_ecosystems()

    def _detect_from_package_file(self, package_file: str) -> dict:
        """Detect ecosystem from a specific package file."""
        ecosystems = {}
        package_path = Path(package_file)

        if not package_path.exists():
            print(f"⚠️  Specified package file {package_file} does not exist")
            return ecosystems

        # Get the directory containing the package file
        package_dir = (
            package_path.parent if package_path.parent != Path(".") else Path(".")
        )

        # Determine ecosystem type from file name
        file_name = package_path.name

        if file_name in [
            "requirements.txt",
            "requirements-dev.txt",
            "setup.py",
            "setup.cfg",
        ]:
            ecosystems["python"] = {
                "managers": ["pip"],
                "files": [str(package_path)],
                "directory": str(package_dir),
            }
        elif file_name == "pyproject.toml":
            ecosystems["python"] = {
                "managers": ["poetry"],
                "files": [str(package_path)],
                "directory": str(package_dir),
            }
        elif file_name == "Pipfile":
            ecosystems["python"] = {
                "managers": ["pipenv"],
                "files": [str(package_path)],
                "directory": str(package_dir),
            }
        elif file_name == "package.json":
            # Look for JavaScript lock files in the same directory
            js_files = ["package.json"]
            managers = ["npm"]  # default

            for lock_file, manager in [
                ("package-lock.json", "npm"),
                ("yarn.lock", "yarn"),
                ("pnpm-lock.yaml", "pnpm"),
                ("bun.lockb", "bun"),
            ]:
                if (package_dir / lock_file).exists():
                    js_files.append(str(package_dir / lock_file))
                    managers = [manager]
                    break

            ecosystems["javascript"] = {
                "managers": managers,
                "files": js_files,
                "directory": str(package_dir),
            }
        elif file_name == "go.mod":
            files = [str(package_path)]
            if (package_dir / "go.sum").exists():
                files.append(str(package_dir / "go.sum"))
            ecosystems["go"] = {
                "managers": ["gomod"],
                "files": files,
                "directory": str(package_dir),
            }
        elif file_name == "Cargo.toml":
            files = [str(package_path)]
            if (package_dir / "Cargo.lock").exists():
                files.append(str(package_dir / "Cargo.lock"))
            ecosystems["rust"] = {
                "managers": ["cargo"],
                "files": files,
                "directory": str(package_dir),
            }

        return ecosystems

    def _detect_all_ecosystems(self) -> dict:
        """Detect all package ecosystems in the project with exclusions."""
        ecosystems = {}

        # Helper function to check if a path should be excluded
        def is_excluded(path):
            path_str = str(path)
            for exclude in self.exclude_paths:
                if exclude in path_str or path_str.startswith(exclude):
                    return True
            return False

        # Python detection
        python_files = {
            "requirements.txt": "pip",
            "requirements-dev.txt": "pip",
            "pyproject.toml": "poetry",
            "Pipfile": "pipenv",
            "setup.py": "pip",
            "setup.cfg": "pip",
        }

        python_detected = []
        # Search in current directory and subdirectories
        for pattern in python_files:
            for file_path in Path(".").rglob(pattern):
                if not is_excluded(file_path):
                    python_detected.append((str(file_path), python_files[pattern]))

        if python_detected:
            ecosystems["python"] = {
                "managers": list({manager for _, manager in python_detected}),
                "files": [file_name for file_name, _ in python_detected],
            }

        # JavaScript detection
        js_files = {
            "package-lock.json": "npm",
            "yarn.lock": "yarn",
            "pnpm-lock.yaml": "pnpm",
            "bun.lockb": "bun",
        }

        js_detected = []
        # Find package.json files first
        for package_json in Path(".").rglob("package.json"):
            if not is_excluded(package_json):
                package_dir = package_json.parent
                js_detected.append((str(package_json), "npm"))  # default manager

                # Look for lock files in the same directory
                for lock_file, manager in js_files.items():
                    if (package_dir / lock_file).exists():
                        js_detected.append((str(package_dir / lock_file), manager))

        if js_detected:
            ecosystems["javascript"] = {
                "managers": list({manager for _, manager in js_detected}),
                "files": [file_name for file_name, _ in js_detected],
            }

        # Go detection
        go_detected = []
        for go_mod in Path(".").rglob("go.mod"):
            if not is_excluded(go_mod):
                go_detected.append((str(go_mod), "gomod"))
                go_sum = go_mod.parent / "go.sum"
                if go_sum.exists():
                    go_detected.append((str(go_sum), "gomod"))

        if go_detected:
            ecosystems["go"] = {
                "managers": ["gomod"],
                "files": [file_name for file_name, _ in go_detected],
            }

        # Rust detection
        rust_detected = []
        for cargo_toml in Path(".").rglob("Cargo.toml"):
            if not is_excluded(cargo_toml):
                rust_detected.append((str(cargo_toml), "cargo"))
                cargo_lock = cargo_toml.parent / "Cargo.lock"
                if cargo_lock.exists():
                    rust_detected.append((str(cargo_lock), "cargo"))

        if rust_detected:
            ecosystems["rust"] = {
                "managers": ["cargo"],
                "files": [file_name for file_name, _ in rust_detected],
            }

        # .NET detection
        dotnet_files = []
        for pattern in ["**/*.csproj", "**/*.sln"]:
            for file_path in Path(".").glob(pattern):
                if not is_excluded(file_path):
                    dotnet_files.append(str(file_path))

        if dotnet_files:
            ecosystems["dotnet"] = {
                "managers": ["nuget"],
                "files": dotnet_files + ["**/packages.config"],
            }

        return ecosystems

    def _get_path_filters(self) -> str:
        """Generate path filters for dorny/paths-filter action."""
        filters = []

        if "python" in self.detected_ecosystems:
            filters.append(
                "            python:\n"
                "              - 'requirements*.txt'\n"
                "              - 'pyproject.toml'\n"
                "              - 'Pipfile*'\n"
                "              - 'setup.py'\n"
                "              - 'setup.cfg'"
            )

        if "javascript" in self.detected_ecosystems:
            filters.append(
                "            javascript:\n"
                "              - 'package*.json'\n"
                "              - '*.lock'\n"
                "              - 'pnpm-lock.yaml'\n"
                "              - 'bun.lockb'"
            )

        if "go" in self.detected_ecosystems:
            filters.append(
                "            go:\n"
                "              - 'go.mod'\n"
                "              - 'go.sum'"
            )

        if "rust" in self.detected_ecosystems:
            filters.append(
                "            rust:\n"
                "              - 'Cargo.toml'\n"
                "              - 'Cargo.lock'"
            )

        if "dotnet" in self.detected_ecosystems:
            filters.append(
                "            dotnet:\n"
                "              - '**/*.csproj'\n"
                "              - '**/*.sln'\n"
                "              - '**/packages.config'"
            )

        return "\n".join(filters)

    def _get_audit_steps(self) -> str:
        """Generate audit steps for detected ecosystems."""
        steps = []

        if "python" in self.detected_ecosystems:
            steps.append(
                "      - name: Audit Python (if changed)\n"
                "        if: steps.changes.outputs.python == 'true'\n"
                "        run: |\n"
                "          python -m pip install --upgrade pip\n"
                "          pip install pip-audit\n"
                "          pip-audit --vulnerability-service osv --strict || {\n"
                "            # Only fail on CRITICAL vulnerabilities\n"
                "            pip-audit --format json --output audit.json\n"
                "            if jq -e '.vulnerabilities[] | select(.severity == \"CRITICAL\")' audit.json > /dev/null; then\n"
                '              echo "Critical Python vulnerabilities found"\n'
                "              exit 1\n"
                "            fi\n"
                "            exit 0\n"
                "          }"
            )

        if "javascript" in self.detected_ecosystems:
            steps.append(
                "      - name: Setup Node.js\n"
                "        if: steps.changes.outputs.javascript == 'true'\n"
                "        uses: actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8 # v4.0.2\n"
                "        with:\n"
                "          node-version: '20.x'\n"
                "\n"
                "      - name: Audit JavaScript (if changed)\n"
                "        if: steps.changes.outputs.javascript == 'true'\n"
                "        env:\n"
                "          AUDIT_LEVEL: ${{ inputs.audit-level || 'critical' }}\n"
                "        run: |\n"
                "          # Detect which package manager and audit with critical level\n"
                '          if [[ -f "package-lock.json" ]]; then\n'
                "            npm audit --audit-level=$AUDIT_LEVEL\n"
                '          elif [[ -f "yarn.lock" ]]; then\n'
                "            yarn audit --level $AUDIT_LEVEL\n"
                '          elif [[ -f "pnpm-lock.yaml" ]]; then\n'
                "            pnpm audit --audit-level $AUDIT_LEVEL\n"
                '          elif [[ -f "bun.lockb" ]]; then\n'
                "            # Bun uses npm audit as fallback\n"
                "            npm audit --audit-level=$AUDIT_LEVEL\n"
                "          fi"
            )

        if "go" in self.detected_ecosystems:
            steps.append(
                "      - name: Setup Go\n"
                "        if: steps.changes.outputs.go == 'true'\n"
                "        uses: actions/setup-go@0c52d547c9bc32b1aa3301fd7a9cb496313a4491 # v5.0.0\n"
                "        with:\n"
                "          go-version: '1.21'\n"
                "          cache: true\n"
                "\n"
                "      - name: Audit Go (if changed)\n"
                "        if: steps.changes.outputs.go == 'true'\n"
                "        run: |\n"
                "          go install golang.org/x/vuln/cmd/govulncheck@latest\n"
                "          govulncheck ./... || {\n"
                '            echo "Go vulnerabilities detected (non-blocking)"\n'
                "            exit 0\n"
                "          }"
            )

        if "rust" in self.detected_ecosystems:
            steps.append(
                "      - name: Audit Rust (if changed)\n"
                "        if: steps.changes.outputs.rust == 'true'\n"
                "        run: |\n"
                "          curl -sSL https://sh.rustup.rs | sh -s -- -y\n"
                "          source ~/.cargo/env\n"
                "          cargo install cargo-audit\n"
                "          cargo audit || {\n"
                '            echo "Rust vulnerabilities detected (non-blocking)"\n'
                "            exit 0\n"
                "          }"
            )

        if "dotnet" in self.detected_ecosystems:
            steps.append(
                "      - name: Setup .NET\n"
                "        if: steps.changes.outputs.dotnet == 'true'\n"
                "        uses: actions/setup-dotnet@4d6c8fcf3c8f7a60068d26b594648e99df24cee3 # v4.0.0\n"
                "        with:\n"
                "          dotnet-version: '8.x'\n"
                "\n"
                "      - name: Audit .NET (if changed)\n"
                "        if: steps.changes.outputs.dotnet == 'true'\n"
                "        run: |\n"
                "          dotnet list package --vulnerable --highest-severity critical || {\n"
                '            echo ".NET vulnerabilities detected (non-blocking)"\n'
                "            exit 0\n"
                "          }"
            )

        return "\n\n".join(steps)

    def run(self) -> dict:
        """Execute the package monitoring setup process."""
        if not self.detected_ecosystems:
            print("❌ No supported package ecosystems detected")
            print("   Supported: Python, JavaScript/TypeScript, Go, Rust, .NET")
            return {"errors": ["No supported package ecosystems found"]}

        ecosystems_str = ", ".join(self.detected_ecosystems.keys())
        print(
            f"🔧 Setting up package monitoring for {ecosystems_str} with audit level: {self.audit_level}"
        )

        results = {
            "ecosystems": self.detected_ecosystems,
            "audit_level": self.audit_level,
            "branch_protection": self.setup_branch_protection,
            "files_created": [],
            "warnings": [],
            "errors": [],
        }

        try:
            # Create .github directory
            self._ensure_github_directory()

            # Generate workflow
            workflow_path = self._generate_package_audit_workflow()
            results["files_created"].append(str(workflow_path))

            # Generate dependabot config
            dependabot_path = self._generate_dependabot_config()
            if dependabot_path:
                results["files_created"].append(str(dependabot_path))

            # Setup branch protection if requested
            if self.setup_branch_protection:
                self._setup_branch_protection(results)

            # Generate summary
            self._print_setup_summary(results)

        except Exception as e:
            results["errors"].append(str(e))
            print(f"❌ Error during setup: {e}")

        return results

    def _ensure_github_directory(self):
        """Create .github/workflows directory if it doesn't exist."""
        Path(".github/workflows").mkdir(parents=True, exist_ok=True)

    def _generate_package_audit_workflow(self) -> Path:
        """Generate the path-triggered package audit workflow."""
        workflow_path = Path(".github/workflows/package-audit.yml")

        # Backup existing workflow
        if workflow_path.exists():
            backup_path = workflow_path.with_suffix(".yml.bak")
            print(f"⚠️  Existing {workflow_path} found. Backing up to {backup_path}")
            workflow_path.rename(backup_path)

        # Generate workflow content
        workflow_content = self._get_package_audit_template()

        with open(workflow_path, "w") as f:
            f.write(workflow_content)

        print(f"✅ Created {workflow_path} (path-triggered audit for package changes)")
        return workflow_path

    def _get_package_audit_template(self) -> str:
        """Get the path-triggered package audit workflow template."""
        # Build path patterns for all detected ecosystems
        path_patterns = []

        if "python" in self.detected_ecosystems:
            path_patterns.extend(
                [
                    "'requirements*.txt'",
                    "'pyproject.toml'",
                    "'Pipfile*'",
                    "'setup.py'",
                    "'setup.cfg'",
                ]
            )

        if "javascript" in self.detected_ecosystems:
            path_patterns.extend(
                ["'package*.json'", "'*.lock'", "'pnpm-lock.yaml'", "'bun.lockb'"]
            )

        if "go" in self.detected_ecosystems:
            path_patterns.extend(["'go.mod'", "'go.sum'"])

        if "rust" in self.detected_ecosystems:
            path_patterns.extend(["'Cargo.toml'", "'Cargo.lock'"])

        if "dotnet" in self.detected_ecosystems:
            path_patterns.extend(
                ["'**/*.csproj'", "'**/*.sln'", "'**/packages.config'"]
            )

        paths_yaml = "\n      - ".join(path_patterns)

        return f"""name: Package Audit

on:
  pull_request:
    paths:
      - {paths_yaml}
  workflow_dispatch:
    inputs:
      audit-level:
        description: 'Audit severity level'
        required: false
        default: '{self.audit_level}'
        type: choice
        options:
          - info
          - low
          - moderate
          - high
          - critical

jobs:
  audit-changed-packages:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - name: Checkout code
        uses: actions/checkout@8ade135a41bc03ea155e62e844d188df1ea18608 # v4.1.0

      - name: Detect changed package files
        id: changes
        uses: dorny/paths-filter@de90cc6fb38fc0963ad72b210f1f284cd68cea36 # v3.0.2
        with:
          filters: |{self._get_path_filters()}

{self._get_audit_steps()}

      - name: Comment on PR if critical issues found
        if: failure()
        uses: actions/github-script@60a0d83039c74a4aee543508d2ffcb1c3799cdea # v7.0.1
        env:
          AUDIT_LEVEL: ${{{{ inputs.audit-level || '{self.audit_level}' }}}}
        with:
          script: |
            const auditLevel = process.env.AUDIT_LEVEL;
            await github.rest.issues.createComment({{
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `⛔ Critical security vulnerabilities detected in dependencies (audit level: ${{auditLevel}}). Please review and fix before merging.`
            }});


"""

    def _generate_dependabot_config(self) -> Path | None:
        """Generate multi-ecosystem Dependabot configuration."""
        dependabot_path = Path(".github/dependabot.yml")

        if dependabot_path.exists():
            print(f"⚠️  {dependabot_path} already exists, skipping...")
            return None

        ecosystems = []
        start_time = 3  # Start at 3 AM

        # Python ecosystem
        if "python" in self.detected_ecosystems:
            python_dir = self.detected_ecosystems["python"].get("directory", "/")
            if python_dir == ".":
                python_dir = "/"
            elif not python_dir.startswith("/"):
                python_dir = f"/{python_dir}"
            ecosystems.append(
                f"""  # Python dependencies
  - package-ecosystem: "pip"
    directory: "{python_dir}"
    schedule:
      interval: "daily"
      time: "{start_time:02d}:00"
    labels: ["dependencies", "python"]
    open-pull-requests-limit: 3
    groups:
      python-minor:
        patterns: ["*"]
        update-types: ["minor", "patch"]
    commit-message:
      prefix: "deps(python)"
      include: "scope"""
            )
            start_time += 1

        # JavaScript ecosystem
        if "javascript" in self.detected_ecosystems:
            js_dir = self.detected_ecosystems["javascript"].get("directory", "/")
            if js_dir == ".":
                js_dir = "/"
            elif not js_dir.startswith("/"):
                js_dir = f"/{js_dir}"
            ecosystems.append(
                f"""  # JavaScript/TypeScript dependencies
  - package-ecosystem: "npm"
    directory: "{js_dir}"
    schedule:
      interval: "daily"
      time: "{start_time:02d}:00"
    labels: ["dependencies", "javascript"]
    open-pull-requests-limit: 3
    groups:
      js-minor:
        patterns: ["*"]
        update-types: ["minor", "patch"]
    commit-message:
      prefix: "deps(js)"
      include: "scope"""
            )
            start_time += 1

        # Go ecosystem
        if "go" in self.detected_ecosystems:
            go_dir = self.detected_ecosystems["go"].get("directory", "/")
            if go_dir == ".":
                go_dir = "/"
            elif not go_dir.startswith("/"):
                go_dir = f"/{go_dir}"
            ecosystems.append(
                f"""  # Go dependencies
  - package-ecosystem: "gomod"
    directory: "{go_dir}"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "{start_time:02d}:00"
    labels: ["dependencies", "go"]
    open-pull-requests-limit: 2
    commit-message:
      prefix: "deps(go)"
      include: "scope"""
            )

        # Rust ecosystem
        if "rust" in self.detected_ecosystems:
            rust_dir = self.detected_ecosystems["rust"].get("directory", "/")
            if rust_dir == ".":
                rust_dir = "/"
            elif not rust_dir.startswith("/"):
                rust_dir = f"/{rust_dir}"
            ecosystems.append(
                f"""  # Rust dependencies
  - package-ecosystem: "cargo"
    directory: "{rust_dir}"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "{start_time:02d}:00"
    labels: ["dependencies", "rust"]
    open-pull-requests-limit: 2
    commit-message:
      prefix: "deps(rust)"
      include: "scope"""
            )

        # .NET ecosystem
        if "dotnet" in self.detected_ecosystems:
            dotnet_dir = self.detected_ecosystems["dotnet"].get("directory", "/")
            if dotnet_dir == ".":
                dotnet_dir = "/"
            elif not dotnet_dir.startswith("/"):
                dotnet_dir = f"/{dotnet_dir}"
            ecosystems.append(
                f"""  # .NET dependencies
  - package-ecosystem: "nuget"
    directory: "{dotnet_dir}"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "{start_time:02d}:00"
    labels: ["dependencies", "dotnet"]
    open-pull-requests-limit: 2
    commit-message:
      prefix: "deps(dotnet)"
      include: "scope"""
            )

        # Always include GitHub Actions
        ecosystems.append(
            f"""  # GitHub Actions
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "{start_time:02d}:00"
    labels: ["dependencies", "ci"]
    open-pull-requests-limit: 1
    commit-message:
      prefix: "deps(actions)"
      include: "scope"""
        )

        dependabot_content = f"""version: 2
updates:
{chr(10).join(ecosystems)}"""

        with open(dependabot_path, "w") as f:
            f.write(dependabot_content)

        print(f"✅ Created {dependabot_path}")
        return dependabot_path

    def _setup_branch_protection(self, results: dict):
        """Set up branch protection rules via GitHub API."""
        print("🔧 Setting up branch protection rules...")

        # Check if gh CLI is available
        if not self._check_command("gh"):
            error_msg = "GitHub CLI (gh) not found. Please install gh to use --setup-branch-protection"
            results["errors"].append(error_msg)
            print(f"❌ {error_msg}")
            print("   Visit: https://cli.github.com/")
            return

        # Check if authenticated
        try:
            subprocess.run(["gh", "auth", "status"], check=True, capture_output=True)
        except subprocess.CalledProcessError:
            error_msg = "Not authenticated with GitHub CLI. Please run 'gh auth login'"
            results["errors"].append(error_msg)
            print(f"❌ {error_msg}")
            return

        try:
            # Get repository information
            repo_url = subprocess.check_output(
                ["git", "config", "--get", "remote.origin.url"], text=True
            ).strip()

            # Parse repo owner/name from URL
            if "github.com" in repo_url:
                parts = repo_url.split("/")
                repo_name = parts[-1].replace(".git", "")
                repo_owner = parts[-2]
            else:
                raise ValueError("Unable to parse GitHub repository information")

            # Determine main branch
            try:
                main_branch = (
                    subprocess.check_output(
                        ["git", "symbolic-ref", "refs/remotes/origin/HEAD"], text=True
                    )
                    .strip()
                    .replace("refs/remotes/origin/", "")
                )
            except subprocess.CalledProcessError:
                main_branch = "main"

            print(
                f"Setting up branch protection for: {repo_owner}/{repo_name} (branch: {main_branch})"
            )

            # Setup branch protection
            protection_config = {
                "required_status_checks": {
                    "strict": True,
                    "contexts": ["security-audit"],
                },
                "enforce_admins": False,
                "required_pull_request_reviews": {
                    "dismiss_stale_reviews": True,
                    "require_code_owner_reviews": False,
                    "required_approving_review_count": 1,
                },
                "restrictions": None,
                "allow_force_pushes": False,
                "allow_deletions": False,
            }

            # Execute GitHub API call
            cmd = [
                "gh",
                "api",
                f"repos/{repo_owner}/{repo_name}/branches/{main_branch}/protection",
                "--method",
                "PUT",
            ]

            for key, value in protection_config.items():
                cmd.extend(["--field", f"{key}={json.dumps(value)}"])

            subprocess.run(cmd, check=True)
            print("✅ Branch protection rules configured successfully")

        except Exception as e:
            error_msg = f"Failed to configure branch protection rules: {e}"
            results["errors"].append(error_msg)
            print(f"❌ {error_msg}")

    def _check_command(self, command: str) -> bool:
        """Check if a command is available in PATH."""
        try:
            subprocess.run([command, "--version"], capture_output=True, check=True)
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False

    def _print_setup_summary(self, results: dict):
        """Print final setup summary."""
        print()
        print("🎉 Security CI setup completed successfully!")
        print()
        print("📁 Generated Files:")
        for file_path in results["files_created"]:
            file_name = Path(file_path).name
            if "package-security.yml" in file_name:
                print(f"  - {file_path} (security workflow)")
            elif "dependabot.yml" in file_name:
                print(f"  - {file_path} (dependency updates)")
            elif "SECURITY.md" in file_name:
                print(f"  - {file_path} (security policy documentation)")

        print()
        print("🔧 Configuration:")
        ecosystems_str = ", ".join(self.detected_ecosystems.keys())
        print(f"  - Ecosystems: {ecosystems_str}")
        print(f"  - Audit Level: {self.audit_level}")
        print(f"  - Branch Protection: {self.setup_branch_protection}")

        if results["warnings"]:
            print()
            print("⚠️  Warnings:")
            for warning in results["warnings"]:
                print(f"  - {warning}")

        if results["errors"]:
            print()
            print("❌ Errors:")
            for error in results["errors"]:
                print(f"  - {error}")

        print()
        print("🚀 Next Steps:")
        print("  1. Commit and push these files to activate the workflow")
        print("  2. Check the 'Actions' tab in GitHub to see the workflow run")
        print("  3. Review Dependabot PRs for security updates")
        print("  4. Package monitoring will only run when dependency files change")
        if self.setup_branch_protection:
            print("  5. Verify branch protection rules are active in repo settings")
        print()
        print("📖 For more information, see the generated SECURITY.md file")
        print()
        print(f"🔍 Detected ecosystems: {', '.join(self.detected_ecosystems.keys())}")
        print("⚡ Minimal CI: Audit workflow only runs when package files change")


def main():
    """Run the package monitoring setup script."""
    parser = argparse.ArgumentParser(
        description="Setup package monitoring with Dependabot and path-triggered auditing for multi-language projects"
    )
    parser.add_argument(
        "--audit-level",
        default="critical",
        choices=["info", "low", "moderate", "high", "critical"],
        help="Security audit severity level (default: critical)",
    )
    parser.add_argument(
        "--branch-protection",
        default="false",
        help="Setup branch protection rules (true/false)",
    )
    parser.add_argument(
        "--package-file",
        help="Specify package file directly to skip ecosystem detection (e.g., requirements.txt, package.json)",
    )
    parser.add_argument(
        "--exclude",
        action="append",
        help="Exclude directories/files from package search (can be used multiple times)",
    )

    args = parser.parse_args()

    # Convert branch protection string to boolean
    setup_branch_protection = args.branch_protection.lower() == "true"

    try:
        # Initialize and run setup
        setup = PackageMonitoringSetup(
            audit_level=args.audit_level,
            setup_branch_protection=setup_branch_protection,
            package_file=args.package_file,
            exclude_paths=args.exclude or [],
        )

        results = setup.run()

        # Exit with error code if there were errors
        if results["errors"]:
            sys.exit(1)

    except Exception as e:
        print(f"❌ Unexpected error during package monitoring setup: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
