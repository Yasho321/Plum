/**
 * OWNER    : Yasho2
 * DUE      : D2 14:00
 * TASK     :
 *   Query Shifts for fleet+date, join Riders, return dose % of budget (never raw health data).
 * DONE WHEN: -
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : WIP   (mock path done D1; real Shifts/Riders join lands D2)
 */
import env from '../libs/env.js';
import * as mock from '../libs/mockStore.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import { AppError } from '../middlewares/error.middlewares.js';

const notYet = () => {
  throw new AppError(501, 'not_implemented', 'Real fleet path lands D2. Run with MOCK_MODE=1.');
};

/** Service fn reused by agent/tools/fleet.tools.js getFleetExposure. Never returns health conditions (§15). */
export const svcFleetExposure = async (fleetId, date) =>
  env.MOCK_MODE ? mock.getFleetExposure(fleetId, date) : notYet();

export const getFleetExposure = asyncHandler(async (req, res) => {
  const { date } = req.validatedQuery || {};
  res.json(await svcFleetExposure(req.params.id, date));
});
