"""Filesystem adapter foundation (§15.3 "Filesystem adapters use configured
roots and explicit read/write capabilities" + "All target paths are
repository-relative, normalized, and checked against traversal and symlink
escape").
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Union


class PathTraversalError(ValueError):
    """A requested relative path resolves outside the configured root
    (either via `..` segments or a symlink)."""


class FilesystemCapabilityError(PermissionError):
    """The adapter was not configured for the requested operation
    (read/write)."""


@dataclass(frozen=True)
class FilesystemCapability:
    can_read: bool = True
    can_write: bool = False


class FilesystemAdapter:
    """All paths passed to this adapter are relative to a single configured
    root; the resolved, real (symlink-following) path must remain under
    that root's resolved real path, or `PathTraversalError` is raised.
    """

    def __init__(self, root: Union[str, Path], capability: FilesystemCapability = FilesystemCapability()) -> None:
        self._root = Path(root).resolve()
        self._capability = capability

    @property
    def root(self) -> Path:
        return self._root

    def _resolve(self, relative_path: str) -> Path:
        if Path(relative_path).is_absolute():
            raise PathTraversalError(f"{relative_path!r} must be relative to the adapter's root, not absolute")
        candidate = (self._root / relative_path).resolve()
        try:
            candidate.relative_to(self._root)
        except ValueError as exc:
            raise PathTraversalError(
                f"{relative_path!r} resolves to {candidate}, which escapes the configured root {self._root}"
            ) from exc
        return candidate

    def exists(self, relative_path: str) -> bool:
        return self._resolve(relative_path).exists()

    def read_text(self, relative_path: str, encoding: str = "utf-8") -> str:
        if not self._capability.can_read:
            raise FilesystemCapabilityError("This adapter instance is not configured for read access")
        return self._resolve(relative_path).read_text(encoding=encoding)

    def read_bytes(self, relative_path: str) -> bytes:
        if not self._capability.can_read:
            raise FilesystemCapabilityError("This adapter instance is not configured for read access")
        return self._resolve(relative_path).read_bytes()

    def write_text(self, relative_path: str, content: str, encoding: str = "utf-8") -> None:
        if not self._capability.can_write:
            raise FilesystemCapabilityError("This adapter instance is not configured for write access")
        target = self._resolve(relative_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding=encoding)

    def write_bytes(self, relative_path: str, content: bytes) -> None:
        if not self._capability.can_write:
            raise FilesystemCapabilityError("This adapter instance is not configured for write access")
        target = self._resolve(relative_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
