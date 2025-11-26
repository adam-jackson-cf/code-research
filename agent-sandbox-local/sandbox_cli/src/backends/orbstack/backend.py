"""OrbStack (Docker) backend implementation."""

import io
import os
import tarfile
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import docker
from docker.errors import NotFound, ImageNotFound, APIError

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


class OrbStackBackend(SandboxBackend):
    """OrbStack (Docker) backend implementation."""

    LABEL_PREFIX = "agent-sandbox"

    def __init__(self, config: dict[str, Any]):
        self.client: Optional[docker.DockerClient] = None
        self._active_containers: dict[str, dict] = {}
        super().__init__(config)

    def _validate_config(self) -> None:
        """Validate OrbStack configuration."""
        # Initialize Docker client
        try:
            self.client = docker.from_env()
            self.client.ping()
        except Exception as e:
            raise SandboxCreationError(
                f"Cannot connect to Docker/OrbStack: {e}. "
                "Make sure Docker or OrbStack is running."
            )

        # Ensure workspace directory exists
        workspace_dir = Path(self.config.get("workspace_dir", "/tmp/sandboxes"))
        workspace_dir = workspace_dir.expanduser()
        workspace_dir.mkdir(parents=True, exist_ok=True)
        self.config["workspace_dir"] = str(workspace_dir)

    def _generate_sandbox_id(self) -> str:
        """Generate unique sandbox ID."""
        return f"sbx_{uuid.uuid4().hex[:12]}"

    def _get_image_name(self, template: Optional[str]) -> str:
        """Get Docker image name for template."""
        template = template or "base"
        prefix = self.config.get("image_prefix", "agent-sandbox")
        return f"{prefix}-{template}:latest"

    def _get_container(self, sandbox_id: str) -> docker.models.containers.Container:
        """Get container by sandbox ID."""
        if sandbox_id in self._active_containers:
            return self._active_containers[sandbox_id]["container"]

        try:
            return self.client.containers.get(sandbox_id)
        except NotFound:
            raise SandboxNotFoundError(f"Container not found: {sandbox_id}")

    def _map_status(self, docker_status: str) -> SandboxStatus:
        """Map Docker status to SandboxStatus."""
        mapping = {
            "running": SandboxStatus.RUNNING,
            "paused": SandboxStatus.PAUSED,
            "exited": SandboxStatus.STOPPED,
            "created": SandboxStatus.CREATING,
            "restarting": SandboxStatus.CREATING,
            "removing": SandboxStatus.STOPPED,
            "dead": SandboxStatus.ERROR,
        }
        return mapping.get(docker_status, SandboxStatus.ERROR)

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
        """Create OrbStack container sandbox."""
        sandbox_id = self._generate_sandbox_id()
        image_name = self._get_image_name(template)

        logger.info(f"Creating OrbStack sandbox: {sandbox_id} with image {image_name}")

        try:
            # Create workspace directory
            workspace = Path(self.config["workspace_dir"]) / sandbox_id
            workspace.mkdir(parents=True, exist_ok=True)

            # Prepare labels
            labels = {
                f"{self.LABEL_PREFIX}.sandbox_id": sandbox_id,
                f"{self.LABEL_PREFIX}.created_by": "agent-sandbox-cli",
                f"{self.LABEL_PREFIX}.template": template or "base",
                f"{self.LABEL_PREFIX}.created_at": datetime.utcnow().isoformat(),
            }
            if metadata:
                for k, v in metadata.items():
                    labels[f"{self.LABEL_PREFIX}.meta.{k}"] = v

            # Prepare container config
            container_config = {
                "name": sandbox_id,
                "image": image_name,
                "detach": True,
                "tty": True,
                "stdin_open": True,
                "working_dir": "/workspace",
                "volumes": {str(workspace): {"bind": "/workspace", "mode": "rw"}},
                "environment": envs or {},
                "labels": labels,
            }

            # Add resource limits if configured
            resource_limits = self.config.get("resource_limits", {})
            if resource_limits:
                container_config["mem_limit"] = resource_limits.get("memory", "512m")
                if "cpu_quota" in resource_limits:
                    container_config["cpu_quota"] = resource_limits["cpu_quota"]
                if "cpu_period" in resource_limits:
                    container_config["cpu_period"] = resource_limits["cpu_period"]

            # Create and start container
            container = self.client.containers.run(**container_config)

            # Cache container reference
            self._active_containers[sandbox_id] = {
                "container": container,
                "workspace": workspace,
                "created_at": time.time(),
                "template": template,
                "metadata": metadata or {},
                "timeout": timeout,
            }

            logger.info(f"Created sandbox: {sandbox_id}")
            return sandbox_id

        except ImageNotFound:
            raise SandboxCreationError(
                f"Image not found: {image_name}. "
                f"Build it with: docker build -t {image_name} ."
            )
        except APIError as e:
            logger.error(f"Docker API error: {e}")
            raise SandboxCreationError(f"Failed to create container: {e}")
        except Exception as e:
            logger.error(f"Failed to create sandbox: {e}")
            raise SandboxCreationError(str(e))

    def connect_sandbox(self, sandbox_id: str) -> bool:
        """Connect to existing container."""
        try:
            container = self.client.containers.get(sandbox_id)
            if container.status != "running":
                container.start()

            # Get workspace path from labels or default
            labels = container.labels
            template = labels.get(f"{self.LABEL_PREFIX}.template", "base")

            self._active_containers[sandbox_id] = {
                "container": container,
                "workspace": Path(self.config["workspace_dir"]) / sandbox_id,
                "template": template,
                "reconnected": True,
            }
            return True

        except NotFound:
            raise SandboxNotFoundError(f"Container not found: {sandbox_id}")

    def get_sandbox_info(self, sandbox_id: str) -> SandboxInfo:
        """Get container information."""
        container = self._get_container(sandbox_id)
        container.reload()  # Refresh container state

        labels = container.labels
        metadata = {}
        for key, value in labels.items():
            if key.startswith(f"{self.LABEL_PREFIX}.meta."):
                meta_key = key[len(f"{self.LABEL_PREFIX}.meta.") :]
                metadata[meta_key] = value

        return SandboxInfo(
            sandbox_id=sandbox_id,
            backend_type="orbstack",
            status=self._map_status(container.status),
            created_at=labels.get(
                f"{self.LABEL_PREFIX}.created_at", container.attrs["Created"]
            ),
            metadata=metadata,
            template=labels.get(f"{self.LABEL_PREFIX}.template"),
        )

    def is_sandbox_running(self, sandbox_id: str) -> bool:
        """Check if container is running."""
        try:
            container = self._get_container(sandbox_id)
            container.reload()
            return container.status == "running"
        except SandboxNotFoundError:
            return False

    def kill_sandbox(self, sandbox_id: str) -> bool:
        """Kill and remove container."""
        try:
            container = self._get_container(sandbox_id)
            container.reload()

            if container.status == "running":
                container.kill()

            container.remove(force=True)

            # Cleanup workspace if configured
            if self.config.get("cleanup_workspace", False):
                workspace = Path(self.config["workspace_dir"]) / sandbox_id
                if workspace.exists():
                    import shutil

                    shutil.rmtree(workspace)

            if sandbox_id in self._active_containers:
                del self._active_containers[sandbox_id]

            logger.info(f"Killed sandbox: {sandbox_id}")
            return True

        except NotFound:
            logger.warning(f"Container not found for kill: {sandbox_id}")
            return False
        except Exception as e:
            logger.error(f"Failed to kill sandbox: {e}")
            return False

    def pause_sandbox(self, sandbox_id: str) -> bool:
        """Pause container."""
        try:
            container = self._get_container(sandbox_id)
            container.pause()
            return True
        except Exception as e:
            logger.error(f"Failed to pause sandbox: {e}")
            return False

    def resume_sandbox(self, sandbox_id: str) -> bool:
        """Resume paused container."""
        try:
            container = self._get_container(sandbox_id)
            container.unpause()
            return True
        except Exception as e:
            logger.error(f"Failed to resume sandbox: {e}")
            return False

    def list_sandboxes(self, limit: int = 20) -> list[SandboxInfo]:
        """List all sandbox containers."""
        containers = self.client.containers.list(
            all=True,
            filters={"label": f"{self.LABEL_PREFIX}.created_by=agent-sandbox-cli"},
            limit=limit,
        )

        sandboxes = []
        for c in containers:
            labels = c.labels
            metadata = {}
            for key, value in labels.items():
                if key.startswith(f"{self.LABEL_PREFIX}.meta."):
                    meta_key = key[len(f"{self.LABEL_PREFIX}.meta.") :]
                    metadata[meta_key] = value

            sandboxes.append(
                SandboxInfo(
                    sandbox_id=c.name,
                    backend_type="orbstack",
                    status=self._map_status(c.status),
                    created_at=labels.get(f"{self.LABEL_PREFIX}.created_at", ""),
                    metadata=metadata,
                    template=labels.get(f"{self.LABEL_PREFIX}.template"),
                )
            )

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
        """Execute command in container."""
        container = self._get_container(sandbox_id)

        # Prepare command
        if shell:
            cmd = ["/bin/sh", "-c", command]
        else:
            cmd = command.split() if isinstance(command, str) else command

        try:
            exec_result = container.exec_run(
                cmd,
                workdir=cwd or "/workspace",
                environment=envs,
                demux=True,  # Separate stdout/stderr
            )

            exit_code = exec_result.exit_code
            stdout = ""
            stderr = ""

            if exec_result.output:
                if isinstance(exec_result.output, tuple):
                    stdout = (
                        exec_result.output[0].decode("utf-8", errors="replace")
                        if exec_result.output[0]
                        else ""
                    )
                    stderr = (
                        exec_result.output[1].decode("utf-8", errors="replace")
                        if exec_result.output[1]
                        else ""
                    )
                else:
                    stdout = exec_result.output.decode("utf-8", errors="replace")

            return CommandResult(
                stdout=stdout.strip(),
                stderr=stderr.strip(),
                exit_code=exit_code,
            )

        except Exception as e:
            raise CommandExecutionError(f"Command failed: {e}")

    def run_command_background(
        self,
        sandbox_id: str,
        command: str,
        cwd: Optional[str] = None,
        envs: Optional[dict[str, str]] = None,
    ) -> CommandResult:
        """Run command in background (detached)."""
        container = self._get_container(sandbox_id)

        # Wrap command to run in background
        bg_command = f"nohup {command} > /dev/null 2>&1 & echo $!"
        cmd = ["/bin/sh", "-c", bg_command]

        try:
            exec_result = container.exec_run(
                cmd,
                workdir=cwd or "/workspace",
                environment=envs,
                detach=False,  # We need the PID
            )

            pid = exec_result.output.decode().strip() if exec_result.output else None

            return CommandResult(
                stdout="",
                stderr="",
                exit_code=0,
                pid=pid,
            )

        except Exception as e:
            raise CommandExecutionError(f"Background command failed: {e}")

    # =========================================================================
    # File Operations
    # =========================================================================

    def list_files(
        self, sandbox_id: str, path: str = "/workspace", depth: int = 1
    ) -> list[FileInfo]:
        """List files in directory."""
        container = self._get_container(sandbox_id)

        # Use find command to list files
        cmd = f"find {path} -maxdepth {depth} -printf '%y %s %m %p\\n' 2>/dev/null"
        result = container.exec_run(["/bin/sh", "-c", cmd])

        files = []
        if result.output:
            for line in result.output.decode().split("\n"):
                if not line.strip():
                    continue

                parts = line.split(None, 3)
                if len(parts) < 4:
                    continue

                file_type, size, perms, filepath = parts
                file_type = "dir" if file_type == "d" else "file"

                files.append(
                    FileInfo(
                        name=os.path.basename(filepath),
                        path=filepath,
                        type=file_type,
                        size=int(size),
                        permissions=perms,
                    )
                )

        return files

    def read_file(self, sandbox_id: str, path: str) -> str:
        """Read text file content."""
        data = self.read_file_bytes(sandbox_id, path)
        return data.decode("utf-8")

    def read_file_bytes(self, sandbox_id: str, path: str) -> bytes:
        """Read binary file from container using docker cp."""
        container = self._get_container(sandbox_id)

        try:
            bits, stat = container.get_archive(path)

            # Extract from tar
            tar_stream = io.BytesIO()
            for chunk in bits:
                tar_stream.write(chunk)
            tar_stream.seek(0)

            with tarfile.open(fileobj=tar_stream) as tar:
                member = tar.getmembers()[0]
                file_obj = tar.extractfile(member)
                if file_obj:
                    return file_obj.read()
                raise FileOperationError(f"Could not read file: {path}")

        except NotFound:
            raise FileOperationError(f"File not found: {path}")
        except Exception as e:
            raise FileOperationError(f"Failed to read file: {e}")

    def write_file(self, sandbox_id: str, path: str, content: str) -> FileInfo:
        """Write text file to container."""
        return self.write_file_bytes(sandbox_id, path, content.encode("utf-8"))

    def write_file_bytes(self, sandbox_id: str, path: str, data: bytes) -> FileInfo:
        """Write binary file to container using docker cp."""
        container = self._get_container(sandbox_id)

        try:
            # Create tar archive with file
            tar_stream = io.BytesIO()
            tar_info = tarfile.TarInfo(name=os.path.basename(path))
            tar_info.size = len(data)

            with tarfile.open(fileobj=tar_stream, mode="w") as tar:
                tar.addfile(tar_info, io.BytesIO(data))

            tar_stream.seek(0)

            # Put archive in container
            directory = os.path.dirname(path) or "/workspace"
            container.put_archive(directory, tar_stream)

            return FileInfo(
                name=os.path.basename(path),
                path=path,
                type="file",
                size=len(data),
                permissions="644",
            )

        except Exception as e:
            raise FileOperationError(f"Failed to write file: {e}")

    def file_exists(self, sandbox_id: str, path: str) -> bool:
        """Check if file exists."""
        container = self._get_container(sandbox_id)
        result = container.exec_run(["/bin/sh", "-c", f"test -e {path} && echo yes"])
        return b"yes" in result.output if result.output else False

    def get_file_info(self, sandbox_id: str, path: str) -> FileInfo:
        """Get file information."""
        container = self._get_container(sandbox_id)

        cmd = f"stat -c '%F %s %a %n' {path} 2>/dev/null"
        result = container.exec_run(["/bin/sh", "-c", cmd])

        if result.exit_code != 0:
            raise FileOperationError(f"File not found: {path}")

        parts = result.output.decode().strip().split(None, 3)
        if len(parts) < 4:
            raise FileOperationError(f"Could not parse file info: {path}")

        file_type = "dir" if "directory" in parts[0].lower() else "file"

        return FileInfo(
            name=os.path.basename(parts[3]),
            path=parts[3],
            type=file_type,
            size=int(parts[1]),
            permissions=parts[2],
        )

    def remove_file(self, sandbox_id: str, path: str) -> None:
        """Remove file or directory."""
        container = self._get_container(sandbox_id)
        result = container.exec_run(["/bin/sh", "-c", f"rm -rf {path}"])
        if result.exit_code != 0:
            raise FileOperationError(f"Failed to remove: {path}")

    def make_directory(self, sandbox_id: str, path: str) -> bool:
        """Create directory."""
        container = self._get_container(sandbox_id)
        result = container.exec_run(["/bin/sh", "-c", f"mkdir -p {path}"])
        return result.exit_code == 0

    def rename_file(self, sandbox_id: str, old_path: str, new_path: str) -> FileInfo:
        """Rename/move file."""
        container = self._get_container(sandbox_id)
        result = container.exec_run(["/bin/sh", "-c", f"mv {old_path} {new_path}"])
        if result.exit_code != 0:
            raise FileOperationError(f"Failed to rename: {old_path} -> {new_path}")
        return self.get_file_info(sandbox_id, new_path)

    # =========================================================================
    # Network Operations
    # =========================================================================

    def get_host(self, sandbox_id: str, port: int) -> str:
        """Get public URL for container port."""
        # For local Docker/OrbStack, just use localhost
        return f"http://localhost:{port}"

    # =========================================================================
    # Health Check
    # =========================================================================

    def health_check(self) -> dict[str, Any]:
        """Check Docker/OrbStack health."""
        try:
            info = self.client.info()
            return {
                "status": "healthy",
                "backend": "orbstack",
                "docker_version": info.get("ServerVersion"),
                "containers_running": info.get("ContainersRunning", 0),
                "containers_total": info.get("Containers", 0),
                "images": len(self.client.images.list()),
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "backend": "orbstack",
                "error": str(e),
            }
