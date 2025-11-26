"""Tmux session-based backend implementation."""

import json
import os
import shutil
import subprocess
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from ..base import (
    SandboxBackend,
    SandboxInfo,
    SandboxStatus,
    CommandResult,
    FileInfo,
)
from ...utils.exceptions import (
    SandboxCreationError,
    SandboxNotFoundError,
    CommandExecutionError,
    FileOperationError,
)
from ...utils.logging import get_logger

logger = get_logger(__name__)


class TmuxBackend(SandboxBackend):
    """Tmux session-based backend implementation."""

    SESSION_PREFIX = "sbx"

    def __init__(self, config: dict[str, Any]):
        self._sessions: dict[str, dict] = {}
        super().__init__(config)

    def _validate_config(self) -> None:
        """Validate Tmux configuration."""
        # Check if tmux is installed
        if not self._check_tmux():
            raise SandboxCreationError(
                "tmux is not installed. Install it with: apt install tmux"
            )

        # Ensure workspace directory exists
        workspace_dir = Path(
            self.config.get("workspace_dir", "~/.agent-sandbox/tmux-workspaces")
        )
        workspace_dir = workspace_dir.expanduser()
        workspace_dir.mkdir(parents=True, exist_ok=True)
        self.config["workspace_dir"] = str(workspace_dir)

        # Ensure capture directory exists
        capture_dir = Path(
            self.config.get("capture_dir", "~/.agent-sandbox/tmux-captures")
        )
        capture_dir = capture_dir.expanduser()
        capture_dir.mkdir(parents=True, exist_ok=True)
        self.config["capture_dir"] = str(capture_dir)

        # Load existing sessions
        self._load_sessions()

    def _check_tmux(self) -> bool:
        """Check if tmux is installed."""
        try:
            subprocess.run(
                ["tmux", "-V"], capture_output=True, check=True, timeout=5
            )
            return True
        except (subprocess.SubprocessError, FileNotFoundError):
            return False

    def _generate_sandbox_id(self) -> str:
        """Generate unique sandbox ID."""
        return f"{self.SESSION_PREFIX}_{uuid.uuid4().hex[:12]}"

    def _run_tmux(self, args: list[str], check: bool = True) -> subprocess.CompletedProcess:
        """Run tmux command."""
        cmd = ["tmux"] + args
        try:
            return subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=check,
                timeout=30,
            )
        except subprocess.TimeoutExpired:
            raise CommandExecutionError("Tmux command timed out")
        except subprocess.CalledProcessError as e:
            if check:
                raise CommandExecutionError(f"Tmux command failed: {e.stderr}")
            return e

    def _session_exists(self, sandbox_id: str) -> bool:
        """Check if tmux session exists."""
        result = self._run_tmux(["has-session", "-t", sandbox_id], check=False)
        return result.returncode == 0

    def _get_session_info_path(self, sandbox_id: str) -> Path:
        """Get path to session info file."""
        return Path(self.config["capture_dir"]) / f"{sandbox_id}.json"

    def _save_session_info(self, sandbox_id: str, info: dict) -> None:
        """Save session info to file."""
        path = self._get_session_info_path(sandbox_id)
        with open(path, "w") as f:
            json.dump(info, f)

    def _load_session_info(self, sandbox_id: str) -> Optional[dict]:
        """Load session info from file."""
        path = self._get_session_info_path(sandbox_id)
        if path.exists():
            with open(path, "r") as f:
                return json.load(f)
        return None

    def _load_sessions(self) -> None:
        """Load existing sessions from disk."""
        capture_dir = Path(self.config["capture_dir"])
        for info_file in capture_dir.glob("sbx_*.json"):
            try:
                with open(info_file, "r") as f:
                    info = json.load(f)
                    sandbox_id = info.get("sandbox_id")
                    if sandbox_id and self._session_exists(sandbox_id):
                        self._sessions[sandbox_id] = info
            except Exception:
                pass

    # =========================================================================
    # Lifecycle Operations
    # =========================================================================

    def create_sandbox(
        self,
        template: Optional[str] = None,
        timeout: Optional[int] = None,
        envs: Optional[dict[str, str]] = None,
        metadata: Optional[dict[str, str]] = None,
    ) -> str:
        """Create tmux session sandbox."""
        sandbox_id = self._generate_sandbox_id()

        logger.info(f"Creating tmux sandbox: {sandbox_id}")

        try:
            # Create workspace directory
            workspace = Path(self.config["workspace_dir"]) / sandbox_id
            workspace.mkdir(parents=True, exist_ok=True)

            # Create tmux session
            self._run_tmux([
                "new-session",
                "-d",
                "-s", sandbox_id,
                "-c", str(workspace),
            ])

            # Set environment variables
            if envs:
                for key, value in envs.items():
                    self._run_tmux([
                        "set-environment",
                        "-t", sandbox_id,
                        key, value,
                    ])

            # Store session info
            session_info = {
                "sandbox_id": sandbox_id,
                "workspace": str(workspace),
                "created_at": datetime.utcnow().isoformat(),
                "template": template,
                "timeout": timeout,
                "metadata": metadata or {},
                "envs": envs or {},
            }
            self._sessions[sandbox_id] = session_info
            self._save_session_info(sandbox_id, session_info)

            logger.info(f"Created tmux sandbox: {sandbox_id}")
            return sandbox_id

        except Exception as e:
            logger.error(f"Failed to create sandbox: {e}")
            raise SandboxCreationError(str(e))

    def connect_sandbox(self, sandbox_id: str) -> bool:
        """Connect to existing tmux session."""
        if not self._session_exists(sandbox_id):
            raise SandboxNotFoundError(f"Session not found: {sandbox_id}")

        # Load session info if not cached
        if sandbox_id not in self._sessions:
            info = self._load_session_info(sandbox_id)
            if info:
                self._sessions[sandbox_id] = info

        return True

    def get_sandbox_info(self, sandbox_id: str) -> SandboxInfo:
        """Get tmux session information."""
        if not self._session_exists(sandbox_id):
            raise SandboxNotFoundError(f"Session not found: {sandbox_id}")

        session_info = self._sessions.get(sandbox_id) or self._load_session_info(
            sandbox_id
        )

        if not session_info:
            session_info = {
                "sandbox_id": sandbox_id,
                "created_at": "",
                "metadata": {},
            }

        return SandboxInfo(
            sandbox_id=sandbox_id,
            backend_type="tmux",
            status=SandboxStatus.RUNNING,
            created_at=session_info.get("created_at", ""),
            metadata=session_info.get("metadata", {}),
            template=session_info.get("template"),
        )

    def is_sandbox_running(self, sandbox_id: str) -> bool:
        """Check if tmux session is running."""
        return self._session_exists(sandbox_id)

    def kill_sandbox(self, sandbox_id: str) -> bool:
        """Kill tmux session."""
        try:
            # Kill session
            self._run_tmux(["kill-session", "-t", sandbox_id], check=False)

            # Cleanup workspace if configured
            if self.config.get("cleanup_workspace", False):
                workspace = Path(self.config["workspace_dir"]) / sandbox_id
                if workspace.exists():
                    shutil.rmtree(workspace)

            # Remove session info file
            info_path = self._get_session_info_path(sandbox_id)
            if info_path.exists():
                info_path.unlink()

            if sandbox_id in self._sessions:
                del self._sessions[sandbox_id]

            logger.info(f"Killed tmux sandbox: {sandbox_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to kill sandbox: {e}")
            return False

    def pause_sandbox(self, sandbox_id: str) -> bool:
        """Pause not supported for tmux."""
        logger.warning("Pause not supported for tmux backend")
        return False

    def resume_sandbox(self, sandbox_id: str) -> bool:
        """Resume not supported for tmux."""
        logger.warning("Resume not supported for tmux backend")
        return False

    def list_sandboxes(self, limit: int = 20) -> list[SandboxInfo]:
        """List all tmux sessions."""
        result = self._run_tmux(["list-sessions", "-F", "#{session_name}"], check=False)

        sandboxes = []
        if result.returncode == 0 and result.stdout:
            for line in result.stdout.strip().split("\n"):
                session_name = line.strip()
                if session_name.startswith(self.SESSION_PREFIX):
                    session_info = self._sessions.get(
                        session_name
                    ) or self._load_session_info(session_name)

                    sandboxes.append(
                        SandboxInfo(
                            sandbox_id=session_name,
                            backend_type="tmux",
                            status=SandboxStatus.RUNNING,
                            created_at=session_info.get("created_at", "")
                            if session_info
                            else "",
                            metadata=session_info.get("metadata", {})
                            if session_info
                            else {},
                            template=session_info.get("template") if session_info else None,
                        )
                    )

                    if len(sandboxes) >= limit:
                        break

        return sandboxes

    # =========================================================================
    # Command Execution
    # =========================================================================

    def run_command(
        self,
        sandbox_id: str,
        command: str,
        cwd: Optional[str] = None,
        envs: Optional[dict[str, str]] = None,
        timeout: Optional[float] = 60,
        shell: bool = True,
    ) -> CommandResult:
        """Execute command in tmux session."""
        if not self._session_exists(sandbox_id):
            raise SandboxNotFoundError(f"Session not found: {sandbox_id}")

        # Get workspace
        session_info = self._sessions.get(sandbox_id) or {}
        workspace = session_info.get(
            "workspace", str(Path(self.config["workspace_dir"]) / sandbox_id)
        )

        # Build full command
        full_cmd = command
        if cwd:
            full_cmd = f"cd {cwd} && {command}"
        elif workspace:
            full_cmd = f"cd {workspace} && {command}"

        # Add environment variables
        if envs:
            env_str = " ".join([f"{k}={v}" for k, v in envs.items()])
            full_cmd = f"{env_str} {full_cmd}"

        # Create unique marker for output capture
        marker = f"__END_{uuid.uuid4().hex[:8]}__"
        exit_marker = f"__EXIT_{uuid.uuid4().hex[:8]}__"

        # Wrap command to capture output and exit code
        wrapped_cmd = f'{full_cmd}; echo "{exit_marker}$?"'

        # Create output file
        output_file = Path(self.config["capture_dir"]) / f"{sandbox_id}_output.txt"

        # Clear and redirect pane output
        self._run_tmux(["send-keys", "-t", sandbox_id, f"exec > >(tee {output_file}) 2>&1", "Enter"])
        time.sleep(0.1)

        # Send command
        self._run_tmux(["send-keys", "-t", sandbox_id, wrapped_cmd, "Enter"])

        # Wait for completion
        start_time = time.time()
        timeout = timeout or 60
        exit_code = -1
        output = ""

        while time.time() - start_time < timeout:
            time.sleep(0.2)

            # Check output file
            if output_file.exists():
                content = output_file.read_text()
                if exit_marker in content:
                    # Extract exit code
                    parts = content.split(exit_marker)
                    output = parts[0].strip()
                    try:
                        exit_code = int(parts[1].strip().split()[0])
                    except (ValueError, IndexError):
                        exit_code = 0
                    break

        # Cleanup
        if output_file.exists():
            output_file.unlink()

        return CommandResult(
            stdout=output,
            stderr="",
            exit_code=exit_code,
        )

    def run_command_background(
        self,
        sandbox_id: str,
        command: str,
        cwd: Optional[str] = None,
        envs: Optional[dict[str, str]] = None,
    ) -> CommandResult:
        """Run command in background."""
        if not self._session_exists(sandbox_id):
            raise SandboxNotFoundError(f"Session not found: {sandbox_id}")

        # Get workspace
        session_info = self._sessions.get(sandbox_id) or {}
        workspace = session_info.get(
            "workspace", str(Path(self.config["workspace_dir"]) / sandbox_id)
        )

        # Build command
        full_cmd = command
        if cwd:
            full_cmd = f"cd {cwd} && {command}"
        elif workspace:
            full_cmd = f"cd {workspace} && {command}"

        # Add environment variables
        if envs:
            env_str = " ".join([f"{k}={v}" for k, v in envs.items()])
            full_cmd = f"{env_str} {full_cmd}"

        # Run in background
        bg_cmd = f"nohup {full_cmd} > /dev/null 2>&1 & echo $!"
        self._run_tmux(["send-keys", "-t", sandbox_id, bg_cmd, "Enter"])

        # Give it a moment to start
        time.sleep(0.2)

        return CommandResult(
            stdout="",
            stderr="",
            exit_code=0,
            pid=None,  # PID capture is complex in tmux
        )

    # =========================================================================
    # File Operations (Direct Filesystem Access)
    # =========================================================================

    def _get_full_path(self, sandbox_id: str, path: str) -> Path:
        """Get full filesystem path for sandbox path."""
        session_info = self._sessions.get(sandbox_id) or {}
        workspace = Path(
            session_info.get(
                "workspace", str(Path(self.config["workspace_dir"]) / sandbox_id)
            )
        )

        # Handle absolute vs relative paths
        if path.startswith("/workspace"):
            return workspace / path[10:]  # Remove /workspace prefix
        elif path.startswith("/"):
            return workspace / path[1:]
        else:
            return workspace / path

    def list_files(
        self, sandbox_id: str, path: str = "/workspace", depth: int = 1
    ) -> list[FileInfo]:
        """List files in directory."""
        full_path = self._get_full_path(sandbox_id, path)

        if not full_path.exists():
            return []

        files = []
        for item in full_path.iterdir():
            stat = item.stat()
            files.append(
                FileInfo(
                    name=item.name,
                    path=str(item),
                    type="dir" if item.is_dir() else "file",
                    size=stat.st_size,
                    permissions=oct(stat.st_mode)[-3:],
                    modified_at=datetime.fromtimestamp(stat.st_mtime).isoformat(),
                )
            )

        return files

    def read_file(self, sandbox_id: str, path: str) -> str:
        """Read text file content."""
        full_path = self._get_full_path(sandbox_id, path)
        if not full_path.exists():
            raise FileOperationError(f"File not found: {path}")
        return full_path.read_text()

    def read_file_bytes(self, sandbox_id: str, path: str) -> bytes:
        """Read binary file content."""
        full_path = self._get_full_path(sandbox_id, path)
        if not full_path.exists():
            raise FileOperationError(f"File not found: {path}")
        return full_path.read_bytes()

    def write_file(self, sandbox_id: str, path: str, content: str) -> FileInfo:
        """Write text file."""
        full_path = self._get_full_path(sandbox_id, path)
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_text(content)

        stat = full_path.stat()
        return FileInfo(
            name=full_path.name,
            path=str(full_path),
            type="file",
            size=stat.st_size,
            permissions=oct(stat.st_mode)[-3:],
        )

    def write_file_bytes(self, sandbox_id: str, path: str, data: bytes) -> FileInfo:
        """Write binary file."""
        full_path = self._get_full_path(sandbox_id, path)
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_bytes(data)

        stat = full_path.stat()
        return FileInfo(
            name=full_path.name,
            path=str(full_path),
            type="file",
            size=stat.st_size,
            permissions=oct(stat.st_mode)[-3:],
        )

    def file_exists(self, sandbox_id: str, path: str) -> bool:
        """Check if file exists."""
        full_path = self._get_full_path(sandbox_id, path)
        return full_path.exists()

    def get_file_info(self, sandbox_id: str, path: str) -> FileInfo:
        """Get file information."""
        full_path = self._get_full_path(sandbox_id, path)
        if not full_path.exists():
            raise FileOperationError(f"File not found: {path}")

        stat = full_path.stat()
        return FileInfo(
            name=full_path.name,
            path=str(full_path),
            type="dir" if full_path.is_dir() else "file",
            size=stat.st_size,
            permissions=oct(stat.st_mode)[-3:],
            modified_at=datetime.fromtimestamp(stat.st_mtime).isoformat(),
        )

    def remove_file(self, sandbox_id: str, path: str) -> None:
        """Remove file or directory."""
        full_path = self._get_full_path(sandbox_id, path)
        if not full_path.exists():
            raise FileOperationError(f"File not found: {path}")

        if full_path.is_dir():
            shutil.rmtree(full_path)
        else:
            full_path.unlink()

    def make_directory(self, sandbox_id: str, path: str) -> bool:
        """Create directory."""
        full_path = self._get_full_path(sandbox_id, path)
        full_path.mkdir(parents=True, exist_ok=True)
        return True

    def rename_file(self, sandbox_id: str, old_path: str, new_path: str) -> FileInfo:
        """Rename/move file."""
        old_full = self._get_full_path(sandbox_id, old_path)
        new_full = self._get_full_path(sandbox_id, new_path)

        if not old_full.exists():
            raise FileOperationError(f"File not found: {old_path}")

        new_full.parent.mkdir(parents=True, exist_ok=True)
        old_full.rename(new_full)

        return self.get_file_info(sandbox_id, new_path)

    # =========================================================================
    # Network Operations
    # =========================================================================

    def get_host(self, sandbox_id: str, port: int) -> str:
        """Return localhost URL (no isolation)."""
        return f"http://localhost:{port}"

    # =========================================================================
    # Health Check
    # =========================================================================

    def health_check(self) -> dict[str, Any]:
        """Check tmux health."""
        try:
            result = subprocess.run(
                ["tmux", "-V"], capture_output=True, text=True, check=True
            )
            version = result.stdout.strip()

            # Count sessions
            list_result = self._run_tmux(["list-sessions"], check=False)
            session_count = 0
            if list_result.returncode == 0 and list_result.stdout:
                session_count = len(
                    [
                        l
                        for l in list_result.stdout.strip().split("\n")
                        if l.startswith(self.SESSION_PREFIX)
                    ]
                )

            return {
                "status": "healthy",
                "backend": "tmux",
                "version": version,
                "sessions": session_count,
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "backend": "tmux",
                "error": str(e),
            }
