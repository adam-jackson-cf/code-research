"""Command execution commands."""

import sys

import click
from rich.console import Console

from ..backends import BackendFactory
from ..config import load_config
from ..utils.logging import get_logger

logger = get_logger(__name__)
console = Console()


def get_backend(backend_type: str = None):
    """Get backend instance."""
    config = load_config()
    backend_type = backend_type or config.backend.default
    backend_config = config.get_backend_config(backend_type)
    return BackendFactory.create_backend(backend_type, backend_config)


@click.command("exec")
@click.argument("sandbox_id")
@click.argument("command")
@click.option("--cwd", "-c", default=None, help="Working directory")
@click.option("--env", "-e", multiple=True, help="Environment variable (KEY=VALUE)")
@click.option("--timeout", "-t", type=float, default=60, help="Command timeout (seconds)")
@click.option("--background", "-bg", is_flag=True, help="Run in background")
@click.option("--shell/--no-shell", default=True, help="Use shell for execution")
@click.option("--backend", "-b", default=None, help="Backend type")
@click.option("--stdin", is_flag=True, help="Read additional input from stdin")
def exec_cmd(sandbox_id, command, cwd, env, timeout, background, shell, backend, stdin):
    """Execute a command in a sandbox.

    Examples:
        sbx exec sbx_abc123 "echo hello"
        sbx exec sbx_abc123 "python script.py" --cwd /workspace/app
        sbx exec sbx_abc123 "npm start" --background
    """
    try:
        backend_instance = get_backend(backend)

        # Parse environment variables
        envs = {}
        for e in env:
            if "=" in e:
                key, value = e.split("=", 1)
                envs[key] = value

        # Read stdin if requested
        if stdin and not sys.stdin.isatty():
            stdin_content = sys.stdin.read()
            # Append stdin to command
            command = f"echo {repr(stdin_content)} | {command}"

        if background:
            result = backend_instance.run_command_background(
                sandbox_id=sandbox_id,
                command=command,
                cwd=cwd,
                envs=envs if envs else None,
            )
            if result.pid:
                console.print(f"[green]Started background process:[/green] PID {result.pid}")
                print(result.pid)
            else:
                console.print("[green]Started background process[/green]")
        else:
            result = backend_instance.run_command(
                sandbox_id=sandbox_id,
                command=command,
                cwd=cwd,
                envs=envs if envs else None,
                timeout=timeout,
                shell=shell,
            )

            # Output stdout
            if result.stdout:
                print(result.stdout)

            # Output stderr to stderr
            if result.stderr:
                print(result.stderr, file=sys.stderr)

            # Exit with command's exit code
            if result.exit_code != 0:
                raise SystemExit(result.exit_code)

    except SystemExit:
        raise
    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        raise SystemExit(1)
