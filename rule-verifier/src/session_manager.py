"""
Session Manager - Manage isolated tmux sessions for testing.
"""

import shutil
from pathlib import Path
from typing import Dict, List, Optional
import libtmux
import time


class SessionManager:
    """Manage isolated tmux sessions for rule testing."""

    def __init__(self, config: Dict):
        self.config = config
        self.server = libtmux.Server()
        self.base_dir = Path(
            config.get("session", {}).get("base_dir", "/tmp/rule-verifier-sessions")
        )
        self.prefix = config.get("session", {}).get("tmux_prefix", "rule-verify-")
        self.cleanup_enabled = config.get("session", {}).get("cleanup_after_test", True)

        # Ensure base directory exists
        self.base_dir.mkdir(parents=True, exist_ok=True)

        # Track active sessions
        self.active_sessions: Dict[str, Dict] = {}

    def create_session(self, session_id: str, agents_file: Optional[str] = None) -> Dict:
        """
        Create a new isolated tmux session.

        Args:
            session_id: Unique identifier for the session
            agents_file: Path to AGENTS.md or CLAUDE.md file to copy

        Returns:
            Dict with session information
        """
        session_name = f"{self.prefix}{session_id}"

        # Check if session already exists
        if self.server.has_session(session_name):
            raise ValueError(f"Session {session_name} already exists")

        # Create temporary directory for this session
        session_dir = self.base_dir / session_id
        session_dir.mkdir(parents=True, exist_ok=True)

        # Copy AGENTS.md/CLAUDE.md file if provided
        if agents_file:
            agents_path = Path(agents_file)
            if agents_path.exists():
                dest_path = session_dir / agents_path.name
                shutil.copy2(agents_path, dest_path)

        # Create tmux session
        session = self.server.new_session(
            session_name=session_name,
            start_directory=str(session_dir),
            attach=False,
            kill_session=True,  # Kill existing session if it exists
        )

        # Store session info
        session_info = {
            "session_id": session_id,
            "session_name": session_name,
            "session_dir": str(session_dir),
            "tmux_session": session,
            "agents_file": agents_file,
            "created_at": time.time(),
        }

        self.active_sessions[session_id] = session_info

        return session_info

    def execute_command(
        self, session_id: str, command: str, capture_output: bool = True
    ) -> Optional[str]:
        """
        Execute a command in a tmux session.

        Args:
            session_id: Session identifier
            command: Command to execute
            capture_output: Whether to capture the output

        Returns:
            Command output if capture_output is True
        """
        if session_id not in self.active_sessions:
            raise ValueError(f"Session {session_id} not found")

        session_info = self.active_sessions[session_id]
        tmux_session = session_info["tmux_session"]

        # Get the first window and pane
        window = tmux_session.attached_window
        if not window:
            window = tmux_session.windows[0]

        pane = window.attached_pane
        if not pane:
            pane = window.panes[0]

        # Send the command
        pane.send_keys(command)

        # Wait a bit for command to execute
        time.sleep(0.5)

        # Capture output if requested
        if capture_output:
            # Get pane content
            output = pane.capture_pane()
            return "\n".join(output)

        return None

    def get_session_info(self, session_id: str) -> Optional[Dict]:
        """Get information about a session."""
        return self.active_sessions.get(session_id)

    def list_sessions(self) -> List[Dict]:
        """List all active sessions."""
        return list(self.active_sessions.values())

    def cleanup_session(self, session_id: str) -> bool:
        """
        Clean up a session and its resources.

        Args:
            session_id: Session identifier

        Returns:
            True if cleanup was successful
        """
        if session_id not in self.active_sessions:
            return False

        session_info = self.active_sessions[session_id]

        try:
            # Kill tmux session
            tmux_session = session_info["tmux_session"]
            tmux_session.kill_session()

            # Remove session directory if cleanup is enabled
            if self.cleanup_enabled:
                session_dir = Path(session_info["session_dir"])
                if session_dir.exists():
                    shutil.rmtree(session_dir)

            # Remove from active sessions
            del self.active_sessions[session_id]

            return True

        except Exception as e:
            print(f"Error cleaning up session {session_id}: {e}")
            return False

    def cleanup_all(self) -> int:
        """
        Clean up all active sessions.

        Returns:
            Number of sessions cleaned up
        """
        session_ids = list(self.active_sessions.keys())
        cleaned = 0

        for session_id in session_ids:
            if self.cleanup_session(session_id):
                cleaned += 1

        return cleaned

    def get_session_directory(self, session_id: str) -> Optional[Path]:
        """Get the working directory for a session."""
        session_info = self.active_sessions.get(session_id)
        if session_info:
            return Path(session_info["session_dir"])
        return None

    def __enter__(self):
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - cleanup all sessions."""
        self.cleanup_all()


class SessionPool:
    """Manage a pool of sessions for parallel testing."""

    def __init__(self, config: Dict, pool_size: int = 5):
        self.config = config
        self.pool_size = pool_size
        self.manager = SessionManager(config)
        self.available_sessions: List[str] = []
        self.in_use_sessions: Dict[str, bool] = {}

    def initialize(self, agents_file: Optional[str] = None):
        """Initialize the session pool."""
        for i in range(self.pool_size):
            session_id = f"pool_{i}_{int(time.time())}"
            self.manager.create_session(session_id, agents_file)
            self.available_sessions.append(session_id)
            self.in_use_sessions[session_id] = False

    def acquire_session(self) -> Optional[str]:
        """Acquire a session from the pool."""
        for session_id in self.available_sessions:
            if not self.in_use_sessions[session_id]:
                self.in_use_sessions[session_id] = True
                return session_id
        return None

    def release_session(self, session_id: str):
        """Release a session back to the pool."""
        if session_id in self.in_use_sessions:
            self.in_use_sessions[session_id] = False

    def cleanup(self):
        """Cleanup all sessions in the pool."""
        self.manager.cleanup_all()
