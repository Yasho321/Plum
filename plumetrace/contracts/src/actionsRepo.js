/**
 * OWNER    : Yasho2
 * DUE      : D1 18:00
 * TASK     :
 *   Tiny shared helper used by api/ and gov/: createDraft(type, payload, runId) -> ActionItem, getAction(id), transition(id, from, to, extra) using a DynamoDB ConditionExpression on status (prevents double-approve / double-execute).
 * DONE WHEN: Unit test: approving an already-approved action throws ConditionalCheckFailed -> 409.
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { randomUUID } from 'node:crypto';
import { ActionItem, actionPk, canTransition } from './dynamo.js';

const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

/**
 * Pure builder for a fresh draft action (no I/O). Validated against the
 * frozen ActionItem schema so no caller can invent a shape.
 */
export function newActionItem(type, payload, runId = null, createdBy = 'agent') {
  const id = randomUUID();
  const ts = nowIso();
  const item = {
    pk: actionPk(id),
    action_id: id,
    type,
    status: 'draft',
    payload: payload ?? {},
    created_by: createdBy,
    approved_by: null,
    run_id: runId,
    created_at: ts,
    updated_at: ts,
  };
  return ActionItem.parse(item);
}

/** Throw if `from -> to` is not a legal status transition (brief §8.1). */
export function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    const err = new Error(`Illegal action transition ${from} -> ${to}`);
    err.name = 'IllegalTransition';
    throw err;
  }
}

/**
 * makeActionsRepo — bind the repo to a DynamoDB document client.
 * Dependency-injected so the contracts package stays AWS-free:
 *   import { DynamoDBDocument } ... ; import { PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
 *   const repo = makeActionsRepo({ doc, table, PutCommand, GetCommand, UpdateCommand });
 */
export function makeActionsRepo({ doc, table, PutCommand, GetCommand, UpdateCommand }) {
  if (!doc || !table) throw new Error('makeActionsRepo needs { doc, table }');

  async function createDraft(type, payload, runId) {
    const item = newActionItem(type, payload, runId);
    await doc.send(
      new PutCommand({
        TableName: table,
        Item: item,
        ConditionExpression: 'attribute_not_exists(pk)',
      }),
    );
    return item;
  }

  async function getAction(id) {
    const { Item } = await doc.send(new GetCommand({ TableName: table, Key: { pk: actionPk(id) } }));
    return Item || null;
  }

  /**
   * Atomically move an action `from -> to`. The ConditionExpression on the
   * current status makes a double approve/execute fail with
   * ConditionalCheckFailedException (the API maps that to 409).
   * `extra` adds/overwrites attributes (e.g. { approved_by: sub }).
   */
  async function transition(id, from, to, extra = {}) {
    assertTransition(from, to);

    const sets = ['#s = :to', 'updated_at = :now'];
    const names = { '#s': 'status' };
    const values = { ':to': to, ':from': from, ':now': nowIso() };
    for (const [k, v] of Object.entries(extra)) {
      names[`#${k}`] = k;
      values[`:${k}`] = v;
      sets.push(`#${k} = :${k}`);
    }

    const { Attributes } = await doc.send(
      new UpdateCommand({
        TableName: table,
        Key: { pk: actionPk(id) },
        UpdateExpression: `SET ${sets.join(', ')}`,
        ConditionExpression: '#s = :from',
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: 'ALL_NEW',
      }),
    );
    return Attributes;
  }

  return { createDraft, getAction, transition };
}

export default makeActionsRepo;
