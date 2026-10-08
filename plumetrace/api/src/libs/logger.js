/**
 * OWNER    : Yasho2
 * DUE      : D1 14:00
 * TASK     :
 *   pino logger (pretty in dev, JSON in Lambda).
 * DONE WHEN: -
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import pino from 'pino';
import env from './env.js';

const isDev = env.NODE_ENV === 'development';

const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  // Pretty only in local dev; Lambda/CloudWatch wants JSON lines.
  transport: isDev
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
    : undefined,
  base: { service: 'plumetrace-api' },
  redact: ['req.headers.authorization', 'req.headers.cookie'],
});

export default logger;
