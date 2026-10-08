/**
 * OWNER    : Yasho2
 * DUE      : D1 16:00
 * TASK     :
 *   validate(schema, 'query'|'body'|'params') using contracts zod schemas -> 400 with issues.
 * DONE WHEN: -
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { z } from 'zod';
import { AppError } from './error.middlewares.js';

/**
 * validate(schema, where) — parse req[where] with a zod schema from contracts,
 * replace it with the parsed (coerced/defaulted) value, or 400 with issues.
 * `where` is 'query' | 'body' | 'params' (default 'body').
 */
export const validate = (schema, where = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[where]);
  if (!result.success) {
    return next(new AppError(400, 'validation_error', 'Request failed validation', z.treeifyError(result.error)));
  }
  // Express 5 getters for req.query are read-only; stash parsed values instead.
  if (where === 'query') req.validatedQuery = result.data;
  else req[where] = result.data;
  next();
};

export default validate;
