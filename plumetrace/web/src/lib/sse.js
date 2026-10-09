/**
 * OWNER    : Tanmay
 * DUE      : D2 10:00
 * TASK     :
 *   POST /agent/chat with fetch + ReadableStream parser for `data:` lines -> async iterator of ChatStreamEvent.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { useAuthStore } from '../stores/authStore';

/**
 * Normalise a frozen-contract ChatStreamEvent (contracts/src/api.js) into the
 * shape the Copilot store consumes. Keeps the UI decoupled from field renames.
 *   text         {text}                                  -> {content}
 *   tool_call    {tool_use_id, tool_name, input}         -> {id, name, args}
 *   tool_result  {tool_use_id, output}                   -> {id, result}
 *   action_drafted {action_id, action_type, preview_url} -> {draft_id, action_type, preview_url}
 */
function normalize(e) {
  switch (e.type) {
    case 'text':
      return { type: 'text', content: e.text ?? e.content ?? '' };
    case 'tool_call':
      return { type: 'tool_call', id: e.tool_use_id ?? e.id, name: e.tool_name ?? e.name, args: e.input ?? e.args };
    case 'tool_result':
      return { type: 'tool_result', id: e.tool_use_id ?? e.id, result: e.output ?? e.result };
    case 'action_drafted':
      return { type: 'action_drafted', draft_id: e.action_id ?? e.draft_id, action_type: e.action_type, preview_url: e.preview_url };
    default:
      return e; // done / error pass through
  }
}

export async function* streamChat(messages) {
  const isMock = import.meta.env.VITE_USE_MOCKS === '1';

  if (isMock) {
    // contracts/mocks/chat_stream.jsonl is one JSON event per line (no `data:` prefix).
    const rawMock = (await import('../../../contracts/mocks/chat_stream.jsonl?raw')).default;
    const lines = rawMock.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const jsonStr = line.startsWith('data: ') ? line.slice(6).trim() : line;
      if (jsonStr === '[DONE]') break;
      yield normalize(JSON.parse(jsonStr));
      await new Promise((r) => setTimeout(r, 180));
    }
    return;
  }

  // Real API: the contract ChatRequest is { message, history? } (history items {role, text}).
  const list = messages || [];
  const lastUser = [...list].reverse().find((m) => m.role === 'user');
  const message = lastUser?.content ?? '';
  const history = list
    .filter((m) => m !== lastUser && (m.role === 'user' || m.role === 'assistant') && m.content)
    .map((m) => ({ role: m.role, text: m.content }));

  const { tokens } = useAuthStore.getState();
  const res = await fetch(`${import.meta.env.VITE_API_URL}/agent/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(tokens?.idToken ? { Authorization: `Bearer ${tokens.idToken}` } : {}),
    },
    body: JSON.stringify({ message, history }),
  });

  if (!res.ok) throw new Error('SSE failed');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop();

    for (const chunk of chunks) {
      const dataLines = chunk.split('\n').filter((l) => l.startsWith('data: '));
      for (const line of dataLines) {
        const jsonStr = line.replace('data: ', '').trim();
        if (jsonStr === '[DONE]') return;
        if (jsonStr) yield normalize(JSON.parse(jsonStr));
      }
    }
  }
}
