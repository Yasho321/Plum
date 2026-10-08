/**
 * OWNER    : Yasho2
 * DUE      : D1 23:00
 * TASK     :
 *   Bedrock ConverseStream tool-use loop (max 10 turns): stream text deltas, on toolUse -> validate input with zod -> run tool -> append toolResult -> continue. guardrailConfig on every call. Emit tool_call / tool_result / action_drafted events. Retry once on throttling. NO execute tools exist — drafts only.
 * DONE WHEN: Works end-to-end on mocks by D2 morning.
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import env from '../libs/env.js';
import logger from '../libs/logger.js';
import { getBedrock } from '../libs/aws.js';
import { toToolConfig, runTool } from './tools/index.js';
import SYSTEM_PROMPT from './systemPrompt.js';

const MAX_TURNS = 10;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function guardrailConfig() {
  if (!env.GUARDRAIL_ID) return undefined;
  return {
    guardrailIdentifier: env.GUARDRAIL_ID,
    guardrailVersion: env.GUARDRAIL_VERSION,
    streamProcessingMode: 'async',
  };
}

/** One ConverseStream call, retried once on throttling with jitter. */
async function converseStreamOnce(client, Command, params, attempt = 0) {
  try {
    return await client.send(new Command(params));
  } catch (err) {
    if (attempt === 0 && (err.name === 'ThrottlingException' || err.name === 'ServiceUnavailableException')) {
      await sleep(600 + Math.random() * 600);
      return converseStreamOnce(client, Command, params, 1);
    }
    throw err;
  }
}

/**
 * runAgent — drive the tool-use loop, emitting ChatStreamEvents via onEvent.
 * @param {{message:string, history:{role,text}[], user:object,
 *          onEvent:(e)=>void, isAborted:()=>boolean}} opts
 */
export async function runAgent({ message, history = [], user, onEvent, isAborted }) {
  const client = await getBedrock();
  const { ConverseStreamCommand } = await import('@aws-sdk/client-bedrock-runtime');

  const messages = [
    ...history.map((h) => ({ role: h.role, content: [{ text: h.text }] })),
    { role: 'user', content: [{ text: message }] },
  ];
  const toolConfig = toToolConfig();

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    if (isAborted?.()) return;

    const response = await converseStreamOnce(client, ConverseStreamCommand, {
      modelId: env.BEDROCK_MODEL_ID,
      system: [{ text: SYSTEM_PROMPT }],
      messages,
      toolConfig,
      guardrailConfig: guardrailConfig(),
    });

    // Reassemble streamed content blocks by index.
    const blocks = new Map(); // index -> { type:'text'|'tool', text, toolUseId, name, inputJson }
    let stopReason = 'end_turn';

    for await (const evt of response.stream) {
      if (isAborted?.()) return;

      if (evt.contentBlockStart?.start?.toolUse) {
        const { toolUseId, name } = evt.contentBlockStart.start.toolUse;
        blocks.set(evt.contentBlockStart.contentBlockIndex, { type: 'tool', toolUseId, name, inputJson: '' });
      } else if (evt.contentBlockDelta) {
        const i = evt.contentBlockDelta.contentBlockIndex;
        const d = evt.contentBlockDelta.delta;
        if (d?.text !== undefined) {
          const b = blocks.get(i) || { type: 'text', text: '' };
          b.text = (b.text || '') + d.text;
          blocks.set(i, b);
          onEvent({ type: 'text', text: d.text });
        } else if (d?.toolUse?.input !== undefined) {
          const b = blocks.get(i);
          if (b) b.inputJson += d.toolUse.input;
        }
      } else if (evt.messageStop) {
        stopReason = evt.messageStop.stopReason;
      }
    }

    // Build the assistant message from the collected blocks (ordered by index).
    const ordered = [...blocks.entries()].sort((a, b) => a[0] - b[0]).map(([, b]) => b);
    const assistantContent = [];
    const toolUses = [];
    for (const b of ordered) {
      if (b.type === 'text' && b.text) {
        assistantContent.push({ text: b.text });
      } else if (b.type === 'tool') {
        let input = {};
        try { input = b.inputJson ? JSON.parse(b.inputJson) : {}; } catch { input = {}; }
        assistantContent.push({ toolUse: { toolUseId: b.toolUseId, name: b.name, input } });
        toolUses.push({ toolUseId: b.toolUseId, name: b.name, input });
      }
    }
    if (assistantContent.length) messages.push({ role: 'assistant', content: assistantContent });

    if (stopReason !== 'tool_use') {
      onEvent({ type: 'done', stop_reason: stopReason });
      return;
    }

    // Run each requested tool and feed results back.
    const toolResults = [];
    for (const tu of toolUses) {
      if (isAborted?.()) return;
      onEvent({ type: 'tool_call', tool_use_id: tu.toolUseId, tool_name: tu.name, input: tu.input });
      try {
        const { output, actionType, actionId } = await runTool(tu.name, tu.input, { user });
        onEvent({ type: 'tool_result', tool_use_id: tu.toolUseId, tool_name: tu.name, output });
        if (actionId && actionType) {
          onEvent({
            type: 'action_drafted',
            action_id: actionId,
            action_type: actionType,
            preview_url: output?.preview_url ?? null,
          });
        }
        toolResults.push({
          toolResult: { toolUseId: tu.toolUseId, content: [{ json: output ?? {} }], status: 'success' },
        });
      } catch (err) {
        logger.warn({ err: err.message, tool: tu.name }, 'tool failed');
        toolResults.push({
          toolResult: {
            toolUseId: tu.toolUseId,
            content: [{ text: `Tool error: ${err.message}` }],
            status: 'error',
          },
        });
      }
    }
    messages.push({ role: 'user', content: toolResults });
  }

  // Safety valve: too many tool turns.
  onEvent({ type: 'done', stop_reason: 'max_turns' });
}

export default runAgent;
