/**
 * OWNER    : Yasho2
 * DUE      : D2 12:00
 * TASK     :
 *   List by status (scan w/ filter is fine at demo scale), approve -> actionsRepo.transition(draft->approved, approved_by=sub) then PutEvents action.approved; reject -> rejected. Return updated item. Audit fields timestamps.
 * DONE WHEN: AC6 path: approve in UI -> executor fires within seconds.
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : WIP   (mock path tested D1; real DynamoDB+EventBridge path lands/verifies at CP1 D2)
 */
import { SOURCES, DETAIL_TYPES } from '@plumetrace/contracts';
import { makeActionsRepo } from '@plumetrace/contracts/actionsRepo';
import env from '../libs/env.js';
import * as mock from '../libs/mockStore.js';
import { getDocClient, getDdbCommands, putEvent } from '../libs/aws.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import { AppError } from '../middlewares/error.middlewares.js';
import { groupForActionType } from '../middlewares/auth.middlewares.js';

/** Lazily build the real actionsRepo bound to the Actions table. */
let _repo;
async function repo() {
  if (!_repo) {
    const doc = await getDocClient();
    const { PutCommand, GetCommand, UpdateCommand } = await getDdbCommands();
    _repo = makeActionsRepo({ doc, table: env.TABLE_ACTIONS, PutCommand, GetCommand, UpdateCommand });
  }
  return _repo;
}

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
  if (env.MOCK_MODE) return res.json(mock.listActions(status));

  const doc = await getDocClient();
  const { ScanCommand } = await getDdbCommands();
  const params = { TableName: env.TABLE_ACTIONS };
  if (status) {
    params.FilterExpression = '#s = :s';
    params.ExpressionAttributeNames = { '#s': 'status' };
    params.ExpressionAttributeValues = { ':s': status };
  }
  const { Items = [] } = await doc.send(new ScanCommand(params));
  res.json({ count: Items.length, actions: Items });
});

export const approveAction = asyncHandler(async (req, res) => {
  const id = req.params.id;

  if (env.MOCK_MODE) {
    const existing = mock.getAction(id);
    if (!existing) throw new AppError(404, 'not_found', `No action ${id}`);
    assertGroupFor(req, existing.type);
    const { item, error } = mock.approveAction(id, req.user.sub);
    if (error === 'conflict') throw new AppError(409, 'conflict', `Action is '${existing.status}', not 'draft'`);
    return res.json(item);
  }

  const r = await repo();
  const existing = await r.getAction(id);
  if (!existing) throw new AppError(404, 'not_found', `No action ${id}`);
  assertGroupFor(req, existing.type);

  // Conditional transition draft->approved (double-click -> ConditionalCheckFailed -> 409).
  const item = await r.transition(id, 'draft', 'approved', { approved_by: req.user.sub });

  // Fire action.approved so Khare's executor delivers (AC6).
  await putEvent(SOURCES.AGENT, DETAIL_TYPES.ACTION_APPROVED, item);
  res.json(item);
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

  const r = await repo();
  const existing = await r.getAction(id);
  if (!existing) throw new AppError(404, 'not_found', `No action ${id}`);
  assertGroupFor(req, existing.type);
  const item = await r.transition(id, 'draft', 'rejected', { approved_by: req.user.sub });
  res.json(item);
});
