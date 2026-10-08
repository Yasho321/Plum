/**
 * OWNER    : Yasho2
 * DUE      : D1 16:00
 * TASK     :
 *   Central error handler: AppError(status, code) -> JSON; ConditionalCheckFailed -> 409; log with pino.
 * DONE WHEN: -
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import logger from '../libs/logger.js';

/** Throwable application error with an HTTP status and a stable code. */
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (req, res, next) =>
  next(new AppError(404, 'not_found', `No route for ${req.method} ${req.path}`));

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // DynamoDB optimistic-lock failure (double approve/execute) -> 409.
  const name = err?.name || '';
  if (name === 'ConditionalCheckFailedException' || err?.code === 'conflict') {
    logger.warn({ err: err.message }, 'conflict');
    return res.status(409).json({ error: 'conflict', message: 'State changed; refresh and retry.' });
  }

  if (err instanceof AppError) {
    if (err.status >= 500) logger.error({ err }, err.code);
    else logger.warn({ code: err.code, status: err.status }, err.message);
    return res.status(err.status).json({ error: err.code, message: err.message, details: err.details });
  }

  logger.error({ err }, 'unhandled');
  return res.status(500).json({ error: 'internal', message: 'Internal server error' });
}
