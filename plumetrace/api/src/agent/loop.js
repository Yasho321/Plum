/**
 * OWNER    : Yasho2
 * DUE      : D1 23:00
 * TASK     :
 *   Anthropic Messages API tool-use loop (max 10 turns): stream text deltas, on
 *   tool_use -> validate input with zod -> run tool -> append tool_result ->
 *   continue. Keyword guardrail on input (agent/guard.js). Emit tool_call /
 *   tool_result / action_drafted events. SDK retries on 429/5xx. NO execute
 *   tools exist — drafts only.
 *   Option A: direct Anthropic API instead of Bedrock ConverseStream (the loop
 *   the agent drives and every ChatStreamEvent it emits are unchanged; see
 *   docs/DECISIONS.md D-ANTHROPIC).
 * DONE WHEN: Works end-to-end on mocks by D2 morning.
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import env from '../libs/env.js';
import logger from '../libs/logger.js';
import { getAnthropic } from '../libs/anthropic.js';
import { toAnthropicTools, runTool } from './tools/index.js';
import SYSTEM_PROMPT from './systemPrompt.js';
import { guardInput } from './guard.js';

const MAX_TURNS = 10;
const MAX_TOKENS = 8192;

/**
 * runAgent — drive the tool-use loop, emitting ChatStreamEvents via onEvent.
 * @param {{message:string, history:{role,text}[], user:object,
 *          onEvent:(e)=>void, isAborted:()=>boolean}} opts
 */
export async function runAgent({ message, history = [], user, onEvent, isAborted }) {
  // Keyword guardrail (replaces the Bedrock Guardrail) — refuse up front.
  const guard = guardInput(message);
  if (guard.blocked) {
    onEvent({ type: 'text', text: guard.message });
    onEvent({ type: 'done', stop_reason: 'guardrail_intervened' });
    return;
  }

  const client = await getAnthropic();

  // Anthropic message history. Content may be a plain string per turn.
  const messages = [
    ...history.map((h) => ({ role: h.role, content: h.text })),
    { role: 'user', content: message },
  ];
  const tools = toAnthropicTools();

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    if (isAborted?.()) return;

    const stream = client.messages.stream({
      model: env.ANTHROPIC_MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages,
      tools,
    });

    // Stream text deltas straight through as `text` events.
    for await (const event of stream) {
      if (isAborted?.()) {
        try { stream.abort(); } catch { /* ignore */ }
        return;
      }
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        onEvent({ type: 'text', text: event.delta.text });
      }
    }

    const msg = await stream.finalMessage();
    messages.push({ role: 'assistant', content: msg.content });

    if (msg.stop_reason !== 'tool_use') {
      onEvent({ type: 'done', stop_reason: msg.stop_reason });
      return;
    }

    // Run each requested tool and feed the results back as one user message.
    const toolUses = msg.content.filter((b) => b.type === 'tool_use');
    const toolResults = [];
    for (const tu of toolUses) {
      if (isAborted?.()) return;
      onEvent({ type: 'tool_call', tool_use_id: tu.id, tool_name: tu.name, input: tu.input });
      try {
        const { output, actionType, actionId } = await runTool(tu.name, tu.input, { user });
        onEvent({ type: 'tool_result', tool_use_id: tu.id, tool_name: tu.name, output });
        if (actionId && actionType) {
          onEvent({
            type: 'action_drafted',
            action_id: actionId,
            action_type: actionType,
            preview_url: output?.preview_url ?? null,
          });
        }
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify(output ?? {}),
        });
      } catch (err) {
        logger.warn({ err: err.message, tool: tu.name }, 'tool failed');
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: `Tool error: ${err.message}`,
          is_error: true,
        });
      }
    }
    messages.push({ role: 'user', content: toolResults });
  }

  // Safety valve: too many tool turns.
  onEvent({ type: 'done', stop_reason: 'max_turns' });
}

export default runAgent;
