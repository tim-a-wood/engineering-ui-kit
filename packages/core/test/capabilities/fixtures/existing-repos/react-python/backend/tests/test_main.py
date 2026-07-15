from app.main import get_dashboard


def test_get_dashboard():
    assert get_dashboard() == {"widgets": []}
