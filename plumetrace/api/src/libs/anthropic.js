/**
 * OWNER    : Yasho2
 * DUE      : D1 23:00
 * TASK     :
 *   Lazy Anthropic SDK client for the Copilot (Option A — direct Anthropic API
 *   instead of Bedrock ConverseStream; see docs/DECISIONS.md D-ANTHROPIC).
 *   The API key is resolved from ANTHROPIC_API_KEY (local dev) or, in prod,
 *   fetched once from Secrets Manager (ANTHROPIC_SECRET_NAME, default
 *   plumetrace/anthropic_key). The value is NEVER logged or committed.
 * DONE WHEN: getAnthropic() returns a usable client in both local and Lambda.
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import env from './env.js';
import logger from './logger.js';

let _client;
let _apiKeyPromise;

/**
 * Resolve the Anthropic API key. Prefers an explicit env var (local dev);
 * otherwise reads it from Secrets Manager at cold start (prod on Lambda).
 * The secret may be a bare key string or JSON { api_key: "sk-ant-..." }.
 */
async function resolveApiKey() {
  if (env.ANTHROPIC_API_KEY) return env.ANTHROPIC_API_KEY;

  if (env.ANTHROPIC_SECRET_NAME) {
    const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');
    const sm = new SecretsManagerClient({ region: env.AWS_REGION });
    const res = await sm.send(new GetSecretValueCommand({ SecretId: env.ANTHROPIC_SECRET_NAME }));
    const raw = res.SecretString ?? '';
    try {
      const j = JSON.parse(raw);
      return j.api_key || j.ANTHROPIC_API_KEY || raw;
    } catch {
      return raw; // plain key string
    }
  }

  throw new Error(
    'No Anthropic API key: set ANTHROPIC_API_KEY (local) or ANTHROPIC_SECRET_NAME ' +
      '(prod — a Secrets Manager secret, default plumetrace/anthropic_key).',
  );
}

/** Lazy singleton Anthropic client. Never constructed in MOCK_MODE. */
export async function getAnthropic() {
  if (!_client) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    if (!_apiKeyPromise) _apiKeyPromise = resolveApiKey();
    const apiKey = await _apiKeyPromise;
    // maxRetries handles 429/5xx/connection errors on request setup (replaces
    // the old explicit ThrottlingException retry around Bedrock ConverseStream).
    _client = new Anthropic({ apiKey, maxRetries: 2 });
    logger.info({ model: env.ANTHROPIC_MODEL }, 'Anthropic client ready');
  }
  return _client;
}

export default getAnthropic;
