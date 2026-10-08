/**
 * OWNER    : Yasho2
 * DUE      : D1 12:00 (FREEZE)
 * TASK     :
 *   Zod schemas for EventBridge details (§8.3): ForecastPublishedDetail (incl. hotspot_villages[] and degraded[] — see DECISIONS D-10), ActionEventDetail (= ActionItem) for action.approved / action.executed / verification.completed.
 *   Export SOURCES and DETAIL_TYPES constants.
 * DONE WHEN: mocks/forecast_published.event.json validates.
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { z } from 'zod';
import { utcTimestamp, runId, validHour, share, ActionItem } from './dynamo.js';

/** Custom EventBridge bus is `plumetrace` (brief §8.3). */
export const EVENT_BUS = 'plumetrace';

export const SOURCES = {
  ENGINE: 'plumetrace.engine',
  AGENT: 'plumetrace.agent',
  VERIFY: 'plumetrace.verify',
};

export const DETAIL_TYPES = {
  FORECAST_PUBLISHED: 'forecast.published',
  ACTION_APPROVED: 'action.approved',
  ACTION_EXECUTED: 'action.executed',
  VERIFICATION_COMPLETED: 'verification.completed',
};

/** A ranked district in the published forecast (brief §8.3). */
export const HotspotDistrict = z.object({
  district: z.string(),
  share: share,
});

/** A hotspot village (DECISIONS D-10; the farmer alert and map need it). */
export const HotspotVillage = z.object({
  name: z.string(),
  district: z.string(),
  h3: z.string(),
  lat: z.number(),
  lon: z.number(),
  fire_count: z.number().int().min(0),
});

/* ===================== forecast.published (§8.3) ===================== */
export const ForecastPublishedDetail = z.object({
  run_id: runId,
  issued_at: utcTimestamp,
  max_pm25: z.number().min(0),
  peak_window_utc: z.tuple([utcTimestamp, utcTimestamp]),
  delhi_fire_share_p50: share,
  hotspot_districts: z.array(HotspotDistrict),
  hotspot_villages: z.array(HotspotVillage),           // D-10
  degraded: z.array(z.string()),                       // D-10, e.g. ["firms"]
  summary_s3: z.string().startsWith('s3://'),
  model_version: z.string(),
});

/** Full EventBridge PutEvents envelope for forecast.published. */
export const ForecastPublishedEvent = z.object({
  source: z.literal(SOURCES.ENGINE),
  'detail-type': z.literal(DETAIL_TYPES.FORECAST_PUBLISHED),
  detail: ForecastPublishedDetail,
  // Optional AWS-delivered envelope fields (present when read off the bus).
  id: z.string().optional(),
  account: z.string().optional(),
  time: utcTimestamp.optional(),
  region: z.string().optional(),
  resources: z.array(z.string()).optional(),
  version: z.string().optional(),
});

/* ====== action.approved / action.executed / verification.completed === */
/** Detail for the action lifecycle events is the Actions item itself (§8.3). */
export const ActionEventDetail = ActionItem;

export const ActionEvent = z.object({
  source: z.enum([SOURCES.AGENT, SOURCES.VERIFY]),
  'detail-type': z.enum([
    DETAIL_TYPES.ACTION_APPROVED,
    DETAIL_TYPES.ACTION_EXECUTED,
    DETAIL_TYPES.VERIFICATION_COMPLETED,
  ]),
  detail: ActionEventDetail,
  id: z.string().optional(),
  account: z.string().optional(),
  time: utcTimestamp.optional(),
  region: z.string().optional(),
  resources: z.array(z.string()).optional(),
  version: z.string().optional(),
});
