/**
 * OWNER    : Yasho2
 * DUE      : D2 12:00
 * TASK     :
 *   List by status (scan w/ filter is fine at demo scale), approve -> actionsRepo.transition(draft->approved, approved_by=sub) then PutEvents action.approved; reject -> rejected. Return updated item. Audit fields timestamps.
 * DONE WHEN: AC6 path: approve in UI -> executor fires within seconds.
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : WIP   (mock path done D1; real DynamoDB + EventBridge path lands D2)
 */
import env from '../libs/env.js';
import * as mock from '../libs/mockStore.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import { AppError } from '../middlewares/error.middlewares.js';
import { groupForActionType } from '../middlewares/auth.middlewares.js';

const notYet = () => {
  throw new AppError(501, 'not_implemented', 'Real actions path lands D2. Run with MOCK_MODE=1.');
};

/** Enforce that the caller's group may act on this action type (admin passes). */
function assertGroupFor(req, type) {
  const groups = req.user?.groups || [];
  const needed = groupForActionType(type);
  if (!groups.includes('admin') && !groups.includes(needed)) {
    throw new AppError(403, 'forbidden', `Approving a ${type} requires the '${needed}' group`);
  }
}

export const listActions = asyncHandler(async (req, res) => {
  const { status } = req.validatedQuery || {};
  res.json(env.MOCK_MODE ? mock.listActions(status) : notYet());
});

export const approveAction = asyncHandler(async (req, res) => {
  const id = req.params.id;
  if (env.MOCK_MODE) {
    const existing = mock.getAction(id);
    if (!existing) throw new AppError(404, 'not_found', `No action ${id}`);
    assertGroupFor(req, existing.type);
    const { item, error } = mock.approveAction(id, req.user.sub);
    if (error === 'conflict') throw new AppError(409, 'conflict', `Action is '${existing.status}', not 'draft'`);
    // A real approve also PutEvents(action.approved) so Khare's executor fires.
    return res.json(item);
  }
  return notYet();
});

export const rejectAction = asyncHandler(async (req, res) => {
  const id = req.params.id;
  if (env.MOCK_MODE) {
    const existing = mock.getAction(id);
    if (!existing) throw new AppError(404, 'not_found', `No action ${id}`);
    assertGroupFor(req, existing.type);
    const { item, error } = mock.rejectAction(id, req.user.sub);
    if (error === 'conflict') throw new AppError(409, 'conflict', `Action is '${existing.status}', not 'draft'`);
    return res.json(item);
  }
  return notYet();
});
