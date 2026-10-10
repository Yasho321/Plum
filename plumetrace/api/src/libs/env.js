/**
 * OWNER    : Yasho2
 * DUE      : D1 14:00
 * TASK     :
 *   zod-validated env (fail fast, like NotebookLM-Clone shared/libs/env.js): MOCK_MODE, AWS_REGION, TABLE_*, BUCKET, BUS_NAME, COGNITO_POOL_ID, COGNITO_CLIENT_ID, BEDROCK_MODEL_ID, GUARDRAIL_ID/VERSION, FN_REPORT, FN_FARMER_ALERT, FN_FIRE_TREND, FN_REPLANNER, FN_RIDER_NOTIFY.
 * DONE WHEN: Missing critical var -> readable crash at boot.
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import 'dotenv/config';
import { z } from 'zod';

/** "1"/"true"/"yes" -> true. Default ON so local dev never needs AWS. */
const boolish = z
  .union([z.string(), z.boolean()])
  .default('1')
  .transform((v) => v === true || ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase()));

const base = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().default(8080),
  MOCK_MODE: boolish,
  // AGENT_LIVE=1 runs the REAL Anthropic Copilot even while MOCK_MODE serves mock
  // REST/tool data — the demo sweet spot (live Claude over mocks, no engine/gov/fleet).
  // Default OFF so MOCK_MODE alone keeps the recorded mock chat (backward compatible).
  AGENT_LIVE: z
    .union([z.string(), z.boolean()])
    .default('0')
    .transform((v) => v === true || ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase())),
  AWS_REGION: z.string().default('us-east-1'),

  // Allowed browser origins (Amplify + local Vite). Comma-separated.
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  // DynamoDB tables (brief §8.1)
  TABLE_FORECAST: z.string().default('pt-dev-Forecast'),
  TABLE_STATION_FORECAST: z.string().default('pt-dev-StationForecast'),
  TABLE_ATTRIBUTION: z.string().default('pt-dev-Attribution'),
  TABLE_ACTIONS: z.string().default('pt-dev-Actions'),
  TABLE_RIDERS: z.string().default('pt-dev-Riders'),
  TABLE_RIDER_HEALTH: z.string().default('pt-dev-RiderHealth'),
  TABLE_SHIFTS: z.string().default('pt-dev-Shifts'),
  TABLE_ROUTE_CACHE: z.string().default('pt-dev-RouteCache'),

  // S3 + EventBridge
  BUCKET: z.string().default('pt-dev-bucket'),
  BUS_NAME: z.string().default('plumetrace'),

  // Cognito (JWT verification, defence-in-depth behind the API GW authorizer)
  COGNITO_POOL_ID: z.string().optional(),
  COGNITO_CLIENT_ID: z.string().optional(),

  // Anthropic Copilot (Option A — direct Anthropic API, see docs/DECISIONS.md).
  // Key from ANTHROPIC_API_KEY (local) or ANTHROPIC_SECRET_NAME (Secrets Manager, prod).
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_SECRET_NAME: z.string().default('plumetrace/anthropic_key'),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),

  // Bedrock (LEGACY — unused after Option A; kept so old env/.env files still parse).
  BEDROCK_MODEL_ID: z.string().default('us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
  GUARDRAIL_ID: z.string().optional(),
  GUARDRAIL_VERSION: z.string().default('DRAFT'),

  // Tool Lambdas (Khare's gov Lambdas + Yasho2's re-planner)
  FN_REPORT: z.string().optional(),
  FN_FARMER_ALERT: z.string().optional(),
  FN_FIRE_TREND: z.string().optional(),
  FN_REPLANNER: z.string().optional(),
  FN_RIDER_NOTIFY: z.string().optional(),
});

/**
 * In real (non-mock) mode these become required; fail fast with a readable
 * message rather than a confusing AWS error at first request.
 */
const parsed = base.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}
const env = parsed.data;

if (!env.MOCK_MODE) {
  const requiredInReal = ['COGNITO_POOL_ID', 'COGNITO_CLIENT_ID'];
  const missing = requiredInReal.filter((k) => !env[k]);
  if (missing.length) {
    console.error(
      `❌ MOCK_MODE is off but these vars are missing: ${missing.join(', ')}.\n` +
        '   Set them (Tejas\'s ApiStack provides them) or run with MOCK_MODE=1.',
    );
    process.exit(1);
  }
}

export default env;
