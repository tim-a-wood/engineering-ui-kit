"""Existing entry point (console script `widgets`). A migration plan must
wrap/extend this file, never replace it wholesale (CAP-ERA-001 §14.3)."""

from widgets.core import build_widget


def run() -> None:
    widget = build_widget("default")
    print(widget)


if __name__ == "__main__":
    run()
