/**
 * OWNER    : Yasho2
 * DUE      : D1 12:00 (FREEZE)
 * TASK     :
 *   Zod input + output schemas for the 10 agent tools in §11.2 (getForecastSummary ... draftRiderNotifications).
 *   These are also the payload contracts for Khare's Lambdas (draftDistrictReport, draftFarmerAlert, checkFireTrend, draftRiderNotifications) and Yasho2's replanner (draftShiftPlan).
 * DONE WHEN: Khare and Yasho2 both import these; no Lambda invents its own payload shape.
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { z } from 'zod';
import { runId, dateOnly } from './dynamo.js';
import {
  RunSummary, StationSeries, AttributionResponse, SkillResponse, FleetExposure,
} from './api.js';

/* Every tool declares an input + output schema. The agent loop turns each input
 * into a Bedrock toolSpec with z.toJSONSchema(input) (playbook §7). Khare's
 * Lambdas and the re-planner validate against the SAME schemas. */

/* ----------------------------- shared tools -------------------------- */
export const GetForecastSummaryInput = z.object({
  run_id: runId.optional(),
});
export const GetForecastSummaryOutput = RunSummary;

export const GetStationForecastInput = z.object({
  station_id: z.string(),
  run_id: runId.optional(),
});
export const GetStationForecastOutput = StationSeries;

export const GetAttributionInput = z.object({
  date: dateOnly,
});
export const GetAttributionOutput = AttributionResponse;

export const GetForecastSkillInput = z.object({
  days: z.number().int().min(1).max(30).default(7),
});
export const GetForecastSkillOutput = SkillResponse;

/* ------------------------------- gov tools --------------------------- */
export const DraftDistrictReportInput = z.object({
  district: z.string(),
  date: dateOnly,
});
export const DraftDistrictReportOutput = z.object({
  action_id: z.string(),
  preview_url: z.string(),
});

export const DraftFarmerAlertInput = z.object({
  districts: z.array(z.string()).min(1),
  language: z.enum(['pa', 'hi']),
  max_villages: z.number().int().min(1).max(50),
});
export const DraftFarmerAlertOutput = z.object({
  action_id: z.string(),
  text: z.string(),
  audio_url: z.string().nullable(),
});

export const CheckFireTrendInput = z.object({
  district: z.string(),
  days: z.number().int().min(1).max(30).default(7),
});
export const CheckFireTrendOutput = z.object({
  district: z.string(),
  days: z.number().int().min(1),
  daily: z.array(z.object({
    date: dateOnly,
    fire_count: z.number().int().min(0),
    frp_sum_mw: z.number().min(0),
  })),
  trend_pct: z.number(),            // relative change over the window
});

/* ------------------------------ fleet tools -------------------------- */
export const GetFleetExposureInput = z.object({
  fleet_id: z.string(),
  date: dateOnly,
});
export const GetFleetExposureOutput = FleetExposure;

export const DraftShiftPlanInput = z.object({
  fleet_id: z.string(),
  date: dateOnly,
  objective: z.enum(['min_max_dose', 'min_total_dose']).optional(),
});
export const DraftShiftPlanOutput = z.object({
  action_id: z.string(),
  riders_changed: z.number().int().min(0),
  dose_reduction_pct: z.object({
    fleet_total: z.number(),        // % reduction, fleet aggregate
    worst_rider: z.number(),        // % reduction for the worst-exposed rider
  }),
  extra_minutes: z.object({
    average: z.number(),
    total: z.number(),
  }),
  solver: z.enum(['cpsat', 'greedy']),
});

export const DraftRiderNotificationsInput = z.object({
  plan_action_id: z.string(),
});
export const DraftRiderNotificationsOutput = z.object({
  action_id: z.string(),
  messages: z.array(z.object({
    rider_id: z.string(),
    text: z.string(),
  })),
});

/* ----------------------------- tool registry ------------------------- */
/** One entry per tool; the agent loop reads this to build toolConfig. */
export const AGENT_TOOLS = {
  getForecastSummary: {
    group: 'shared',
    description: 'Get the summary of the latest (or a given) forecast run: peak PM2.5 with p10/p90, the Delhi fire share with range, hotspot districts and villages. Use this first to understand the situation.',
    input: GetForecastSummaryInput,
    output: GetForecastSummaryOutput,
  },
  getStationForecast: {
    group: 'shared',
    description: 'Get the 0-72 h PM2.5 forecast time series (p10/p50/p90) plus any actual readings for one OpenAQ station.',
    input: GetStationForecastInput,
    output: GetStationForecastOutput,
  },
  getAttribution: {
    group: 'shared',
    description: 'Get the estimated per-district crop-fire contribution shares (with p10-p90 ranges), fire counts and FRP for a date.',
    input: GetAttributionInput,
    output: GetAttributionOutput,
  },
  getForecastSkill: {
    group: 'shared',
    description: 'Get forecast-accuracy metrics (MAE, RMSE, band coverage, skill vs persistence) by lead bucket, for backtest and live data. Use to answer "how accurate is this?".',
    input: GetForecastSkillInput,
    output: GetForecastSkillOutput,
  },
  draftDistrictReport: {
    group: 'gov',
    description: 'Draft (do NOT send) a one-page district accountability report with the fire-share estimate and range, a map, trends, supportive actions and the method. Returns an action_id for human approval.',
    input: DraftDistrictReportInput,
    output: DraftDistrictReportOutput,
  },
  draftFarmerAlert: {
    group: 'gov',
    description: 'Draft (do NOT send) a supportive, non-blaming farmer alert (<300 chars + audio) for hotspot villages in the given districts, in Punjabi or Hindi. Returns an action_id for human approval.',
    input: DraftFarmerAlertInput,
    output: DraftFarmerAlertOutput,
  },
  checkFireTrend: {
    group: 'gov',
    description: 'Get daily fire counts and FRP for a district over the last N days, with the trend. Use for next-day/verification questions.',
    input: CheckFireTrendInput,
    output: CheckFireTrendOutput,
  },
  getFleetExposure: {
    group: 'fleet',
    description: 'Get each rider\'s forecast exposure dose as a percentage of their safe budget for a date, and which riders are over budget. Fleet data is SIMULATED.',
    input: GetFleetExposureInput,
    output: GetFleetExposureOutput,
  },
  draftShiftPlan: {
    group: 'fleet',
    description: 'Draft (do NOT send) a re-planned set of shifts that caps each rider\'s pollution dose, reporting the dose reduction and extra-minutes trade-off. Returns an action_id for human approval.',
    input: DraftShiftPlanInput,
    output: DraftShiftPlanOutput,
  },
  draftRiderNotifications: {
    group: 'fleet',
    description: 'Draft (do NOT send) per-rider notification messages for an approved or drafted shift plan. Returns an action_id for human approval.',
    input: DraftRiderNotificationsInput,
    output: DraftRiderNotificationsOutput,
  },
};
