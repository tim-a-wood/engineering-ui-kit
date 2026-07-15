"""Core widget logic used by the existing-repo migration fixture."""


def build_widget(name: str) -> dict:
    return {"name": name, "kind": "widget"}
