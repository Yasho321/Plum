/**
 * OWNER    : Yasho2
 * DUE      : D2 10:00
 * TASK     :
 *   Open SSE (text/event-stream, flush headers), run agent/loop.js, write each ChatStreamEvent as `data: <json>\n\n`. Keep conversation history client-side (request carries messages[]). Abort on client disconnect.
 * DONE WHEN: Copilot panel streams live.
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE   (mock SSE replay when MOCK_MODE && !AGENT_LIVE; else real
 *            Anthropic loop — Option A. MOCK_MODE=1 + AGENT_LIVE=1 = live Claude over mocks.)
 */
import env from '../libs/env.js';
import * as mock from '../libs/mockStore.js';
import logger from '../libs/logger.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function chat(req, res) {
  // SSE headers. NB: compression() must NOT be applied to this route (breaks SSE).
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
  // Heartbeat comment every 15 s so proxies don't drop the idle connection.
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);

  // Detect a real client disconnect via the RESPONSE close (req 'close' fires
  // as soon as the POST body is consumed, which would abort us immediately).
  let aborted = false;
  res.on('close', () => { aborted = true; });

  try {
    if (env.MOCK_MODE && !env.AGENT_LIVE) {
      // Replay the recorded ideal answer with small, realistic delays.
      for (const event of mock.getChatEvents()) {
        if (aborted) break;
        send(event);
        await sleep(event.type === 'text' ? 45 : 90);
      }
    } else {
      // Real Anthropic Copilot (Option A). With MOCK_MODE=1 + AGENT_LIVE=1 the
      // model is live while the tools read mock data — the demo configuration.
      const { runAgent } = await import('../agent/loop.js');
      await runAgent({
        message: req.body.message,
        history: req.body.history || [],
        user: req.user,
        onEvent: send,
        isAborted: () => aborted,
      });
    }
  } catch (err) {
    logger.error({ err }, 'agent chat failed');
    if (!aborted) send({ type: 'error', message: 'The assistant hit an error. Please try again.' });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
}
