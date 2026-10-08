/**
 * OWNER    : Yasho2
 * DUE      : D3 12:00
 * TASK     :
 *   Erase rider: delete Riders, RiderHealth, Shifts rows for rider; return counts. Consent: store consent_health + consent_ts.
 * DONE WHEN: -
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : WIP   (mock path done D1; real multi-table delete lands D3)
 */
import env from '../libs/env.js';
import * as mock from '../libs/mockStore.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import { AppError } from '../middlewares/error.middlewares.js';

const notYet = () => {
  throw new AppError(501, 'not_implemented', 'Real rider path lands D3. Run with MOCK_MODE=1.');
};

export const eraseRiderData = asyncHandler(async (req, res) => {
  res.json(env.MOCK_MODE ? mock.eraseRider(req.params.id) : notYet());
});

export const setConsent = asyncHandler(async (req, res) => {
  const consent = req.body?.consent_health ?? true;
  res.json(env.MOCK_MODE ? mock.setConsent(req.params.id, consent) : notYet());
});
