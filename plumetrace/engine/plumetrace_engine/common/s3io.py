"""
OWNER    : Tejas
DUE      : D1 13:00
TASK     :
  S3 I/O helpers + key builders for EVERY path in brief §8.2 (key_raw_gfs(run_id, fff), key_curated_fires(date), key_outputs(run_id, name), ...).
  put_json/get_json/put_parquet/get_parquet/put_netcdf/open_netcdf/presign.
  LOCAL MODE: if PT_LOCAL=1, read/write ./.local-s3/<key> instead of S3 — lets Yasho1 & Khare run everything offline.
DONE WHEN: Yasho1 never writes an S3 key string by hand.
GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE

Nobody hand-writes an S3 key: build it with the key_* helpers below, then call
put_*/get_*/open_*/presign. Those route to S3 or, when PT_LOCAL=1, to ./.local-s3/.

Env vars:
  PT_LOCAL=1       -> use the local filesystem (default root ./.local-s3, override PT_LOCAL_ROOT)
  PT_BUCKET=<name> -> target S3 bucket (required in cloud mode)

Heavy deps (pandas, xarray) are imported lazily so JSON/bytes paths work with a
minimal environment and so this module imports cleanly in Lambdas that don't need them.
"""
from __future__ import annotations

import io
import json
import os
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Mode / client
# ---------------------------------------------------------------------------

def local_mode() -> bool:
    return os.environ.get("PT_LOCAL", "") not in ("", "0", "false", "False")


def local_root() -> Path:
    return Path(os.environ.get("PT_LOCAL_ROOT", "./.local-s3")).resolve()


def bucket() -> str:
    b = os.environ.get("PT_BUCKET")
    if not b:
        raise RuntimeError("PT_BUCKET is not set (cloud mode). Set PT_LOCAL=1 for offline dev.")
    return b


_S3 = None


def _s3():
    global _S3
    if _S3 is None:
        import boto3  # lazy: not needed in local mode

        _S3 = boto3.client("s3")
    return _S3


def _local_path(key: str) -> Path:
    """Map an S3 key to a Windows-safe path under the local root (':' -> '-')."""
    safe = key.replace(":", "-")
    return local_root() / safe


# ---------------------------------------------------------------------------
# Key builders (brief §8.2, plus D-10 additions)
# ---------------------------------------------------------------------------

def key_raw_firms(date: str, source: str, fetch_ts: str) -> str:
    return f"raw/firms/date={date}/{source}-{fetch_ts}.csv"


def key_raw_gfs(run_id: str, fff: int) -> str:
    return f"raw/gfs/run={run_id}/f{fff:03d}.nc"


def key_raw_openaq(date: str, location_id: str | int) -> str:
    return f"raw/openaq/date={date}/{location_id}.json"


def key_raw_era5(*parts: str) -> str:
    return "raw/era5/" + "/".join(str(p).strip("/") for p in parts)


def key_curated_fires(date: str) -> str:
    return f"curated/fires/date={date}/fires.parquet"


def key_curated_obs(date: str) -> str:
    return f"curated/obs/date={date}/pm25.parquet"


def key_stations() -> str:  # D-10
    return "curated/stations/stations.json"


def key_features(run_id: str) -> str:
    return f"features/run={run_id}/station_features.parquet"


def key_model(model_version: str, name: str) -> str:
    """name e.g. 'q10'/'q50'/'q90' (-> .txt) or 'metadata' (-> .json)."""
    ext = "json" if name == "metadata" else "txt"
    return f"models/lightgbm/{model_version}/{name}.{ext}"


def key_outputs(run_id: str, name: str) -> str:
    """Generic outputs/ key, e.g. name='summary.json' or 'trajectories.geojson'."""
    return f"outputs/run={run_id}/{name}"


def key_outputs_trajectories(run_id: str) -> str:
    return key_outputs(run_id, "trajectories.geojson")


def key_outputs_pm25_h3(run_id: str, valid_hour: str) -> str:
    return key_outputs(run_id, f"pm25_h3_{valid_hour}.geojson")


def key_outputs_summary(run_id: str) -> str:
    return key_outputs(run_id, "summary.json")


def key_outputs_fires_48h(run_id: str) -> str:  # D-10
    return key_outputs(run_id, "fires_48h.geojson")


def key_latest_pointer() -> str:  # D-10
    return "outputs/latest.json"


def key_skill(which: str = "latest") -> str:  # D-10
    if which not in ("latest", "backtest"):
        raise ValueError("key_skill(which) expects 'latest' or 'backtest'")
    return f"outputs/skill/{which}.json"


def key_report(action_id: str, ext: str = "pdf") -> str:
    return f"reports/{action_id}.{ext}"


def key_audio(action_id: str) -> str:
    return f"audio/{action_id}.mp3"


def key_static(name: str) -> str:
    return f"static/{name}"


# ---------------------------------------------------------------------------
# Raw bytes / text
# ---------------------------------------------------------------------------

def put_bytes(key: str, data: bytes, content_type: str | None = None) -> str:
    if local_mode():
        p = _local_path(key)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
    else:
        extra = {"ContentType": content_type} if content_type else {}
        _s3().put_object(Bucket=bucket(), Key=key, Body=data, **extra)
    return key


def get_bytes(key: str) -> bytes:
    if local_mode():
        return _local_path(key).read_bytes()
    return _s3().get_object(Bucket=bucket(), Key=key)["Body"].read()


def put_text(key: str, text: str, content_type: str = "text/plain; charset=utf-8") -> str:
    return put_bytes(key, text.encode("utf-8"), content_type)


def get_text(key: str) -> str:
    return get_bytes(key).decode("utf-8")


def exists(key: str) -> bool:
    if local_mode():
        return _local_path(key).exists()
    import botocore  # lazy

    try:
        _s3().head_object(Bucket=bucket(), Key=key)
        return True
    except botocore.exceptions.ClientError as e:  # type: ignore[attr-defined]
        if e.response["Error"]["Code"] in ("404", "NoSuchKey", "NotFound"):
            return False
        raise


# ---------------------------------------------------------------------------
# JSON
# ---------------------------------------------------------------------------

def put_json(key: str, obj: Any, *, indent: int | None = None) -> str:
    text = json.dumps(obj, ensure_ascii=False, separators=(",", ":") if indent is None else None, indent=indent)
    return put_text(key, text, content_type="application/json")


def get_json(key: str) -> Any:
    return json.loads(get_text(key))


# ---------------------------------------------------------------------------
# Parquet (pandas; lazy)
# ---------------------------------------------------------------------------

def put_parquet(key: str, df) -> str:
    buf = io.BytesIO()
    df.to_parquet(buf, index=False)  # requires pyarrow
    return put_bytes(key, buf.getvalue(), content_type="application/octet-stream")


def get_parquet(key: str):
    import pandas as pd  # lazy

    return pd.read_parquet(io.BytesIO(get_bytes(key)))


# ---------------------------------------------------------------------------
# NetCDF (xarray; lazy — the GFS/ERA5 path)
# ---------------------------------------------------------------------------

def put_netcdf(key: str, ds) -> str:
    """Serialise an xarray Dataset to NetCDF bytes and store it."""
    data = ds.to_netcdf()  # returns bytes when no path is given
    return put_bytes(key, data, content_type="application/x-netcdf")


def open_netcdf(key: str):
    """Load an xarray Dataset from a stored NetCDF object (eager, in memory)."""
    import xarray as xr  # lazy

    return xr.open_dataset(io.BytesIO(get_bytes(key)))


# ---------------------------------------------------------------------------
# Presign
# ---------------------------------------------------------------------------

def presign(key: str, expires: int = 3600) -> str:
    """Presigned GET URL in cloud mode; a file:// URL to the local copy offline."""
    if local_mode():
        return _local_path(key).as_uri()
    return _s3().generate_presigned_url(
        "get_object", Params={"Bucket": bucket(), "Key": key}, ExpiresIn=expires
    )
