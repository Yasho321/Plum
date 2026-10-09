/**
 * OWNER    : Yasho2
 * DUE      : D1 12:00 (FREEZE)
 * TASK     :
 *   Zod schemas for every REST response in §8.4: RunSummary, ForecastFeatureCollection (H3 polygons), StationSeries, AttributionResponse, TrajectoryFeatureCollection (LineString + timestamps[] per vertex), SkillResponse (by lead bucket, backtest & live), FleetExposure, ActionList, ChatStreamEvent (SSE: text | tool_call | tool_result | action_drafted | done | error).
 * DONE WHEN: Every API route has a request + response schema exported here.
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { z } from 'zod';
import {
  utcTimestamp, runId, validHour, dateOnly, h3Cell, share, pm25Value,
  TopSource, ActionItem, ActionType, ActionStatus,
} from './dynamo.js';
import { HotspotDistrict, HotspotVillage } from './events.js';

/* =========================== GET /runs/latest ========================
 * summary.json for the latest run (brief §8.2, §8.4). Also returned by the
 * getForecastSummary agent tool. Carries hotspot_villages[]/degraded[] (D-10).
 * ------------------------------------------------------------------- */
export const RunSummary = z.object({
  run_id: runId,
  issued_at: utcTimestamp,
  model_version: z.string(),
  max_pm25: z.number().min(0),
  max_pm25_p10: z.number().min(0),
  max_pm25_p90: z.number().min(0),
  peak_window_utc: z.tuple([utcTimestamp, utcTimestamp]),
  delhi_fire_share_p10: share,
  delhi_fire_share_p50: share,
  delhi_fire_share_p90: share,
  hotspot_districts: z.array(HotspotDistrict.extend({
    share_p10: share,
    share_p90: share,
    trend_7d: z.number(),            // relative change in fire count vs prev 7 days
  })),
  hotspot_villages: z.array(HotspotVillage),
  degraded: z.array(z.string()),     // e.g. ["firms"] when a source failed
  stations_count: z.number().int().min(0),
  cells_count: z.number().int().min(0),
});

/* ====================== GET /forecast (GeoJSON) ======================
 * FeatureCollection of H3 res-7 polygons. pm25 null = "no data" cell (§10.6).
 * ------------------------------------------------------------------- */
const Polygon = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),  // [lon,lat] rings
});

export const ForecastCellProps = z.object({
  h3: h3Cell,
  run_id: runId,
  valid_hour: validHour,
  lead_h: z.number().int().min(0).max(72),
  pm25: pm25Value.nullable(),
  pm25_p10: pm25Value.nullable(),
  pm25_p90: pm25Value.nullable(),
  fire_share: share.nullable(),
  fire_share_p10: share.nullable(),
  fire_share_p90: share.nullable(),
  top_sources: z.array(TopSource).max(3),
  hpbl_m: z.number().min(0).nullable(),
});

export const ForecastFeature = z.object({
  type: z.literal('Feature'),
  geometry: Polygon,
  properties: ForecastCellProps,
});

export const ForecastFeatureCollection = z.object({
  type: z.literal('FeatureCollection'),
  run_id: runId,
  valid_hour: validHour,
  features: z.array(ForecastFeature),
});

/* ============== GET /stations/{id}/forecast (time series) ============ */
export const StationSeriesPoint = z.object({
  valid_hour: validHour,
  lead_h: z.number().int().min(0).max(72),
  pm25_p10: pm25Value,
  pm25_p50: pm25Value,
  pm25_p90: pm25Value,
  fire_share_p10: share,
  fire_share_p50: share,
  fire_share_p90: share,
  obs_pm25: pm25Value.nullable(),
});

export const StationSeries = z.object({
  station_id: z.string(),
  station_name: z.string(),
  lat: z.number(),
  lon: z.number(),
  run_id: runId,
  issued_at: utcTimestamp,
  series: z.array(StationSeriesPoint),
});

/* ====================== GET /attribution?date= ====================== */
export const AttributionDistrict = z.object({
  district: z.string(),
  share_p10: share,
  share_p50: share,
  share_p90: share,
  fire_count: z.number().int().min(0),
  frp_sum_mw: z.number().min(0),
  trend_7d: z.number(),
  receptor_stations: z.array(z.string()),
});

export const AttributionResponse = z.object({
  date: dateOnly,
  run_id: runId,
  districts: z.array(AttributionDistrict),
});

/* =================== GET /trajectories (GeoJSON) =====================
 * LineStrings flowing back from a receptor station. Each vertex has a time;
 * properties.timestamps[] is aligned 1:1 with the coordinates for TripsLayer.
 * ------------------------------------------------------------------- */
const LineString = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(z.tuple([z.number(), z.number()])),  // [lon,lat]
});

export const TrajectoryFeature = z.object({
  type: z.literal('Feature'),
  geometry: LineString,
  properties: z.object({
    station_id: z.string(),
    run_id: runId,
    valid_hour: validHour,
    member: z.number().int().min(0),       // ensemble member index (0 = central)
    timestamps: z.array(utcTimestamp),     // one per coordinate
  }),
});

export const TrajectoryFeatureCollection = z.object({
  type: z.literal('FeatureCollection'),
  run_id: runId,
  features: z.array(TrajectoryFeature),
});

/* ===================== fires_48h.geojson (D-10) =====================
 * FIRMS fire detections over the last 48 h, for the map and reports.
 * ------------------------------------------------------------------- */
const FirePoint = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([z.number(), z.number()]),  // [lon,lat]
});

export const FireFeature = z.object({
  type: z.literal('Feature'),
  geometry: FirePoint,
  properties: z.object({
    frp: z.number().min(0),                // MW
    acq_date: dateOnly,
    acq_time: z.string(),                  // HHMM UTC
    confidence: z.enum(['n', 'h']),        // 'l' is dropped at ingest (§6.2)
    satellite: z.string(),
    daynight: z.enum(['D', 'N']),
    district: z.string().nullable(),
    age_h: z.number().min(0),              // hours since detection
  }),
});

export const FireFeatureCollection = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(FireFeature),
});

/* ========================= GET /skill?days= =========================
 * Metrics by lead bucket, for both the ERA5 backtest and live GFS (§10.8).
 * ------------------------------------------------------------------- */
export const LEAD_BUCKETS = ['0-6', '6-24', '24-48', '48-72'];

export const SkillBucket = z.object({
  lead_bucket: z.enum(LEAD_BUCKETS),
  mae: z.number().min(0),
  rmse: z.number().min(0),
  coverage_p10_p90: share,               // target ~0.80
  skill_vs_persistence: z.number(),      // 1 - MAE_model/MAE_persistence
  severe_hit_rate: share,                // >250 µg/m³ events
  n: z.number().int().min(0),
});

export const SkillResponse = z.object({
  days: z.number().int().min(1),
  generated_at: utcTimestamp,
  backtest: z.array(SkillBucket),
  live: z.array(SkillBucket),
});

/* ================= GET /fleet/{id}/exposure?date= ===================
 * Per-rider forecast/actual dose and budget %. SIMULATED (§2.4, §13).
 * Never exposes RiderHealth conditions — only the budget % (§15, playbook §9).
 * ------------------------------------------------------------------- */
export const RiderExposure = z.object({
  rider_id: z.string(),
  name: z.string(),
  home_h3: h3Cell,
  shift_hours: z.number().min(0),
  budget_ug: z.number().min(0),
  forecast_dose_ug: z.number().min(0),
  forecast_dose_pct: z.number().min(0),
  actual_dose_ug: z.number().min(0).nullable(),
  actual_dose_pct: z.number().min(0).nullable(),
  over_budget: z.boolean(),
});

export const FleetExposure = z.object({
  fleet_id: z.string(),
  date: dateOnly,
  generated_at: utcTimestamp,
  simulated: z.literal(true),
  summary: z.object({
    riders_total: z.number().int().min(0),
    riders_over_budget: z.number().int().min(0),
    worst_rider_pct: z.number().min(0),
  }),
  riders: z.array(RiderExposure),
});

/* ===================== GET /actions?status= ========================= */
export const ActionList = z.object({
  count: z.number().int().min(0),
  actions: z.array(ActionItem),
});

/** Response of POST /actions/{id}/approve | /reject — the updated item. */
export const ActionResponse = ActionItem;

/* ===================== DELETE /riders/{id}/data ===================== */
export const RiderEraseResponse = z.object({
  rider_id: z.string(),
  erased: z.literal(true),
  erased_at: utcTimestamp,
});

/* ===================== POST /agent/chat (SSE) =======================
 * ChatStreamEvent — the SSE event stream Tanmay's Copilot UI consumes.
 * Recorded ideally in mocks/chat_stream.jsonl (one JSON event per line).
 * ------------------------------------------------------------------- */
export const ChatTextEvent = z.object({
  type: z.literal('text'),
  text: z.string(),
});

export const ChatToolCallEvent = z.object({
  type: z.literal('tool_call'),
  tool_use_id: z.string(),
  tool_name: z.string(),
  input: z.record(z.string(), z.unknown()),
});

export const ChatToolResultEvent = z.object({
  type: z.literal('tool_result'),
  tool_use_id: z.string(),
  tool_name: z.string(),
  output: z.unknown(),
});

export const ChatActionDraftedEvent = z.object({
  type: z.literal('action_drafted'),
  action_id: z.string(),
  action_type: ActionType,
  preview_url: z.string().nullable().optional(),
});

export const ChatDoneEvent = z.object({
  type: z.literal('done'),
  stop_reason: z.string(),
});

export const ChatErrorEvent = z.object({
  type: z.literal('error'),
  message: z.string(),
});

export const ChatStreamEvent = z.discriminatedUnion('type', [
  ChatTextEvent,
  ChatToolCallEvent,
  ChatToolResultEvent,
  ChatActionDraftedEvent,
  ChatDoneEvent,
  ChatErrorEvent,
]);

/* ===================== Request schemas (query/body) ================== */
export const ChatRequest = z.object({
  message: z.string().min(1),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    text: z.string(),
  })).optional(),
});

export const ForecastQuery = z.object({
  run_id: runId.optional(),
  valid_hour: validHour.optional(),
  bbox: z.string().optional(),           // "w,s,e,n"
});

export const SkillQuery = z.object({
  days: z.coerce.number().int().min(1).max(30).default(7),
});

export const AttributionQuery = z.object({
  date: dateOnly.optional(),   // defaults to the latest run's date when omitted
});

export const ActionsQuery = z.object({
  status: ActionStatus.optional(),
});

export const FleetExposureQuery = z.object({
  date: dateOnly.optional(),
});
