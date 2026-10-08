"""
OWNER    : Yasho2
DUE      : D1 13:00
TASK     :
  Pydantic v2 models mirroring contracts/src/*.js 1:1 (same snake_case field names). Hand-written; tests/contracts/test_mocks_validate.py proves they agree with the mocks.
DONE WHEN: Every mock parses with the matching pydantic model.
GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""
from __future__ import annotations

from typing import Annotated, Any, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

# ---- primitive conventions (brief §7), mirror of dynamo.js ----
Utc = Annotated[str, StringConstraints(pattern=r"Z$")]
RunId = Annotated[str, StringConstraints(pattern=r"^\d{4}-\d{2}-\d{2}T\d{2}Z$")]
ValidHour = Annotated[str, StringConstraints(pattern=r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$")]
DateOnly = Annotated[str, StringConstraints(pattern=r"^\d{4}-\d{2}-\d{2}$")]
H3Cell = Annotated[str, StringConstraints(pattern=r"^[0-9a-f]{15,16}$")]
Share = Annotated[float, Field(ge=0, le=1)]
Pm25 = Annotated[float, Field(ge=0, le=2000)]
LeadH = Annotated[int, Field(ge=0, le=72)]

ACTION_TYPES = ("district_report", "farmer_alert", "shift_plan", "rider_notify")
ACTION_STATUSES = ("draft", "approved", "executed", "rejected", "failed")
LEAD_BUCKETS = ("0-6", "6-24", "24-48", "48-72")

ActionTypeT = Literal["district_report", "farmer_alert", "shift_plan", "rider_notify"]
ActionStatusT = Literal["draft", "approved", "executed", "rejected", "failed"]
LeadBucketT = Literal["0-6", "6-24", "24-48", "48-72"]

ACTION_STATUS_TRANSITIONS: dict[str, list[str]] = {
    "draft": ["approved", "rejected"],
    "approved": ["executed", "failed"],
    "executed": [],
    "rejected": [],
    "failed": [],
}


def can_transition(frm: str, to: str) -> bool:
    return to in ACTION_STATUS_TRANSITIONS.get(frm, [])


class _Base(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class TopSource(_Base):
    district: str
    share: Share


# ======================= DynamoDB items (§8.1) =======================
class ForecastItem(_Base):
    pk: Annotated[str, StringConstraints(pattern=r"^h3#")]
    sk: str
    run_id: RunId
    valid_hour: ValidHour
    h3: H3Cell
    pm25: Optional[Pm25]
    pm25_p10: Optional[Pm25]
    pm25_p90: Optional[Pm25]
    fire_share: Optional[Share]
    fire_share_p10: Optional[Share]
    fire_share_p90: Optional[Share]
    top_sources: Annotated[list[TopSource], Field(max_length=3)]
    hpbl_m: Optional[Annotated[float, Field(ge=0)]]
    lead_h: LeadH
    ttl: int


class StationForecastItem(_Base):
    pk: Annotated[str, StringConstraints(pattern=r"^station#")]
    sk: str
    run_id: RunId
    valid_hour: ValidHour
    station_id: str
    pm25_p10: Pm25
    pm25_p50: Pm25
    pm25_p90: Pm25
    fire_share_p10: Share
    fire_share_p50: Share
    fire_share_p90: Share
    obs_pm25: Optional[Pm25]
    lead_h: LeadH


class AttributionItem(_Base):
    pk: Annotated[str, StringConstraints(pattern=r"^date#")]
    sk: Annotated[str, StringConstraints(pattern=r"^district#")]
    date: DateOnly
    district: str
    share_p10: Share
    share_p50: Share
    share_p90: Share
    fire_count: Annotated[int, Field(ge=0)]
    frp_sum_mw: Annotated[float, Field(ge=0)]
    receptor_stations: list[str]


class ActionVerification(_Base):
    checked_at: Utc
    summary: str
    metrics: Optional[dict[str, float]] = None


class ActionItem(_Base):
    pk: Annotated[str, StringConstraints(pattern=r"^action#")]
    action_id: str
    type: ActionTypeT
    status: ActionStatusT
    payload: dict[str, Any]
    created_by: Literal["agent"]
    approved_by: Optional[str]
    run_id: Optional[RunId]
    created_at: Utc
    updated_at: Utc
    verification: Optional[ActionVerification] = None


class RiderItem(_Base):
    pk: Annotated[str, StringConstraints(pattern=r"^rider#")]
    rider_id: str
    name: str
    home_h3: H3Cell
    vehicle: Literal["2w"]
    dose_budget_ug: Annotated[float, Field(ge=0)]
    consent_health: bool
    consent_ts: Optional[Utc]


class RiderHealthItem(_Base):
    """NEVER returned over the API (§15)."""
    pk: Annotated[str, StringConstraints(pattern=r"^rider#")]
    rider_id: str
    conditions: list[str]
    budget_multiplier: Annotated[float, Field(ge=0, le=1)]


class PlannedStop(_Base):
    order_id: str
    h3: H3Cell
    eta: Utc


class ShiftItem(_Base):
    pk: Annotated[str, StringConstraints(pattern=r"^fleet#")]
    sk: Annotated[str, StringConstraints(pattern=r"^rider#")]
    fleet_id: str
    date: DateOnly
    rider_id: str
    planned_stops: list[PlannedStop]
    forecast_dose_ug: Annotated[float, Field(ge=0)]
    actual_dose_ug: Optional[Annotated[float, Field(ge=0)]]
    plan_version: Annotated[int, Field(ge=0)]


class RouteCacheItem(_Base):
    pk: Annotated[str, StringConstraints(pattern=r"^o#")]
    sk: Annotated[str, StringConstraints(pattern=r"^d#")]
    minutes: Annotated[float, Field(ge=0)]
    km: Annotated[float, Field(ge=0)]


# ========================= EventBridge (§8.3) ========================
class HotspotDistrict(_Base):
    district: str
    share: Share


class HotspotVillage(_Base):
    name: str
    district: str
    h3: str
    lat: float
    lon: float
    fire_count: Annotated[int, Field(ge=0)]


class ForecastPublishedDetail(_Base):
    run_id: RunId
    issued_at: Utc
    max_pm25: Annotated[float, Field(ge=0)]
    peak_window_utc: tuple[Utc, Utc]
    delhi_fire_share_p50: Share
    hotspot_districts: list[HotspotDistrict]
    hotspot_villages: list[HotspotVillage]
    degraded: list[str]
    summary_s3: Annotated[str, StringConstraints(pattern=r"^s3://")]
    model_version: str


class ForecastPublishedEvent(_Base):
    source: Literal["plumetrace.engine"]
    detail_type: Literal["forecast.published"] = Field(alias="detail-type")
    detail: ForecastPublishedDetail
    id: Optional[str] = None
    account: Optional[str] = None
    time: Optional[Utc] = None
    region: Optional[str] = None
    resources: Optional[list[str]] = None
    version: Optional[str] = None


# ======================= REST API responses (§8.4) ==================
class HotspotDistrictFull(HotspotDistrict):
    share_p10: Share
    share_p90: Share
    trend_7d: float


class RunSummary(_Base):
    run_id: RunId
    issued_at: Utc
    model_version: str
    max_pm25: Annotated[float, Field(ge=0)]
    max_pm25_p10: Annotated[float, Field(ge=0)]
    max_pm25_p90: Annotated[float, Field(ge=0)]
    peak_window_utc: tuple[Utc, Utc]
    delhi_fire_share_p10: Share
    delhi_fire_share_p50: Share
    delhi_fire_share_p90: Share
    hotspot_districts: list[HotspotDistrictFull]
    hotspot_villages: list[HotspotVillage]
    degraded: list[str]
    stations_count: Annotated[int, Field(ge=0)]
    cells_count: Annotated[int, Field(ge=0)]


class _Polygon(_Base):
    type: Literal["Polygon"]
    coordinates: list[list[tuple[float, float]]]


class ForecastCellProps(_Base):
    h3: H3Cell
    run_id: RunId
    valid_hour: ValidHour
    lead_h: LeadH
    pm25: Optional[Pm25]
    pm25_p10: Optional[Pm25]
    pm25_p90: Optional[Pm25]
    fire_share: Optional[Share]
    fire_share_p10: Optional[Share]
    fire_share_p90: Optional[Share]
    top_sources: Annotated[list[TopSource], Field(max_length=3)]
    hpbl_m: Optional[Annotated[float, Field(ge=0)]]


class ForecastFeature(_Base):
    type: Literal["Feature"]
    geometry: _Polygon
    properties: ForecastCellProps


class ForecastFeatureCollection(_Base):
    type: Literal["FeatureCollection"]
    run_id: RunId
    valid_hour: ValidHour
    features: list[ForecastFeature]


class StationSeriesPoint(_Base):
    valid_hour: ValidHour
    lead_h: LeadH
    pm25_p10: Pm25
    pm25_p50: Pm25
    pm25_p90: Pm25
    fire_share_p10: Share
    fire_share_p50: Share
    fire_share_p90: Share
    obs_pm25: Optional[Pm25]


class StationSeries(_Base):
    station_id: str
    station_name: str
    lat: float
    lon: float
    run_id: RunId
    issued_at: Utc
    series: list[StationSeriesPoint]


class AttributionDistrict(_Base):
    district: str
    share_p10: Share
    share_p50: Share
    share_p90: Share
    fire_count: Annotated[int, Field(ge=0)]
    frp_sum_mw: Annotated[float, Field(ge=0)]
    trend_7d: float
    receptor_stations: list[str]


class AttributionResponse(_Base):
    date: DateOnly
    run_id: RunId
    districts: list[AttributionDistrict]


class _LineString(_Base):
    type: Literal["LineString"]
    coordinates: list[tuple[float, float]]


class TrajectoryProps(_Base):
    station_id: str
    run_id: RunId
    valid_hour: ValidHour
    member: Annotated[int, Field(ge=0)]
    timestamps: list[Utc]


class TrajectoryFeature(_Base):
    type: Literal["Feature"]
    geometry: _LineString
    properties: TrajectoryProps


class TrajectoryFeatureCollection(_Base):
    type: Literal["FeatureCollection"]
    run_id: RunId
    features: list[TrajectoryFeature]


class _FirePoint(_Base):
    type: Literal["Point"]
    coordinates: tuple[float, float]


class FireProps(_Base):
    frp: Annotated[float, Field(ge=0)]
    acq_date: DateOnly
    acq_time: str
    confidence: Literal["n", "h"]
    satellite: str
    daynight: Literal["D", "N"]
    district: Optional[str]
    age_h: Annotated[float, Field(ge=0)]


class FireFeature(_Base):
    type: Literal["Feature"]
    geometry: _FirePoint
    properties: FireProps


class FireFeatureCollection(_Base):
    type: Literal["FeatureCollection"]
    features: list[FireFeature]


class SkillBucket(_Base):
    lead_bucket: LeadBucketT
    mae: Annotated[float, Field(ge=0)]
    rmse: Annotated[float, Field(ge=0)]
    coverage_p10_p90: Share
    skill_vs_persistence: float
    severe_hit_rate: Share
    n: Annotated[int, Field(ge=0)]


class SkillResponse(_Base):
    days: Annotated[int, Field(ge=1)]
    generated_at: Utc
    backtest: list[SkillBucket]
    live: list[SkillBucket]


class RiderExposure(_Base):
    rider_id: str
    name: str
    home_h3: H3Cell
    shift_hours: Annotated[float, Field(ge=0)]
    budget_ug: Annotated[float, Field(ge=0)]
    forecast_dose_ug: Annotated[float, Field(ge=0)]
    forecast_dose_pct: Annotated[float, Field(ge=0)]
    actual_dose_ug: Optional[Annotated[float, Field(ge=0)]]
    actual_dose_pct: Optional[Annotated[float, Field(ge=0)]]
    over_budget: bool


class FleetSummary(_Base):
    riders_total: Annotated[int, Field(ge=0)]
    riders_over_budget: Annotated[int, Field(ge=0)]
    worst_rider_pct: Annotated[float, Field(ge=0)]


class FleetExposure(_Base):
    fleet_id: str
    date: DateOnly
    generated_at: Utc
    simulated: Literal[True]
    summary: FleetSummary
    riders: list[RiderExposure]


class ActionList(_Base):
    count: Annotated[int, Field(ge=0)]
    actions: list[ActionItem]


# ===================== POST /agent/chat (SSE) =======================
class ChatTextEvent(_Base):
    type: Literal["text"]
    text: str


class ChatToolCallEvent(_Base):
    type: Literal["tool_call"]
    tool_use_id: str
    tool_name: str
    input: dict[str, Any]


class ChatToolResultEvent(_Base):
    type: Literal["tool_result"]
    tool_use_id: str
    tool_name: str
    output: Any = None


class ChatActionDraftedEvent(_Base):
    type: Literal["action_drafted"]
    action_id: str
    action_type: ActionTypeT
    preview_url: Optional[str] = None


class ChatDoneEvent(_Base):
    type: Literal["done"]
    stop_reason: str


class ChatErrorEvent(_Base):
    type: Literal["error"]
    message: str


ChatStreamEvent = Annotated[
    Union[
        ChatTextEvent, ChatToolCallEvent, ChatToolResultEvent,
        ChatActionDraftedEvent, ChatDoneEvent, ChatErrorEvent,
    ],
    Field(discriminator="type"),
]
