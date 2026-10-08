/**
 * OWNER    : Yasho2
 * DUE      : D1 14:00
 * TASK     :
 *   Wrap async controllers (copy from NotebookLM-Clone).
 * DONE WHEN: -
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */

/** Wrap an async route handler so thrown/rejected errors reach the error middleware. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export default asyncHandler;
