"""Ensure the `src/` layout is importable for `pytest` even when the editable
install's `.pth` file is not honored.

This machine's endpoint security tooling has been observed to mark newly
written files under `.venv/lib/*/site-packages/*.pth` with the macOS
`UF_HIDDEN` flag (`chflags hidden`), including re-applying it moments after
it is cleared. CPython's `site.addpackage()` explicitly skips `.pth` files
with that flag set (see `site.py`), which silently drops the editable
install's `src` path from `sys.path` even though `pip install -e` reported
success. Inserting the path directly here is unaffected by that flag,
because pytest's normal module import machinery does not consult it.
"""

from __future__ import annotations

import sys
from pathlib import Path

_SRC = Path(__file__).resolve().parent / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))
