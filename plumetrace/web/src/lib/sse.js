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

export async function* streamChat(messages) {
  const isMock = import.meta.env.VITE_USE_MOCKS === '1';

  if (isMock) {
    const rawMock = (await import('../../../contracts/mocks/chat_stream.jsonl?raw')).default;
    const lines = rawMock.split('\n').filter(Boolean);
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') break;
        yield JSON.parse(jsonStr);
        await new Promise(r => setTimeout(r, 200));
      }
    }
    return;
  }

  const { tokens } = useAuthStore.getState();
  const res = await fetch(`${import.meta.env.VITE_API_URL}/agent/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(tokens?.idToken ? { Authorization: `Bearer ${tokens.idToken}` } : {})
    },
    body: JSON.stringify({ messages })
  });

  if (!res.ok) throw new Error('SSE failed');
  
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop();

    for (const chunk of lines) {
      const dataLines = chunk.split('\n').filter(l => l.startsWith('data: '));
      for (const line of dataLines) {
        const jsonStr = line.replace('data: ', '').trim();
        if (jsonStr === '[DONE]') return;
        if (jsonStr) {
          yield JSON.parse(jsonStr);
        }
      }
    }
  }
}
