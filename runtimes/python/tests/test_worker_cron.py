"""Cron next-run computation is correct under an injected/fixed clock
(§10.3 "portable five-field cron ... explicit timezone").
"""

from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import pytest

from engineering_ui_capabilities_runtime.worker.cron import CronSchedule, InvalidCronExpressionError


def test_every_minute_schedule_advances_by_one_minute() -> None:
    schedule = CronSchedule.parse("* * * * *", timezone="UTC")
    after = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)

    next_run = schedule.next_run_after(after)

    assert next_run == datetime(2026, 1, 1, 12, 1, tzinfo=timezone.utc)


def test_daily_schedule_jumps_to_the_next_day_at_the_configured_time() -> None:
    schedule = CronSchedule.parse("30 9 * * *", timezone="UTC")
    after = datetime(2026, 1, 1, 10, 0, tzinfo=timezone.utc)

    next_run = schedule.next_run_after(after)

    assert next_run == datetime(2026, 1, 2, 9, 30, tzinfo=timezone.utc)


def test_daily_schedule_fires_later_today_if_the_time_has_not_yet_passed() -> None:
    schedule = CronSchedule.parse("30 9 * * *", timezone="UTC")
    after = datetime(2026, 1, 1, 8, 0, tzinfo=timezone.utc)

    next_run = schedule.next_run_after(after)

    assert next_run == datetime(2026, 1, 1, 9, 30, tzinfo=timezone.utc)


def test_weekly_schedule_matches_the_correct_day_of_week() -> None:
    # "0 0 * * 1" => every Monday at midnight. 2026-01-01 is a Thursday.
    schedule = CronSchedule.parse("0 0 * * 1", timezone="UTC")
    after = datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc)

    next_run = schedule.next_run_after(after)

    assert next_run == datetime(2026, 1, 5, 0, 0, tzinfo=timezone.utc)
    assert next_run.weekday() == 0  # Monday


def test_monthly_schedule_crosses_a_year_boundary() -> None:
    schedule = CronSchedule.parse("0 0 1 1 *", timezone="UTC")
    after = datetime(2026, 3, 15, tzinfo=timezone.utc)

    next_run = schedule.next_run_after(after)

    assert next_run == datetime(2027, 1, 1, 0, 0, tzinfo=timezone.utc)


def test_day_of_month_and_day_of_week_are_ored_when_both_restricted() -> None:
    # "0 0 1 * 1" => the 1st of the month, OR any Monday.
    schedule = CronSchedule.parse("0 0 1 * 1", timezone="UTC")
    # 2026-01-02 is a Friday; the next matching day should be Monday 2026-01-05
    # (before the 1st of February), because day-of-week alone satisfies the OR.
    after = datetime(2026, 1, 2, tzinfo=timezone.utc)

    next_run = schedule.next_run_after(after)

    assert next_run == datetime(2026, 1, 5, 0, 0, tzinfo=timezone.utc)


def test_explicit_timezone_is_honored_independent_of_input_timezone() -> None:
    schedule = CronSchedule.parse("0 9 * * *", timezone="America/New_York")
    # 14:00 UTC on 2026-01-01 is 09:00 America/New_York (EST, UTC-5) that same day,
    # so the schedule's 09:00-local trigger has already passed; expect tomorrow.
    after = datetime(2026, 1, 1, 14, 0, tzinfo=timezone.utc)

    next_run = schedule.next_run_after(after)

    assert next_run.tzinfo == ZoneInfo("America/New_York")
    assert next_run == datetime(2026, 1, 2, 9, 0, tzinfo=ZoneInfo("America/New_York"))


def test_naive_after_is_treated_as_already_in_the_schedule_timezone() -> None:
    schedule = CronSchedule.parse("0 9 * * *", timezone="America/New_York")
    after = datetime(2026, 1, 1, 8, 0)  # naive

    next_run = schedule.next_run_after(after)

    assert next_run == datetime(2026, 1, 1, 9, 0, tzinfo=ZoneInfo("America/New_York"))


@pytest.mark.parametrize(
    "expression",
    [
        "* * * *",  # too few fields
        "60 * * * *",  # minute out of range
        "* 24 * * *",  # hour out of range
        "* * 0 * *",  # day-of-month out of range (min is 1)
        "* * * 13 *",  # month out of range
        "* * * * 7",  # day-of-week out of range (max is 6)
    ],
)
def test_invalid_cron_expressions_are_rejected_at_parse_time(expression: str) -> None:
    with pytest.raises(InvalidCronExpressionError):
        CronSchedule.parse(expression, timezone="UTC")


def test_step_and_range_and_list_fields_are_supported() -> None:
    # Every 15 minutes, between hours 9-11 inclusive, on the 1st or 15th.
    schedule = CronSchedule.parse("*/15 9-11 1,15 * *", timezone="UTC")
    after = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)

    next_run = schedule.next_run_after(after)

    assert next_run == datetime(2026, 1, 1, 9, 15, tzinfo=timezone.utc)


def test_unsatisfiable_schedule_raises_rather_than_looping_forever() -> None:
    # February never has a 30th day.
    schedule = CronSchedule.parse("0 0 30 2 *", timezone="UTC")
    after = datetime(2026, 1, 1, tzinfo=timezone.utc)

    with pytest.raises(InvalidCronExpressionError):
        schedule.next_run_after(after)
