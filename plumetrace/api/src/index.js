/**
 * OWNER    : Yasho2
 * DUE      : D1 14:00
 * TASK     :
 *   Entry: import env.js first (fail fast), then app.listen(PORT||8080). Same pattern as NotebookLM-Clone backend/src/index.js. Lambda Web Adapter forwards API Gateway requests to this port.
 * DONE WHEN: `bun run dev` serves on :8080.
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import env from './libs/env.js'; // first: validates env, fails fast
import app from './app.js';
import logger from './libs/logger.js';

const server = app.listen(env.PORT, () => {
  logger.info(`plumetrace-api on :${env.PORT} (MOCK_MODE=${env.MOCK_MODE ? 'on' : 'off'})`);
});

const shutdown = (sig) => {
  logger.info(`${sig} received, shutting down`);
  server.close(() => process.exit(0));
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default server;
