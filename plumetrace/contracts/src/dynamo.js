/**
 * OWNER    : Yasho2
 * DUE      : D1 12:00 (FREEZE)
 * TASK     :
 *   Zod schemas for every DynamoDB item in brief §8.1: ForecastItem, StationForecastItem, AttributionItem,
 *   ActionItem (type/status enums + status transition map draft→approved→executed|rejected|failed),
 *   RiderItem, RiderHealthItem, ShiftItem, RouteCacheItem (added, see DECISIONS D-11).
 *   Also export key builders: forecastPk(cell), forecastSk(runId, validHour), stationPk(id), actionPk(uuid) ... so nobody hand-writes keys.
 * DONE WHEN: All mocks in contracts/mocks validate against these schemas (scripts/validate-mocks.js passes).
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { z } from 'zod';

/* ---------------------------------------------------------------------------
 * Primitive conventions (brief §7)
 *  - timestamps: UTC ISO-8601 ending in Z
 *  - run_id    : the GFS cycle, e.g. "2026-10-09T00Z"
 *  - valid_hour: the hour a forecast applies to, e.g. "2026-10-09T08:00Z"
 *  - coords in GeoJSON are [lon, lat]; function args are (lat, lon)
 * ------------------------------------------------------------------------- */

/** UTC ISO-8601 timestamp, must end with Z. */
export const utcTimestamp = z.string().regex(/Z$/, 'timestamp must be UTC ISO-8601 ending in Z');

/** GFS cycle id, e.g. 2026-10-09T00Z (no minutes). */
export const runId = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}Z$/, 'run_id must look like 2026-10-09T00Z');

/** A forecast valid hour, e.g. 2026-10-09T08:00Z. */
export const validHour = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/, 'valid_hour must look like 2026-10-09T08:00Z');

/** Calendar date, YYYY-MM-DD. */
export const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');

/** H3 cell token (res 7 is 15 hex chars; res 5 is 15 too). Lower bound is loose
 *  so short test/placeholder cells validate; real cells are 15-16 hex. */
export const h3Cell = z.string().regex(/^[0-9a-f]{3,16}$/, 'h3 cell must be 3-16 hex chars');

/** A share / probability in [0, 1]. */
export const share = z.number().min(0).max(1);

/** PM2.5 µg/m³ (>=0). Null means "no data" (cell > 25 km from any station, §10.6). */
export const pm25Value = z.number().min(0).max(2000);

/** Top-source contribution for a cell (brief §8.1 top_sources). */
export const TopSource = z.object({
  district: z.string(),
  share: share,
});

/* ======================= Forecast table (§8.1) ======================= */
export const ForecastItem = z.object({
  pk: z.string().regex(/^h3#/),            // h3#<cell>
  sk: z.string(),                          // <run_id>#<valid_hour>
  gsi1sk: z.string().optional(),           // "<valid_hour>#<h3>" — GSI byRun SK (DECISIONS D-16)
  run_id: runId,
  valid_hour: validHour,
  h3: h3Cell,
  pm25: pm25Value.nullable(),              // p50; null = no data
  pm25_p10: pm25Value.nullable(),
  pm25_p90: pm25Value.nullable(),
  fire_share: share.nullable(),
  fire_share_p10: share.nullable(),
  fire_share_p90: share.nullable(),
  top_sources: z.array(TopSource).max(3),
  hpbl_m: z.number().min(0).nullable(),
  lead_h: z.number().int().min(0).max(72),
  ttl: z.number().int(),                   // epoch seconds, +7 days
});

/* ==================== StationForecast table (§8.1) ==================== */
export const StationForecastItem = z.object({
  pk: z.string().regex(/^station#/),       // station#<openaq_location_id>
  sk: z.string(),                          // <run_id>#<valid_hour>
  run_id: runId,
  valid_hour: validHour,
  station_id: z.string(),
  pm25_p10: pm25Value,
  pm25_p50: pm25Value,
  pm25_p90: pm25Value,
  fire_share_p10: share,
  fire_share_p50: share,
  fire_share_p90: share,
  obs_pm25: pm25Value.nullable(),          // filled in later by the Verify job
  lead_h: z.number().int().min(0).max(72),
});

/* ====================== Attribution table (§8.1) ===================== */
export const AttributionItem = z.object({
  pk: z.string().regex(/^date#/),          // date#<YYYY-MM-DD>
  sk: z.string().regex(/^district#/),      // district#<name>
  date: dateOnly,
  district: z.string(),
  share_p10: share,
  share_p50: share,
  share_p90: share,
  fire_count: z.number().int().min(0),
  frp_sum_mw: z.number().min(0),
  receptor_stations: z.array(z.string()),
});

/* ======================== Actions table (§8.1) ======================= */
export const ACTION_TYPES = ['district_report', 'farmer_alert', 'shift_plan', 'rider_notify'];
export const ACTION_STATUSES = ['draft', 'approved', 'executed', 'rejected', 'failed'];

export const ActionType = z.enum(ACTION_TYPES);
export const ActionStatus = z.enum(ACTION_STATUSES);

/** Allowed status transitions. The approve/reject/execute flow (brief §8.1, §15 audit). */
export const ACTION_STATUS_TRANSITIONS = {
  draft: ['approved', 'rejected'],
  approved: ['executed', 'failed'],
  executed: [],
  rejected: [],
  failed: [],
};

/** True if `to` is a legal next status from `from`. */
export function canTransition(from, to) {
  return (ACTION_STATUS_TRANSITIONS[from] || []).includes(to);
}

/** Next-day verification block, filled by the verify jobs (§12.3, §13.5). */
export const ActionVerification = z.object({
  checked_at: utcTimestamp,
  summary: z.string(),
  metrics: z.record(z.string(), z.number()).optional(),
}).nullable();

export const ActionItem = z.object({
  pk: z.string().regex(/^action#/),        // action#<uuid>
  action_id: z.string(),                   // the uuid (mirror of pk suffix)
  type: ActionType,
  status: ActionStatus,
  payload: z.record(z.string(), z.unknown()),
  created_by: z.literal('agent'),
  approved_by: z.string().nullable(),      // Cognito sub, set on approve
  run_id: runId.nullable(),
  created_at: utcTimestamp,
  updated_at: utcTimestamp,
  verification: ActionVerification.optional(),
});

/* ========================= Riders table (§8.1) ======================= */
export const RiderItem = z.object({
  pk: z.string().regex(/^rider#/),         // rider#<id>
  rider_id: z.string(),
  name: z.string(),                        // synthetic
  home_h3: h3Cell,
  vehicle: z.literal('2w'),
  dose_budget_ug: z.number().min(0),
  consent_health: z.boolean(),
  consent_ts: utcTimestamp.nullable(),
});

/* ====== RiderHealth table (separate, KMS CMK, §8.1 / §15) ============= */
/** NEVER returned over the API. Only the dose Lambda role may read it. */
export const RiderHealthItem = z.object({
  pk: z.string().regex(/^rider#/),
  rider_id: z.string(),
  conditions: z.array(z.string()),         // e.g. ["asthma"]
  budget_multiplier: z.number().min(0).max(1),
});

/* ========================= Shifts table (§8.1) ======================= */
export const PlannedStop = z.object({
  order_id: z.string(),
  h3: h3Cell,
  eta: utcTimestamp,
});

export const ShiftItem = z.object({
  pk: z.string().regex(/^fleet#/),         // fleet#<id>#date#<YYYY-MM-DD>
  sk: z.string().regex(/^rider#/),         // rider#<id>
  fleet_id: z.string(),
  date: dateOnly,
  rider_id: z.string(),
  planned_stops: z.array(PlannedStop),
  forecast_dose_ug: z.number().min(0),
  actual_dose_ug: z.number().min(0).nullable(),
  plan_version: z.number().int().min(0),
});

/* ============ RouteCache table (DECISIONS D-11, brief §13.3) ========== */
export const RouteCacheItem = z.object({
  pk: z.string().regex(/^o#/),             // o#<h3>  (origin)
  sk: z.string().regex(/^d#/),             // d#<h3>  (destination)
  minutes: z.number().min(0),
  km: z.number().min(0),
});

/* ====================== Key builders (§8.1) ========================== */
/* Nobody hand-writes keys. Use these everywhere. */
export const forecastPk = (cell) => `h3#${cell}`;
export const forecastSk = (run_id, valid_hour) => `${run_id}#${valid_hour}`;
export const stationPk = (locationId) => `station#${locationId}`;
export const stationSk = (run_id, valid_hour) => `${run_id}#${valid_hour}`;
export const attributionPk = (date) => `date#${date}`;
export const attributionSk = (district) => `district#${district}`;
export const actionPk = (uuid) => `action#${uuid}`;
export const riderPk = (id) => `rider#${id}`;
export const shiftPk = (fleetId, date) => `fleet#${fleetId}#date#${date}`;
export const shiftSk = (riderId) => `rider#${riderId}`;
export const routeCachePk = (h3) => `o#${h3}`;
export const routeCacheSk = (h3) => `d#${h3}`;

/** GSI byRun sort key for the Forecast table (§8.1): "give me the whole map for hour X". */
export const forecastByRunSk = (valid_hour, cell) => `${valid_hour}#${cell}`;
