"""Lifecycle container scopes (CAP-ERA-001 SS10.2): `singleton` reused,
`transient` fresh every resolution, `request-job` scoped per request/job and
disposed in reverse creation order.
"""

from __future__ import annotations

from engineering_ui_capabilities_runtime.core import Container, ScopeRequiredError


class Widget:
    def __init__(self, label: str) -> None:
        self.label = label
        self.disposed = False


def test_singleton_is_reused_across_resolutions() -> None:
    container = Container()
    container.register_singleton("widget", lambda c: Widget("singleton"))

    first = container.resolve("widget")
    second = container.resolve("widget")

    assert first is second


def test_transient_creates_a_fresh_instance_every_resolution() -> None:
    container = Container()
    container.register_transient("widget", lambda c: Widget("transient"))

    first = container.resolve("widget")
    second = container.resolve("widget")

    assert first is not second


def test_request_job_is_scoped_per_request_and_shared_within_it() -> None:
    container = Container()
    container.register_request_job("widget", lambda c: Widget("request-job"))

    with container.create_scope() as request_scope_1:
        a = request_scope_1.resolve("widget")
        b = request_scope_1.resolve("widget")
        assert a is b

    with container.create_scope() as request_scope_2:
        c = request_scope_2.resolve("widget")

    assert a is not c


def test_request_job_requires_an_active_scope() -> None:
    container = Container()
    container.register_request_job("widget", lambda c: Widget("request-job"))

    try:
        container.resolve("widget")
    except ScopeRequiredError:
        pass
    else:
        raise AssertionError("resolving request-job without a scope must raise")


def test_request_job_factory_resolves_request_job_dependencies_from_the_same_scope() -> None:
    container = Container()
    container.register_request_job("dependency", lambda resolver: Widget("dependency"))
    container.register_request_job(
        "service",
        lambda resolver: (Widget("service"), resolver.resolve("dependency")),
    )

    with container.create_scope() as scope:
        service, dependency = scope.resolve("service")
        assert dependency is scope.resolve("dependency")


def test_scope_disposes_its_instances_in_reverse_creation_order() -> None:
    container = Container()
    disposed_order: list[str] = []
    container.register_request_job(
        "first", lambda c: Widget("first"), dispose=lambda w: disposed_order.append("first")
    )
    container.register_request_job(
        "second", lambda c: Widget("second"), dispose=lambda w: disposed_order.append("second")
    )

    scope = container.create_scope()
    scope.resolve("first")
    scope.resolve("second")
    scope.dispose()

    assert disposed_order == ["second", "first"]


def test_container_disposes_singletons_in_reverse_creation_order_on_shutdown() -> None:
    container = Container()
    disposed_order: list[str] = []
    container.register_singleton("db", lambda c: Widget("db"), dispose=lambda w: disposed_order.append("db"))
    container.register_singleton(
        "cache", lambda c: Widget("cache"), dispose=lambda w: disposed_order.append("cache")
    )

    container.resolve("db")
    container.resolve("cache")
    container.dispose()

    assert disposed_order == ["cache", "db"]
