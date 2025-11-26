"""File operations facade module."""

from typing import Optional

from ..backends import get_backend, FileInfo


def list_files(
    sandbox_id: str,
    path: str = "/workspace",
    depth: int = 1,
    backend_type: Optional[str] = None,
) -> list[FileInfo]:
    """List files in sandbox directory."""
    backend = get_backend(backend_type)
    return backend.list_files(sandbox_id, path, depth)


def read_file(
    sandbox_id: str,
    path: str,
    backend_type: Optional[str] = None,
) -> str:
    """Read text file from sandbox."""
    backend = get_backend(backend_type)
    return backend.read_file(sandbox_id, path)


def read_file_bytes(
    sandbox_id: str,
    path: str,
    backend_type: Optional[str] = None,
) -> bytes:
    """Read binary file from sandbox."""
    backend = get_backend(backend_type)
    return backend.read_file_bytes(sandbox_id, path)


def write_file(
    sandbox_id: str,
    path: str,
    content: str,
    backend_type: Optional[str] = None,
) -> FileInfo:
    """Write text file to sandbox."""
    backend = get_backend(backend_type)
    return backend.write_file(sandbox_id, path, content)


def write_file_bytes(
    sandbox_id: str,
    path: str,
    data: bytes,
    backend_type: Optional[str] = None,
) -> FileInfo:
    """Write binary file to sandbox."""
    backend = get_backend(backend_type)
    return backend.write_file_bytes(sandbox_id, path, data)


def file_exists(
    sandbox_id: str,
    path: str,
    backend_type: Optional[str] = None,
) -> bool:
    """Check if file exists in sandbox."""
    backend = get_backend(backend_type)
    return backend.file_exists(sandbox_id, path)


def get_file_info(
    sandbox_id: str,
    path: str,
    backend_type: Optional[str] = None,
) -> FileInfo:
    """Get file information."""
    backend = get_backend(backend_type)
    return backend.get_file_info(sandbox_id, path)


def remove_file(
    sandbox_id: str,
    path: str,
    backend_type: Optional[str] = None,
) -> None:
    """Remove file or directory from sandbox."""
    backend = get_backend(backend_type)
    backend.remove_file(sandbox_id, path)


def make_directory(
    sandbox_id: str,
    path: str,
    backend_type: Optional[str] = None,
) -> bool:
    """Create directory in sandbox."""
    backend = get_backend(backend_type)
    return backend.make_directory(sandbox_id, path)


def rename_file(
    sandbox_id: str,
    old_path: str,
    new_path: str,
    backend_type: Optional[str] = None,
) -> FileInfo:
    """Rename/move file in sandbox."""
    backend = get_backend(backend_type)
    return backend.rename_file(sandbox_id, old_path, new_path)
