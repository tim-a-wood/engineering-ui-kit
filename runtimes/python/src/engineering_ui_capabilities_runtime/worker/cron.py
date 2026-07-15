"""Portable five-field cron schedule model + next-run computation (§10.3
"Schedule: portable five-field cron, explicit timezone").

Fields, in order: `minute hour day-of-month month day-of-week`, each
supporting `*`, single values, `a-b` ranges, `a,b,c` lists, and `*/n` or
`a-b/n` steps. `day-of-week` uses the conventional cron numbering
(0 = Sunday .. 6 = Saturday). When both `day-of-month` and `day-of-week`
are restricted (not `*`), a day matches if *either* field matches — the
standard (if surprising) cron rule.

The timezone is always explicit and carried on the schedule itself (never
inferred from the host's local time), per §10.3/§15.4.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

#: Bounds how many day/hour/minute transitions `next_run_after` will walk
#: before giving up. Because the search jumps whole months/days/hours when
#: a field cannot match (rather than always stepping one minute), this
#: comfortably covers even sparse schedules (e.g. a specific day-of-month
#: and month combination) across several years without a real risk of a
#: slow or unbounded loop.
_MAX_SEARCH_STEPS = 200_000


class InvalidCronExpressionError(ValueError):
    pass


def _parse_field(field: str, min_value: int, max_value: int) -> frozenset[int]:
    values: set[int] = set()
    for part in field.split(","):
        if not part:
            raise InvalidCronExpressionError(f"Empty cron field component in {field!r}")
        range_part, sep, step_text = part.partition("/")
        step = 1
        if sep:
            try:
                step = int(step_text)
            except ValueError as exc:
                raise InvalidCronExpressionError(f"Invalid step {step_text!r} in cron field {field!r}") from exc
            if step <= 0:
                raise InvalidCronExpressionError(f"Cron step must be positive in {field!r}")
        if range_part == "*":
            start, end = min_value, max_value
        elif "-" in range_part:
            start_text, _, end_text = range_part.partition("-")
            try:
                start, end = int(start_text), int(end_text)
            except ValueError as exc:
                raise InvalidCronExpressionError(f"Invalid range {range_part!r} in cron field {field!r}") from exc
        else:
            try:
                start = end = int(range_part)
            except ValueError as exc:
                raise InvalidCronExpressionError(f"Invalid value {range_part!r} in cron field {field!r}") from exc
        if start > end or start < min_value or end > max_value:
            raise InvalidCronExpressionError(
                f"Cron field {field!r} value out of range (expected {min_value}-{max_value})"
            )
        values.update(range(start, end + 1, step))
    if not values:
        raise InvalidCronExpressionError(f"Cron field {field!r} produced no allowed values")
    return frozenset(values)


def _cron_day_of_week(dt: datetime) -> int:
    """`datetime.weekday()` is Monday=0..Sunday=6; cron convention is
    Sunday=0..Saturday=6.
    """

    return (dt.weekday() + 1) % 7


def _start_of_next_month(dt: datetime) -> datetime:
    year, month = (dt.year + 1, 1) if dt.month == 12 else (dt.year, dt.month + 1)
    return dt.replace(year=year, month=month, day=1, hour=0, minute=0, second=0, microsecond=0)


def _start_of_next_day(dt: datetime) -> datetime:
    return (dt + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)


def _start_of_next_hour(dt: datetime) -> datetime:
    return (dt + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)


@dataclass(frozen=True)
class CronSchedule:
    """A parsed, validated five-field cron expression bound to an explicit
    IANA timezone.
    """

    minute: str
    hour: str
    day_of_month: str
    month: str
    day_of_week: str
    timezone: str

    @classmethod
    def parse(cls, expression: str, timezone: str) -> "CronSchedule":
        fields = expression.split()
        if len(fields) != 5:
            raise InvalidCronExpressionError(
                f"Cron expression must have exactly 5 fields (minute hour day-of-month month day-of-week), "
                f"got {len(fields)}: {expression!r}"
            )
        minute, hour, day_of_month, month, day_of_week = fields
        # Validate eagerly so a malformed schedule fails at composition
        # time, not on the first scheduler poll.
        _parse_field(minute, 0, 59)
        _parse_field(hour, 0, 23)
        _parse_field(day_of_month, 1, 31)
        _parse_field(month, 1, 12)
        _parse_field(day_of_week, 0, 6)
        # Validate the timezone name eagerly too.
        ZoneInfo(timezone)
        return cls(minute, hour, day_of_month, month, day_of_week, timezone)

    def next_run_after(self, after: datetime) -> datetime:
        """The next instant strictly after `after` that matches this
        schedule, expressed in this schedule's own timezone. `after` may be
        naive (assumed to already be in this schedule's timezone) or
        tz-aware (converted).
        """

        tz = ZoneInfo(self.timezone)
        anchor = after.replace(tzinfo=tz) if after.tzinfo is None else after.astimezone(tz)

        minutes_allowed = _parse_field(self.minute, 0, 59)
        hours_allowed = _parse_field(self.hour, 0, 23)
        doms_allowed = _parse_field(self.day_of_month, 1, 31)
        months_allowed = _parse_field(self.month, 1, 12)
        dows_allowed = _parse_field(self.day_of_week, 0, 6)
        dom_restricted = self.day_of_month != "*"
        dow_restricted = self.day_of_week != "*"

        candidate = (anchor + timedelta(minutes=1)).replace(second=0, microsecond=0)

        for _ in range(_MAX_SEARCH_STEPS):
            if candidate.month not in months_allowed:
                candidate = _start_of_next_month(candidate)
                continue

            dom_ok = candidate.day in doms_allowed
            dow_ok = _cron_day_of_week(candidate) in dows_allowed
            if dom_restricted and dow_restricted:
                day_matches = dom_ok or dow_ok
            elif dom_restricted:
                day_matches = dom_ok
            elif dow_restricted:
                day_matches = dow_ok
            else:
                day_matches = True
            if not day_matches:
                candidate = _start_of_next_day(candidate)
                continue

            if candidate.hour not in hours_allowed:
                candidate = _start_of_next_hour(candidate)
                continue

            if candidate.minute not in minutes_allowed:
                candidate = candidate + timedelta(minutes=1)
                continue

            return candidate

        raise InvalidCronExpressionError(
            f"Could not find a matching run for schedule {self!r} within {_MAX_SEARCH_STEPS} search steps "
            "(the schedule may be unsatisfiable, e.g. day-of-month 31 in a month field restricted to February)."
        )
