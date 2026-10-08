"""
OWNER    : Tejas
DUE      : D1 14:00
TASK     :
  resolve_run(now) -> {run_id, cycle_dt}: newest GFS cycle in s3://noaa-gfs-bdp-pds whose f072 .idx exists (anonymous boto3). Accept manual override {run_id}.
DONE WHEN: Returns yesterday-18Z-ish when called at 03:00 UTC.
GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
  candidate_cycles() ordering is unit-tested (tests/engine/test_ingest_parsers.py).
  The f072.idx existence probe needs anonymous S3 + network; it runs for real in the
  ResolveRun Lambda. Behaviour at 03:00 UTC (returns the prior 18Z) follows from the
  newest-first candidate order plus that probe.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from plumetrace_engine.common import timeutil

log = logging.getLogger(__name__)

GFS_BUCKET = "noaa-gfs-bdp-pds"
CYCLE_HOURS = (0, 6, 12, 18)


def candidate_cycles(now: datetime | None = None, max_back_cycles: int = 8) -> list[str]:
    """
    GFS cycle run_ids at or before ``now`` (UTC), newest first. A GFS run appears
    ~3.5 h after its cycle, so the newest candidate is usually not complete yet;
    ``resolve_run`` walks this list and takes the first whose f072.idx exists.
    """
    now = now.astimezone(timezone.utc) if now else datetime.now(timezone.utc)
    # Most recent cycle hour at/before now.
    anchor = now.replace(minute=0, second=0, microsecond=0)
    while anchor.hour not in CYCLE_HOURS:
        anchor -= timedelta(hours=1)
    return [timeutil.dt_to_run_id(anchor - timedelta(hours=6 * i)) for i in range(max_back_cycles)]


def f072_idx_key(run_id: str) -> str:
    dt = timeutil.run_id_to_dt(run_id)
    ymd, hh = dt.strftime("%Y%m%d"), dt.strftime("%H")
    return f"gfs.{ymd}/{hh}/atmos/gfs.t{hh}z.pgrb2.0p25.f072.idx"


def _anon_s3():
    import boto3  # lazy
    from botocore import UNSIGNED
    from botocore.config import Config

    return boto3.client("s3", config=Config(signature_version=UNSIGNED))


def cycle_complete(run_id: str, s3=None) -> bool:
    """True when f072.idx exists for this cycle (i.e. the run is fully published)."""
    import botocore  # lazy

    s3 = s3 or _anon_s3()
    try:
        s3.head_object(Bucket=GFS_BUCKET, Key=f072_idx_key(run_id))
        return True
    except botocore.exceptions.ClientError as e:  # type: ignore[attr-defined]
        if e.response["Error"]["Code"] in ("404", "NoSuchKey", "NotFound"):
            return False
        raise


def resolve_run(now: datetime | None = None, run_id: str | None = None, max_back_cycles: int = 8) -> dict:
    """
    Pick the newest complete GFS cycle. A manual ``run_id`` override is returned as-is
    (used by `EngineRun` manual triggers and backfills).
    """
    if run_id:
        return {"run_id": run_id, "cycle_dt": timeutil.iso_z(timeutil.run_id_to_dt(run_id))}

    s3 = _anon_s3()
    for candidate in candidate_cycles(now, max_back_cycles):
        if cycle_complete(candidate, s3):
            log.info("resolved GFS run %s", candidate)
            return {"run_id": candidate, "cycle_dt": timeutil.iso_z(timeutil.run_id_to_dt(candidate))}
    raise RuntimeError(f"No complete GFS cycle (f072.idx) found in the last {max_back_cycles} cycles")
