from widgets.core import build_widget


def test_build_widget():
    widget = build_widget("gadget")
    assert widget == {"name": "gadget", "kind": "widget"}
