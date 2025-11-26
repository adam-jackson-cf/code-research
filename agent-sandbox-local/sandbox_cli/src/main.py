"""Main CLI entry point for sandbox management."""

import click
from pathlib import Path

from .commands.sandbox import sandbox
from .commands.exec import exec_cmd
from .commands.files import files
from .commands.backend import backend
from .config import load_config
from .backends import BackendFactory
from .utils.logging import setup_logging, get_logger

logger = get_logger(__name__)


@click.group()
@click.version_option(version="2.0.0", prog_name="sbx")
@click.option("--debug", is_flag=True, help="Enable debug logging")
def cli(debug):
    """Agent Sandbox CLI - Multi-backend sandbox management.

    Supports both OrbStack (Docker) and Tmux backends for isolated
    code execution environments.

    Examples:
        sbx sandbox create --template python
        sbx exec sbx_abc123 "echo hello world"
        sbx files ls sbx_abc123
        sbx backend health
    """
    # Setup logging
    log_level = "DEBUG" if debug else "INFO"
    setup_logging(level=log_level)


# Register command groups
cli.add_command(sandbox)
cli.add_command(exec_cmd, name="exec")
cli.add_command(files)
cli.add_command(backend)


@cli.command("init")
@click.option("--template", "-t", default=None, help="Template name")
@click.option("--timeout", type=int, default=1800, help="Timeout in seconds")
@click.option("--env", "-e", multiple=True, help="Environment variable (KEY=VALUE)")
@click.option("--backend", "-b", default=None, help="Backend type (orbstack, tmux)")
@click.option("--name", "-n", default=None, help="Custom sandbox name/metadata")
def init(template, timeout, env, backend, name):
    """Quick sandbox initialization.

    Creates a sandbox and outputs its ID for use in subsequent commands.

    Example:
        SANDBOX_ID=$(sbx init --template python)
        sbx exec $SANDBOX_ID "python --version"
    """
    try:
        config = load_config()
        backend_type = backend or config.backend.default
        backend_config = config.get_backend_config(backend_type)
        backend_instance = BackendFactory.create_backend(backend_type, backend_config)

        # Parse environment variables
        envs = {}
        for e in env:
            if "=" in e:
                key, value = e.split("=", 1)
                envs[key] = value

        # Parse metadata
        metadata = {"name": name} if name else None

        sandbox_id = backend_instance.create_sandbox(
            template=template,
            timeout=timeout,
            envs=envs if envs else None,
            metadata=metadata,
        )

        # Output just the ID for scripting
        print(sandbox_id)

    except Exception as e:
        logger.error(f"Failed to initialize sandbox: {e}")
        raise SystemExit(1)


@cli.command("run")
@click.argument("command")
@click.option("--template", "-t", default=None, help="Template name")
@click.option("--timeout", type=int, default=60, help="Command timeout")
@click.option("--backend", "-b", default=None, help="Backend type")
@click.option("--keep", "-k", is_flag=True, help="Keep sandbox after command")
def run(command, template, timeout, backend, keep):
    """Run a command in a temporary sandbox.

    Creates a sandbox, runs the command, and destroys the sandbox
    (unless --keep is specified).

    Example:
        sbx run "python -c 'print(1+1)'"
        sbx run --template node "node -e 'console.log(42)'"
    """
    try:
        config = load_config()
        backend_type = backend or config.backend.default
        backend_config = config.get_backend_config(backend_type)
        backend_instance = BackendFactory.create_backend(backend_type, backend_config)

        # Create sandbox
        sandbox_id = backend_instance.create_sandbox(template=template)
        logger.info(f"Created sandbox: {sandbox_id}")

        try:
            # Run command
            result = backend_instance.run_command(
                sandbox_id=sandbox_id,
                command=command,
                timeout=timeout,
            )

            # Output results
            if result.stdout:
                print(result.stdout)
            if result.stderr:
                import sys
                print(result.stderr, file=sys.stderr)

            exit_code = result.exit_code

        finally:
            if not keep:
                backend_instance.kill_sandbox(sandbox_id)
                logger.info(f"Destroyed sandbox: {sandbox_id}")
            else:
                print(f"\nSandbox kept: {sandbox_id}", file=sys.stderr)

        raise SystemExit(exit_code)

    except SystemExit:
        raise
    except Exception as e:
        logger.error(f"Run failed: {e}")
        raise SystemExit(1)


def main():
    """Entry point for the CLI."""
    cli()


if __name__ == "__main__":
    main()
