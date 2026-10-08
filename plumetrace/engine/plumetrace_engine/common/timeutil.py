"""
OWNER    : Tejas
DUE      : D1 12:00
TASK     :
  UTC helpers: run_id <-> datetime ('2026-10-09T00Z'), iso_z(dt), valid_hours(run_id, 0..72), lead_h(valid, issue), to_ist(dt). All tz-aware.
DONE WHEN: Unit-tested round trips.
GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE

Conventions (brief §7):
  - Everything stored/returned in UTC, ISO-8601 with a trailing ``Z``.
  - ``run_id``     = the GFS cycle, minute-less hour precision, e.g. ``2026-10-09T00Z``.
  - ``valid_hour`` = the hour a forecast applies to, minute precision, e.g. ``2026-10-09T08:00Z``.
  - IST (UTC+05:30) is only ever produced for the UI / generated text, never stored.
  - Function args take/return tz-aware ``datetime``; naive inputs are assumed UTC.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

UTC = timezone.utc
IST = timezone(timedelta(hours=5, minutes=30))

# run_id carries only the cycle hour; valid_hour / issued_at carry minutes (brief examples).
RUN_ID_FMT = "%Y-%m-%dT%HZ"
ISO_MIN_FMT = "%Y-%m-%dT%H:%MZ"


def _ensure_utc(dt: datetime) -> datetime:
    """Return a tz-aware UTC datetime; a naive input is assumed to be UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def run_id_to_dt(run_id: str) -> datetime:
    """'2026-10-09T00Z' -> aware UTC datetime at that cycle hour."""
    return datetime.strptime(run_id, RUN_ID_FMT).replace(tzinfo=UTC)


def dt_to_run_id(dt: datetime) -> str:
    """Aware/naive datetime -> run_id string. Truncates to the hour."""
    return _ensure_utc(dt).strftime(RUN_ID_FMT)


def iso_z(dt: datetime) -> str:
    """Aware/naive datetime -> ISO-8601 minute-precision string with Z (brief §7)."""
    return _ensure_utc(dt).strftime(ISO_MIN_FMT)


def parse_z(s: str) -> datetime:
    """Parse a run_id, a valid_hour, or a full ISO-8601 ``...Z`` string to aware UTC."""
    s = s.strip()
    for fmt in (RUN_ID_FMT, ISO_MIN_FMT, "%Y-%m-%dT%H:%M:%SZ"):
        try:
            return datetime.strptime(s, fmt).replace(tzinfo=UTC)
        except ValueError:
            continue
    # Last resort: let fromisoformat handle offsets like +00:00 / Z (py3.11+).
    return _ensure_utc(datetime.fromisoformat(s.replace("Z", "+00:00")))


def valid_hours(run_id: str, start: int = 0, end: int = 72) -> list[str]:
    """valid_hour strings for every lead hour in [start, end] inclusive of a run."""
    issue = run_id_to_dt(run_id)
    return [iso_z(issue + timedelta(hours=h)) for h in range(start, end + 1)]


def lead_h(valid, issue) -> int:
    """Integer lead hours = valid - issue. Accepts datetimes or Z strings."""
    v = valid if isinstance(valid, datetime) else parse_z(valid)
    i = issue if isinstance(issue, datetime) else parse_z(issue)
    delta = _ensure_utc(v) - _ensure_utc(i)
    return round(delta.total_seconds() / 3600.0)


def to_ist(dt: datetime) -> datetime:
    """Aware/naive UTC datetime -> aware IST datetime (UI / generated text only)."""
    return _ensure_utc(dt).astimezone(IST)
