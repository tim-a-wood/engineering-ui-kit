"""Ensure both this example's `src/` layout and the runtime's `src/`
layout are importable for `pytest`, even when the editable install's
`.pth` file is not honored.

This machine's endpoint security tooling has been observed to mark newly
written files under `.venv/lib/*/site-packages/*.pth` with the macOS
`UF_HIDDEN` flag (`chflags hidden`), including re-applying it moments
after it is cleared. CPython's `site.addpackage()` explicitly skips
`.pth` files with that flag set, which silently drops the editable
install's `src` path from `sys.path` even though `pip install -e`
reported success (see `runtimes/python/conftest.py` for the same
workaround applied to the runtime's own test suite, and
`examples/capabilities-python-reference/conftest.py` for the identical
workaround copied verbatim there). Inserting the paths directly here is
unaffected by that flag, because pytest's normal module import machinery
does not consult it.
"""

from __future__ import annotations

import sys
from pathlib import Path

_THIS_DIR = Path(__file__).resolve().parent
_EXAMPLE_SRC = _THIS_DIR / "src"
_RUNTIME_SRC = _THIS_DIR.parent.parent / "runtimes" / "python" / "src"

for _path in (_EXAMPLE_SRC, _RUNTIME_SRC):
    if str(_path) not in sys.path:
        sys.path.insert(0, str(_path))
