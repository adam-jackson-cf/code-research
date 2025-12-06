"""
AGENTS.md Update Script for Development Workflow Commands.

Adds or updates the Development Workflow Commands section in project AGENTS.md.
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any


def get_agents_md_content(components: list[dict[str, Any]]) -> str:
    """Generate the Development Workflow Commands section content."""
    # Extract service labels from components for log documentation
    service_labels = []
    for component in components:
        label = component.get("log_label", component.get("name", "SERVICE"))
        tech = component.get("technology", component.get("type", ""))
        if tech:
            service_labels.append(f"`[{label}]` ({tech})")
        else:
            service_labels.append(f"`[{label}]`")

    # Format service labels for display
    (", ".join(service_labels) if service_labels else "`[WEB]`, `[API]`, `[BACKEND]`")

    content = """## Development Workflow Commands (Make-based)

**CRITICAL: Service Management Restrictions - NO EXCEPTIONS**

- **NEVER run `make dev` or `make stop`** - These commands start/stop development services
- **ALWAYS ask the user** to run these commands manually
- **Claude can use**: `make tail-logs`, `make logs`, `make status`, `make health`, `make monitor`, `make clean`
- **Never change, suppress or subvert a linting failure** - Address all linting errors immediately when found, even if unrelated to current task. No
- **Never attempt to start, stop, or restart development services automatically.** - these commands are only available to the user.

### Available Commands

- `make dev` - **USER ONLY** - Start all development services with shoreman
- `make stop` - **USER ONLY** - Stop all development services
- `make status` - **Claude can use** - Show service status
- `make logs` - **Claude can use** - Show aggregated logs (last 100 lines)
- `make tail-logs` - **Claude can use** - Follow logs in real-time (Ctrl+C to exit)
- `make health` - **Claude can use** - Check service health
- `make monitor` - **Claude can use** - Show system monitoring dashboard
- `make clean` - **Claude can use** - Clean logs and temporary files
- `make help` - **Claude can use** - Show available commands

### Component-specific Commands

- `make frontend-status` - **Claude can use** - Check FRONTEND status
- `make frontend-logs` - **Claude can use** - Show FRONTEND logs
- `make backend-status` - **Claude can use** - Check BACKEND status
- `make backend-logs` - **Claude can use** - Show BACKEND logs

### Log Files and Debugging

- **Development logs**: Located at `./dev.log` in project root
- **Log format**: `[TIMESTAMP] [SERVICE] Message content`
- **Services**: `[FRONTEND]`, `[BACKEND]`
- **Access logs**: Use `make logs` for recent logs or `make tail-logs` for real-time monitoring
- **Context gathering**: Logs provide complete context about frontend/backend requests and errors

### Workflow Integration

When debugging issues or understanding system state:

1. **Check service status**: `make status`
2. **Read recent logs**: `make logs` (last 100 lines)
3. **Monitor real-time logs**: `make tail-logs` (use Ctrl+C to exit)
4. **Check service health**: `make health`
5. **View system resources**: `make monitor`
6. **Ask user to restart services**: "Please run `make dev` to start/restart development services"""

    return content


def find_existing_section(content: str) -> tuple:
    """Find existing Development Workflow Commands section."""
    lines = content.split("\n")
    start_idx = None
    end_idx = None

    for i, line in enumerate(lines):
        if "## Development Workflow Commands" in line:
            start_idx = i
            # Find the end of this section (next ## header or end of file)
            for j in range(i + 1, len(lines)):
                if lines[j].startswith("## ") and j != i:
                    end_idx = j
                    break
            if end_idx is None:
                end_idx = len(lines)
            break

    return start_idx, end_idx


def update_agents_md(project_dir: str, components: list[dict[str, Any]]) -> bool:
    """Update or create AGENTS.md with development workflow commands."""
    agents_md_path = Path(project_dir) / "AGENTS.md"
    new_section = get_agents_md_content(components)

    if agents_md_path.exists():
        # Read existing content
        with open(agents_md_path, encoding="utf-8") as f:
            existing_content = f.read()

        # Check if our section already exists
        start_idx, end_idx = find_existing_section(existing_content)

        if start_idx is not None:
            # Replace existing section
            lines = existing_content.split("\n")
            updated_lines = (
                lines[:start_idx] + new_section.split("\n") + lines[end_idx:]
            )
            updated_content = "\n".join(updated_lines)
            print(
                f"✅ Updated existing Development Workflow Commands section in {agents_md_path}"
            )
        else:
            # Append new section
            separator = "\n\n---\n\n" if existing_content.strip() else ""
            updated_content = existing_content + separator + new_section
            print(
                f"✅ Added Development Workflow Commands section to existing {agents_md_path}"
            )

        # Write updated content
        with open(agents_md_path, "w", encoding="utf-8") as f:
            f.write(updated_content)
    else:
        # Create new AGENTS.md file
        with open(agents_md_path, "w", encoding="utf-8") as f:
            f.write(new_section)
        print(f"✅ Created new {agents_md_path} with Development Workflow Commands")

    return True


def main():
    parser = argparse.ArgumentParser(
        description="Update project CLAUDE.md with development workflow commands"
    )
    parser.add_argument("--project-dir", required=True, help="Project directory path")
    parser.add_argument(
        "--components", required=True, help="JSON string of project components"
    )

    args = parser.parse_args()

    try:
        # Parse components JSON
        components = json.loads(args.components)
        if not isinstance(components, list):
            components = []
    except json.JSONDecodeError as e:
        print(f"❌ Error parsing components JSON: {e}")
        return 1

    # Validate project directory
    if not os.path.isdir(args.project_dir):
        print(f"❌ Project directory not found: {args.project_dir}")
        return 1

    try:
        success = update_agents_md(args.project_dir, components)
        if success:
            print("\n🎉 AGENTS.md update completed successfully!")
            print("\nAdded sections:")
            print("  - Service Management Restrictions")
            print("  - Available Make Commands")
            print("  - Log Files and Debugging")
            print("  - Workflow Integration")
            return 0
        else:
            print("❌ Failed to update AGENTS.md")
            return 1
    except Exception as e:
        print(f"❌ Error updating AGENTS.md: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
