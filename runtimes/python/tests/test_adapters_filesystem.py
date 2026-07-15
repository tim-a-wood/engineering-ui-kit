"""Filesystem adapter: configured root, explicit read/write capability,
and traversal/symlink-escape rejection (§15.3).
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from engineering_ui_capabilities_runtime.adapters.filesystem import (
    FilesystemAdapter,
    FilesystemCapability,
    FilesystemCapabilityError,
    PathTraversalError,
)


@pytest.fixture()
def workspace(tmp_path: Path) -> Path:
    root = tmp_path / "workspace"
    root.mkdir()
    (root / "inside.txt").write_text("hello")
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "secret.txt").write_text("outside-content")
    return root


def test_read_text_reads_a_file_within_the_root(workspace: Path) -> None:
    adapter = FilesystemAdapter(workspace, FilesystemCapability(can_read=True))

    assert adapter.read_text("inside.txt") == "hello"


def test_read_without_read_capability_is_rejected(workspace: Path) -> None:
    adapter = FilesystemAdapter(workspace, FilesystemCapability(can_read=False))

    with pytest.raises(FilesystemCapabilityError):
        adapter.read_text("inside.txt")


def test_write_without_write_capability_is_rejected(workspace: Path) -> None:
    adapter = FilesystemAdapter(workspace, FilesystemCapability(can_read=True, can_write=False))

    with pytest.raises(FilesystemCapabilityError):
        adapter.write_text("new.txt", "content")


def test_write_with_write_capability_creates_the_file(workspace: Path) -> None:
    adapter = FilesystemAdapter(workspace, FilesystemCapability(can_read=True, can_write=True))

    adapter.write_text("nested/new.txt", "content")

    assert adapter.read_text("nested/new.txt") == "content"


def test_dot_dot_traversal_outside_the_root_is_rejected(workspace: Path) -> None:
    adapter = FilesystemAdapter(workspace, FilesystemCapability(can_read=True))

    with pytest.raises(PathTraversalError):
        adapter.read_text("../outside/secret.txt")


def test_absolute_path_is_rejected(workspace: Path) -> None:
    adapter = FilesystemAdapter(workspace, FilesystemCapability(can_read=True))

    with pytest.raises(PathTraversalError):
        adapter.read_text(str(workspace / "inside.txt"))


def test_symlink_escape_is_rejected(workspace: Path, tmp_path: Path) -> None:
    outside_target = tmp_path / "outside" / "secret.txt"
    link_path = workspace / "escape-link.txt"
    try:
        os.symlink(outside_target, link_path)
    except (OSError, NotImplementedError):
        pytest.skip("Symlinks are not supported in this environment")

    adapter = FilesystemAdapter(workspace, FilesystemCapability(can_read=True))

    with pytest.raises(PathTraversalError):
        adapter.read_text("escape-link.txt")


def test_exists_reports_false_for_a_missing_file(workspace: Path) -> None:
    adapter = FilesystemAdapter(workspace, FilesystemCapability(can_read=True))

    assert adapter.exists("missing.txt") is False
    assert adapter.exists("inside.txt") is True
