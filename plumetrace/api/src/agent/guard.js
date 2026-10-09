/**
 * OWNER    : Yasho2
 * DUE      : D1 23:00
 * TASK     :
 *   Lightweight keyword guardrail replacing the Bedrock Guardrail for Option A
 *   (Anthropic API direct; see docs/DECISIONS.md D-ANTHROPIC). Mirrors the deny
 *   topics that agent-stack.ts used to enforce: no personal/identifying data of
 *   individual farmers, and no blaming/abusive language toward farmers. Runs on
 *   the user's input before the model is called; the grounding + supportive-tone
 *   rules continue to live in systemPrompt.js.
 * DONE WHEN: Flagged prompts are refused with the same messaging as the guardrail.
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */

/** Verbatim from the retired Bedrock Guardrail (agent-stack.ts). */
export const BLOCKED_INPUT_MESSAGE =
  'I can only help with PlumeTrace air-quality decisions and drafts for approval.';
export const BLOCKED_OUTPUT_MESSAGE =
  'I can only report model estimates with their uncertainty range, and I never share personal data about individuals.';

/**
 * Deny patterns. Kept deliberately conservative: a false block is safer than
 * leaking individual-farmer PII or parroting blame. Each entry is a regex.
 */
const DENY_PATTERNS = [
  // IndividualFarmerData — identify / contact / locate a specific farmer or plot.
  /\b(phone|mobile|number|contact|address|name[sd]?|who\s+owns?|owner)\b[^.?!]*\bfarmer/i,
  /\bfarmer[^.?!]*\b(phone|mobile|number|contact|address|name|identity|who)\b/i,
  /\bkhasra\b|\bplot\s*(id|number|no)\b|\bland\s*record/i,
  /\bname\s+the\s+farmers?\b/i,
  // Blaming / abusive directives toward farmers (supportive-tone rule, brief §2.4).
  /\b(criminal|culprit|guilty)\s+farmers?\b/i,
  /\barrest\s+(the\s+)?farmers?\b/i,
  /\bpunish\s+(the\s+)?farmers?\b/i,
  // CertaintyBeyondModel — demands for certainty past the model's p10–p90 range.
  /\bprove\s+that\b[^.?!]*\b(stubble|burning|fire)\b/i,
  /\b(exact|certain|definite)[^.?!]*\b(no\s+uncertainty|without\s+uncertainty)\b/i,
];

/**
 * @param {string} text user message
 * @returns {{ blocked: boolean, message?: string }}
 */
export function guardInput(text) {
  const s = String(text ?? '');
  for (const re of DENY_PATTERNS) {
    if (re.test(s)) return { blocked: true, message: BLOCKED_INPUT_MESSAGE };
  }
  return { blocked: false };
}

export default guardInput;
