/**
 * OWNER    : Tejas
 * DUE      : D1 12:00
 * TASK     :
 *   Central config: account/region, stage, table names, bucket name `plumetrace-<account>-<region>-<stage>`, bus name `plumetrace-<stage>`, secret names (plumetrace/firms_map_key, plumetrace/openaq_key, plumetrace/telegram, plumetrace/cdse), schedule crons (04/10/16/22 UTC).
 * DONE WHEN: No other stack hard-codes a name.
 * GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 *
 * This module is pure (no CDK imports) so it is the single source of truth every
 * stack reads from. Resource names follow DECISIONS D-09 (`pt-<stage>` prefix,
 * region us-east-1, stages dev/demo) and the S3/bus naming in brief §8.2/§8.3.
 */

/** Only two stages exist: `dev` is shared, `demo` is deployed from main (D3+). */
export type Stage = "dev" | "demo";

/** Everything lives in us-east-1 (GFS + OpenAQ archive locality, Bedrock) — D-09. */
export const REGION = "us-east-1";

export const STAGES: readonly Stage[] = ["dev", "demo"] as const;

export function assertStage(s: string): Stage {
  if (s === "dev" || s === "demo") return s;
  throw new Error(`Unknown stage "${s}". Use one of: ${STAGES.join(", ")}`);
}

/** `pt-<stage>` prefix for every named resource (D-09). */
export function resourcePrefix(stage: Stage): string {
  return `pt-${stage}`;
}

/**
 * Logical DynamoDB tables (brief §8.1, plus RouteCache from D-11).
 * Key schemas are owned by the contracts package (contracts/src/dynamo.js);
 * this map holds only the names the CDK needs.
 */
export const TABLE_KEYS = [
  "Forecast",
  "StationForecast",
  "Attribution",
  "Actions",
  "Riders",
  "RiderHealth",
  "Shifts",
  "RouteCache",
] as const;
export type TableKey = (typeof TABLE_KEYS)[number];

export function tableName(stage: Stage, key: TableKey): string {
  return `${resourcePrefix(stage)}-${key}`;
}

/** GSI on Forecast for "whole map for hour X" (brief §8.1). */
export const FORECAST_GSI_BY_RUN = "byRun";

/** S3 bucket: `plumetrace-<account>-<region>-<stage>` (brief §8.2 + stage suffix). */
export function bucketName(account: string, stage: Stage): string {
  return `plumetrace-${account}-${REGION}-${stage}`;
}

/** Custom EventBridge bus `plumetrace-<stage>` (brief §8.3). */
export function busName(stage: Stage): string {
  return `plumetrace-${stage}`;
}

/** Secrets Manager names — NAMES ONLY, never values (AC8, brief §15). */
export const SECRET_NAMES = {
  firmsMapKey: "plumetrace/firms_map_key",
  openaqKey: "plumetrace/openaq_key",
  telegram: "plumetrace/telegram",
  cdse: "plumetrace/cdse",
} as const;

/**
 * Schedules (UTC). EngineRun fires ~4 h after each GFS cycle (brief §9);
 * Verify runs hourly to fill obs + skill (brief §9 step 9).
 */
export const SCHEDULES = {
  engineRunCron: "cron(0 4,10,16,22 * * ? *)",
  engineRunHoursUtc: [4, 10, 16, 22] as const,
  verifyCron: "cron(5 * * * ? *)",
} as const;

export interface AppConfig {
  stage: Stage;
  region: string;
  account?: string;
  prefix: string;
  busName: string;
  bucketName?: string;
  tables: Record<TableKey, string>;
  secrets: typeof SECRET_NAMES;
  schedules: typeof SCHEDULES;
  forecastGsiByRun: string;
}

/**
 * Resolve the whole config for a stage. `account` is passed in from CDK env
 * (process.env.CDK_DEFAULT_ACCOUNT) — never hard-coded here.
 */
export function appConfig(stage: Stage, account?: string): AppConfig {
  const tables = Object.fromEntries(
    TABLE_KEYS.map((k) => [k, tableName(stage, k)]),
  ) as Record<TableKey, string>;
  return {
    stage,
    region: REGION,
    account,
    prefix: resourcePrefix(stage),
    busName: busName(stage),
    bucketName: account ? bucketName(account, stage) : undefined,
    tables,
    secrets: SECRET_NAMES,
    schedules: SCHEDULES,
    forecastGsiByRun: FORECAST_GSI_BY_RUN,
  };
}
